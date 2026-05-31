/**
 * extract-themes.ts
 *
 * Standalone script to extract recurring issue themes from reviews using Claude Haiku.
 * Writes to: issue_themes, issue_theme_reviews, theme_extraction_log
 *
 * Usage:
 *   npx tsx scripts/extract-themes.ts                  # last 30 days
 *   npx tsx scripts/extract-themes.ts --backfill       # all unprocessed reviews
 *   npx tsx scripts/extract-themes.ts --dry-run        # estimate cost only
 *   npx tsx scripts/extract-themes.ts --max-cost 5     # stop before exceeding $5
 *   npx tsx scripts/extract-themes.ts --resume <run_id>
 *
 * Dependencies: npm install openai dotenv tsx
 *
 * Required env vars in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENROUTER_API_KEY
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ── ANSI colors ──────────────────────────────────────────────────────────────
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ── Types ────────────────────────────────────────────────────────────────────
interface CLIArgs {
  backfill: boolean;
  dryRun: boolean;
  maxCost: number | null;
  resume: string | null;
}

interface ReviewRow {
  id: number;
  asin: string;
  title: string | null;
  review_text: string | null;
  rating: number;
  review_date: string | null;
}

interface ExtractedTheme {
  theme_label: string;
  description: string;
  category: 'quality' | 'design' | 'durability' | 'packaging' | 'usability' | 'shipping' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  review_ids: number[];
  relevance_notes: string;
}

// ── Cost constants (Claude Haiku via OpenRouter) ────────────────────────────
const INPUT_COST_PER_MTOK = 0.25;
const OUTPUT_COST_PER_MTOK = 1.25;
const MODEL = 'anthropic/claude-3.5-haiku';
const BATCH_SIZE = 50;
const AVG_TOKENS_PER_REVIEW = 200; // rough estimate for input
const AVG_OUTPUT_TOKENS_PER_BATCH = 1500;

// ── CLI parsing ──────────────────────────────────────────────────────────────
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = { backfill: false, dryRun: false, maxCost: null, resume: null };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--backfill':
        result.backfill = true;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--max-cost':
        result.maxCost = parseFloat(args[++i]);
        if (isNaN(result.maxCost)) {
          console.error(red('Error: --max-cost requires a numeric value'));
          process.exit(1);
        }
        break;
      case '--resume':
        result.resume = args[++i];
        if (!result.resume) {
          console.error(red('Error: --resume requires a run_id'));
          process.exit(1);
        }
        break;
      default:
        console.error(red(`Unknown flag: ${args[i]}`));
        process.exit(1);
    }
  }

  return result;
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

/** Get review IDs that have already been theme-processed */
async function getProcessedReviewIds(supabase: SupabaseClient): Promise<Set<number>> {
  const ids = new Set<number>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('issue_theme_reviews')
      .select('review_id')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch processed review IDs: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) ids.add(row.review_id);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

/** Fetch reviews grouped by ASIN, applying mode filters */
async function fetchReviewsByAsin(
  supabase: SupabaseClient,
  mode: 'backfill' | 'recent',
  processedIds?: Set<number>
): Promise<Map<string, ReviewRow[]>> {
  const grouped = new Map<string, ReviewRow[]>();

  let query = supabase
    .from('reviews')
    .select('id, asin, title, review_text, rating, review_date')
    .order('asin');

  if (mode === 'recent') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte('review_date', thirtyDaysAgo.toISOString().split('T')[0]);
  }

  // Paginate through all results
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as ReviewRow[]) {
      // In backfill mode, skip already-processed reviews
      if (mode === 'backfill' && processedIds?.has(row.id)) continue;

      if (!grouped.has(row.asin)) grouped.set(row.asin, []);
      grouped.get(row.asin)!.push(row);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Filter out ASINs with fewer than 5 reviews
  for (const [asin, reviews] of grouped) {
    if (reviews.length < 5) grouped.delete(asin);
  }

  return grouped;
}

/** Get completed ASINs for a given run_id */
async function getCompletedAsins(supabase: SupabaseClient, runId: string): Promise<Set<string>> {
  const completed = new Set<string>();
  const { data, error } = await supabase
    .from('theme_extraction_log')
    .select('asin')
    .eq('run_id', runId)
    .eq('status', 'completed');

  if (error) throw new Error(`Failed to fetch extraction log: ${error.message}`);
  if (data) {
    for (const row of data) completed.add(row.asin);
  }

  return completed;
}

// ── Claude extraction ────────────────────────────────────────────────────────

function buildPrompt(reviews: ReviewRow[]): string {
  const reviewBlock = reviews.map(r =>
    `[ID:${r.id}] Rating:${r.rating}/5 Date:${r.review_date ?? 'unknown'}\nTitle: ${r.title ?? '(none)'}\n${r.review_text ?? '(no text)'}`
  ).join('\n---\n');

  return `You are analyzing customer reviews for an Amazon product. Extract recurring themes (complaints, quality issues, feature requests, praise patterns) that appear in 2 or more reviews, from ANY star rating.

For each theme, provide:
- theme_label: short, descriptive label (e.g. "Zipper breaks after 1 month")
- description: 1-2 sentence explanation
- category: one of quality, design, durability, packaging, usability, shipping, other
- severity: low (minor inconvenience), medium (affects usability), high (product fails), critical (safety concern)
- review_ids: array of review IDs that mention this theme
- relevance_notes: brief note on how the theme manifests across reviews

Return ONLY a JSON array of theme objects. No markdown, no explanation outside the JSON.

Reviews:
${reviewBlock}`;
}

async function extractThemesBatch(
  openai: OpenAI,
  reviews: ReviewRow[]
): Promise<{ themes: ExtractedTheme[]; inputTokens: number; outputTokens: number }> {
  const prompt = buildPrompt(reviews);

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.choices[0]?.message?.content ?? '';

  // Parse JSON — handle possible markdown wrapping
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const themes: ExtractedTheme[] = JSON.parse(jsonStr);

  return {
    themes,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

// ── Database writes ──────────────────────────────────────────────────────────

async function upsertThemes(
  supabase: SupabaseClient,
  asin: string,
  themes: ExtractedTheme[]
): Promise<number> {
  let themesWritten = 0;

  for (const theme of themes) {
    // Check if theme already exists for this ASIN (case-insensitive)
    const { data: existing } = await supabase
      .from('issue_themes')
      .select('id, mention_count')
      .eq('asin', asin)
      .ilike('theme_label', theme.theme_label)
      .limit(1);

    const now = new Date().toISOString();

    if (existing && existing.length > 0) {
      // Update existing theme
      const existingTheme = existing[0];
      await supabase
        .from('issue_themes')
        .update({
          mention_count: existingTheme.mention_count + theme.review_ids.length,
          last_seen: now,
          description: theme.description,
          severity: theme.severity,
          updated_at: now,
        })
        .eq('id', existingTheme.id);

      // Add new junction rows (ignore duplicates)
      const junctionRows = theme.review_ids.map(reviewId => ({
        theme_id: existingTheme.id,
        review_id: reviewId,
        relevance: theme.relevance_notes,
      }));

      await supabase
        .from('issue_theme_reviews')
        .upsert(junctionRows, { onConflict: 'theme_id,review_id' });

      themesWritten++;
    } else {
      // Insert new theme
      const { data: inserted, error } = await supabase
        .from('issue_themes')
        .insert({
          theme_label: theme.theme_label,
          description: theme.description,
          category: theme.category,
          severity: theme.severity,
          asin,
          mention_count: theme.review_ids.length,
          first_seen: now,
          last_seen: now,
          status: 'active',
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error) {
        console.error(red(`  Failed to insert theme "${theme.theme_label}": ${error.message}`));
        continue;
      }

      // Insert junction rows
      const junctionRows = theme.review_ids.map(reviewId => ({
        theme_id: inserted.id,
        review_id: reviewId,
        relevance: theme.relevance_notes,
      }));

      await supabase
        .from('issue_theme_reviews')
        .upsert(junctionRows, { onConflict: 'theme_id,review_id' });

      themesWritten++;
    }
  }

  return themesWritten;
}

async function insertLogEntry(
  supabase: SupabaseClient,
  asin: string,
  runId: string,
  reviewCount: number
): Promise<number> {
  const { data, error } = await supabase
    .from('theme_extraction_log')
    .insert({
      asin,
      reviews_sent: reviewCount,
      tokens_used: 0,
      themes_found: 0,
      status: 'pending',
      run_id: runId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to insert log entry: ${error.message}`);
  return data.id;
}

async function updateLogEntry(
  supabase: SupabaseClient,
  logId: number,
  status: 'completed' | 'failed',
  tokensUsed: number,
  themesFound: number,
  errorMessage?: string
) {
  await supabase
    .from('theme_extraction_log')
    .update({
      status,
      tokens_used: tokensUsed,
      themes_found: themesFound,
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq('id', logId);
}

// ── Retry logic ──────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;

      // Fatal errors — don't retry
      if (status === 402) throw err;

      // Rate limit — retry with backoff
      if (status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(yellow(`  Rate limited. Retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})...`));
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Other errors — retry with backoff for transient issues
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(yellow(`  Error (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in ${delay / 1000}s...`));
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }
  throw new Error('Unreachable');
}

// ── Cost estimation ──────────────────────────────────────────────────────────

function estimateCost(totalReviews: number): { batches: number; inputCost: number; outputCost: number; total: number } {
  const batches = Math.ceil(totalReviews / BATCH_SIZE);
  const inputTokens = totalReviews * AVG_TOKENS_PER_REVIEW;
  const outputTokens = batches * AVG_OUTPUT_TOKENS_PER_BATCH;
  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
  return { batches, inputCost, outputCost, total: inputCost + outputCost };
}

function estimateBatchCost(reviewCount: number): number {
  const inputTokens = reviewCount * AVG_TOKENS_PER_REVIEW;
  const outputTokens = AVG_OUTPUT_TOKENS_PER_BATCH;
  return (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load env
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(red('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'));
    process.exit(1);
  }
  if (!openRouterKey) {
    console.error(red('Missing OPENROUTER_API_KEY in .env.local'));
    process.exit(1);
  }

  const args = parseArgs();
  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({
    apiKey: openRouterKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const runId = args.resume ?? `themes_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

  console.log(cyan(`\n=== Theme Extraction ===`));
  console.log(dim(`Run ID: ${runId}`));
  console.log(dim(`Mode: ${args.backfill ? 'backfill' : args.resume ? 'resume' : 'last 30 days'}`));
  if (args.maxCost) console.log(dim(`Max cost: $${args.maxCost.toFixed(2)}`));
  console.log('');

  // Fetch reviews
  console.log('Fetching reviews...');
  let processedIds: Set<number> | undefined;
  if (args.backfill) {
    processedIds = await getProcessedReviewIds(supabase);
    console.log(dim(`  ${processedIds.size} reviews already processed`));
  }

  const reviewsByAsin = await fetchReviewsByAsin(
    supabase,
    args.backfill ? 'backfill' : 'recent',
    processedIds
  );

  // For resume mode, filter out completed ASINs
  if (args.resume) {
    const completedAsins = await getCompletedAsins(supabase, args.resume);
    for (const asin of completedAsins) {
      reviewsByAsin.delete(asin);
    }
    console.log(dim(`  ${completedAsins.size} ASINs already completed for this run`));
  }

  const totalAsins = reviewsByAsin.size;
  const totalReviews = Array.from(reviewsByAsin.values()).reduce((sum, r) => sum + r.length, 0);

  console.log(`Found ${green(String(totalAsins))} ASINs with ${green(String(totalReviews))} reviews to process\n`);

  if (totalAsins === 0) {
    console.log(yellow('Nothing to process. Exiting.'));
    return;
  }

  // Dry run
  if (args.dryRun) {
    const est = estimateCost(totalReviews);
    console.log(cyan('=== Dry Run Estimate ==='));
    console.log(`ASINs:            ${totalAsins}`);
    console.log(`Reviews:          ${totalReviews}`);
    console.log(`Batches:          ${est.batches}`);
    console.log(`Est. input cost:  $${est.inputCost.toFixed(4)}`);
    console.log(`Est. output cost: $${est.outputCost.toFixed(4)}`);
    console.log(`Est. total cost:  ${green('$' + est.total.toFixed(4))}`);
    console.log(dim(`\n(Based on Haiku rates: $${INPUT_COST_PER_MTOK}/MTok in, $${OUTPUT_COST_PER_MTOK}/MTok out)`));
    return;
  }

  // Process each ASIN
  let runningCost = 0;
  let totalThemesFound = 0;
  let processedCount = 0;
  const asins = Array.from(reviewsByAsin.entries());

  for (const [asin, reviews] of asins) {
    processedCount++;

    // Check cost budget before processing
    if (args.maxCost) {
      const nextBatchCost = estimateBatchCost(reviews.length);
      if (runningCost + nextBatchCost > args.maxCost) {
        console.log(yellow(`\nStopping: next ASIN would exceed max cost ($${args.maxCost.toFixed(2)})`));
        console.log(yellow(`Current spend: $${runningCost.toFixed(4)}`));
        console.log(yellow(`Resume with: npx tsx scripts/extract-themes.ts --resume ${runId}`));
        break;
      }
    }

    console.log(`[${processedCount}/${totalAsins}] Processing ASIN ${cyan(asin)} (${reviews.length} reviews)...`);

    // Insert log entry
    const logId = await insertLogEntry(supabase, asin, runId, reviews.length);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let allThemes: ExtractedTheme[] = [];

    try {
      // Process in batches of 50
      for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
        const batch = reviews.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(reviews.length / BATCH_SIZE);

        if (totalBatches > 1) {
          process.stdout.write(dim(`  Batch ${batchNum}/${totalBatches}... `));
        }

        const result = await withRetry(() => extractThemesBatch(openai, batch));
        allThemes.push(...result.themes);
        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;

        if (totalBatches > 1) {
          console.log(dim(`${result.themes.length} themes`));
        }
      }

      // Deduplicate themes across batches for same ASIN
      const mergedThemes = mergeThemes(allThemes);

      // Write to database
      const written = await upsertThemes(supabase, asin, mergedThemes);

      // Calculate cost
      const cost = (totalInputTokens / 1_000_000) * INPUT_COST_PER_MTOK
        + (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
      runningCost += cost;
      totalThemesFound += mergedThemes.length;

      // Update log
      await updateLogEntry(supabase, logId, 'completed', totalInputTokens + totalOutputTokens, mergedThemes.length);

      console.log(green(`  ${mergedThemes.length} themes found`) + dim(` ($${cost.toFixed(4)}, running: $${runningCost.toFixed(4)})`));

    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;
      const message = err?.message ?? String(err);

      await updateLogEntry(supabase, logId, 'failed', totalInputTokens + totalOutputTokens, 0, message);

      if (status === 402) {
        console.error(red(`\nFatal: Payment required (402). Check your OpenRouter billing.`));
      } else {
        console.error(red(`  Failed: ${message}`));
      }

      console.log(yellow(`Resume with: npx tsx scripts/extract-themes.ts --resume ${runId}`));
      process.exit(1);
    }
  }

  // Summary
  console.log(cyan(`\n=== Extraction Complete ===`));
  console.log(`ASINs processed: ${processedCount}`);
  console.log(`Themes found:    ${totalThemesFound}`);
  console.log(`Total cost:      $${runningCost.toFixed(4)}`);
  console.log(`Run ID:          ${runId}\n`);
}

/** Merge duplicate themes from multiple batches for the same ASIN */
function mergeThemes(themes: ExtractedTheme[]): ExtractedTheme[] {
  const byLabel = new Map<string, ExtractedTheme>();

  for (const theme of themes) {
    const key = theme.theme_label.toLowerCase().trim();
    const existing = byLabel.get(key);

    if (existing) {
      // Merge review IDs (deduplicate)
      const idSet = new Set([...existing.review_ids, ...theme.review_ids]);
      existing.review_ids = Array.from(idSet);
      // Keep the higher severity
      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      if (severityOrder[theme.severity] > severityOrder[existing.severity]) {
        existing.severity = theme.severity;
      }
      // Append relevance notes
      if (theme.relevance_notes && theme.relevance_notes !== existing.relevance_notes) {
        existing.relevance_notes = `${existing.relevance_notes}; ${theme.relevance_notes}`;
      }
    } else {
      byLabel.set(key, { ...theme });
    }
  }

  return Array.from(byLabel.values());
}

main().catch(err => {
  console.error(red(`Unhandled error: ${err.message}`));
  process.exit(1);
});
