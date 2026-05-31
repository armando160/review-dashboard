/**
 * generate-facets.ts
 *
 * Standalone script to generate product facets from reviews using Claude Haiku.
 * Writes to: product_facets, facet_extraction_log
 *
 * Usage:
 *   npx tsx scripts/generate-facets.ts                  # last 30 days
 *   npx tsx scripts/generate-facets.ts --backfill       # all unprocessed reviews
 *   npx tsx scripts/generate-facets.ts --dry-run        # estimate cost only
 *   npx tsx scripts/generate-facets.ts --max-cost 5     # stop before exceeding $5
 *   npx tsx scripts/generate-facets.ts --resume <run_id>
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

interface RepresentativeQuote {
  quote: string;
  review_id: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface ExtractedFacet {
  facet_name: string;
  facet_type: 'feature' | 'experience' | 'comparison';
  sentiment_breakdown: { positive: number; negative: number; neutral: number };
  summary: string;
  representative_quotes: RepresentativeQuote[];
}

// ── Cost constants (Claude Haiku via OpenRouter) ────────────────────────────
const INPUT_COST_PER_MTOK = 0.25;
const OUTPUT_COST_PER_MTOK = 1.25;
const MODEL = 'anthropic/claude-3.5-haiku';
const BATCH_SIZE = 50;
const AVG_TOKENS_PER_REVIEW = 200;
const AVG_OUTPUT_TOKENS_PER_BATCH = 2000;
const MIN_REVIEWS_PER_ASIN = 10;

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

/** Get ASINs that already have facets */
async function getProcessedAsins(supabase: SupabaseClient): Promise<Set<string>> {
  const asins = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('product_facets')
      .select('asin')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch processed ASINs: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) asins.add(row.asin);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return asins;
}

/** Fetch reviews grouped by ASIN */
async function fetchReviewsByAsin(
  supabase: SupabaseClient,
  mode: 'backfill' | 'recent'
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

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as ReviewRow[]) {
      if (!grouped.has(row.asin)) grouped.set(row.asin, []);
      grouped.get(row.asin)!.push(row);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Filter out ASINs with fewer than 10 reviews
  for (const [asin, reviews] of grouped) {
    if (reviews.length < MIN_REVIEWS_PER_ASIN) grouped.delete(asin);
  }

  return grouped;
}

/** Get completed ASINs for a given run_id */
async function getCompletedAsins(supabase: SupabaseClient, runId: string): Promise<Set<string>> {
  const completed = new Set<string>();
  const { data, error } = await supabase
    .from('facet_extraction_log')
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

  return `You are analyzing customer reviews for an Amazon product. Identify 5-15 facets — specific features, aspects, or experiences that customers discuss.

For each facet, provide:
- facet_name: concise name (e.g. "Battery Life", "Build Quality", "Customer Service")
- facet_type: one of "feature" (product attribute), "experience" (usage/service), "comparison" (vs competitors)
- sentiment_breakdown: { positive: N, negative: N, neutral: N } — count of reviews expressing each sentiment about this facet
- summary: 1-2 sentences summarizing what customers say about this facet
- representative_quotes: 3-5 objects with { quote: "short quote under 20 words", review_id: N, sentiment: "positive"|"negative"|"neutral" }

Return ONLY a JSON array of facet objects. No markdown, no explanation outside the JSON.

Reviews:
${reviewBlock}`;
}

async function extractFacetsBatch(
  openai: OpenAI,
  reviews: ReviewRow[]
): Promise<{ facets: ExtractedFacet[]; inputTokens: number; outputTokens: number }> {
  const prompt = buildPrompt(reviews);

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.choices[0]?.message?.content ?? '';

  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const facets: ExtractedFacet[] = JSON.parse(jsonStr);

  return {
    facets,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

// ── Database writes ──────────────────────────────────────────────────────────

async function upsertFacets(
  supabase: SupabaseClient,
  asin: string,
  facets: ExtractedFacet[]
): Promise<number> {
  let facetsWritten = 0;
  const now = new Date().toISOString();

  for (const facet of facets) {
    const { data: existing } = await supabase
      .from('product_facets')
      .select('id, positive_count, negative_count, neutral_count, total_mentions, representative_quotes')
      .eq('asin', asin)
      .ilike('facet_name', facet.facet_name)
      .limit(1);

    const sb = facet.sentiment_breakdown;

    if (existing && existing.length > 0) {
      // Update existing facet — merge counts and quotes
      const ex = existing[0];
      const existingQuotes: RepresentativeQuote[] = ex.representative_quotes ?? [];

      // Merge quotes, keeping up to 5 most recent/unique
      const allQuotes = [...facet.representative_quotes, ...existingQuotes];
      const uniqueQuotes = deduplicateQuotes(allQuotes).slice(0, 5);

      await supabase
        .from('product_facets')
        .update({
          positive_count: ex.positive_count + sb.positive,
          negative_count: ex.negative_count + sb.negative,
          neutral_count: ex.neutral_count + sb.neutral,
          total_mentions: ex.total_mentions + sb.positive + sb.negative + sb.neutral,
          summary: facet.summary,
          representative_quotes: uniqueQuotes,
          updated_at: now,
        })
        .eq('id', ex.id);

      facetsWritten++;
    } else {
      // Insert new facet
      const { error } = await supabase
        .from('product_facets')
        .insert({
          asin,
          facet_name: facet.facet_name,
          facet_type: facet.facet_type,
          positive_count: sb.positive,
          negative_count: sb.negative,
          neutral_count: sb.neutral,
          total_mentions: sb.positive + sb.negative + sb.neutral,
          summary: facet.summary,
          representative_quotes: facet.representative_quotes,
          created_at: now,
          updated_at: now,
        });

      if (error) {
        console.error(red(`  Failed to insert facet "${facet.facet_name}": ${error.message}`));
        continue;
      }

      facetsWritten++;
    }
  }

  return facetsWritten;
}

function deduplicateQuotes(quotes: RepresentativeQuote[]): RepresentativeQuote[] {
  const seen = new Set<string>();
  const result: RepresentativeQuote[] = [];

  for (const q of quotes) {
    const key = `${q.review_id}:${q.quote.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(q);
    }
  }

  return result;
}

async function insertLogEntry(
  supabase: SupabaseClient,
  asin: string,
  runId: string,
  reviewCount: number
): Promise<number> {
  const { data, error } = await supabase
    .from('facet_extraction_log')
    .insert({
      asin,
      reviews_sent: reviewCount,
      tokens_used: 0,
      facets_found: 0,
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
  facetsFound: number,
  errorMessage?: string
) {
  await supabase
    .from('facet_extraction_log')
    .update({
      status,
      tokens_used: tokensUsed,
      facets_found: facetsFound,
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

      if (status === 402) throw err;

      if (status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(yellow(`  Rate limited. Retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})...`));
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

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

// ── Merge facets across batches ──────────────────────────────────────────────

function mergeFacets(facets: ExtractedFacet[]): ExtractedFacet[] {
  const byName = new Map<string, ExtractedFacet>();

  for (const facet of facets) {
    const key = facet.facet_name.toLowerCase().trim();
    const existing = byName.get(key);

    if (existing) {
      existing.sentiment_breakdown.positive += facet.sentiment_breakdown.positive;
      existing.sentiment_breakdown.negative += facet.sentiment_breakdown.negative;
      existing.sentiment_breakdown.neutral += facet.sentiment_breakdown.neutral;

      // Merge quotes, deduplicate, keep 5
      const allQuotes = [...existing.representative_quotes, ...facet.representative_quotes];
      existing.representative_quotes = deduplicateQuotes(allQuotes).slice(0, 5);

      // Keep the longer summary
      if (facet.summary.length > existing.summary.length) {
        existing.summary = facet.summary;
      }
    } else {
      byName.set(key, { ...facet, sentiment_breakdown: { ...facet.sentiment_breakdown } });
    }
  }

  return Array.from(byName.values());
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
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

  const runId = args.resume ?? `facets_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

  console.log(cyan(`\n=== Facet Generation ===`));
  console.log(dim(`Run ID: ${runId}`));
  console.log(dim(`Mode: ${args.backfill ? 'backfill' : args.resume ? 'resume' : 'last 30 days'}`));
  if (args.maxCost) console.log(dim(`Max cost: $${args.maxCost.toFixed(2)}`));
  console.log('');

  // Fetch reviews
  console.log('Fetching reviews...');
  const reviewsByAsin = await fetchReviewsByAsin(
    supabase,
    args.backfill ? 'backfill' : 'recent'
  );

  // For backfill, filter out ASINs that already have facets
  if (args.backfill) {
    const processedAsins = await getProcessedAsins(supabase);
    for (const asin of processedAsins) {
      reviewsByAsin.delete(asin);
    }
    console.log(dim(`  ${processedAsins.size} ASINs already have facets`));
  }

  // For resume, filter out completed ASINs
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
  let totalFacetsFound = 0;
  let processedCount = 0;
  const asins = Array.from(reviewsByAsin.entries());

  for (const [asin, reviews] of asins) {
    processedCount++;

    // Check cost budget
    if (args.maxCost) {
      const nextBatchCost = estimateBatchCost(reviews.length);
      if (runningCost + nextBatchCost > args.maxCost) {
        console.log(yellow(`\nStopping: next ASIN would exceed max cost ($${args.maxCost.toFixed(2)})`));
        console.log(yellow(`Current spend: $${runningCost.toFixed(4)}`));
        console.log(yellow(`Resume with: npx tsx scripts/generate-facets.ts --resume ${runId}`));
        break;
      }
    }

    console.log(`[${processedCount}/${totalAsins}] Processing ASIN ${cyan(asin)} (${reviews.length} reviews)...`);

    const logId = await insertLogEntry(supabase, asin, runId, reviews.length);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let allFacets: ExtractedFacet[] = [];

    try {
      // Process in batches
      for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
        const batch = reviews.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(reviews.length / BATCH_SIZE);

        if (totalBatches > 1) {
          process.stdout.write(dim(`  Batch ${batchNum}/${totalBatches}... `));
        }

        const result = await withRetry(() => extractFacetsBatch(openai, batch));
        allFacets.push(...result.facets);
        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;

        if (totalBatches > 1) {
          console.log(dim(`${result.facets.length} facets`));
        }
      }

      // Merge facets across batches
      const mergedFacets = mergeFacets(allFacets);

      // Write to database
      const written = await upsertFacets(supabase, asin, mergedFacets);

      const cost = (totalInputTokens / 1_000_000) * INPUT_COST_PER_MTOK
        + (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
      runningCost += cost;
      totalFacetsFound += mergedFacets.length;

      await updateLogEntry(supabase, logId, 'completed', totalInputTokens + totalOutputTokens, mergedFacets.length);

      console.log(green(`  ${mergedFacets.length} facets found`) + dim(` ($${cost.toFixed(4)}, running: $${runningCost.toFixed(4)})`));

    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;
      const message = err?.message ?? String(err);

      await updateLogEntry(supabase, logId, 'failed', totalInputTokens + totalOutputTokens, 0, message);

      if (status === 402) {
        console.error(red(`\nFatal: Payment required (402). Check your OpenRouter billing.`));
      } else {
        console.error(red(`  Failed: ${message}`));
      }

      console.log(yellow(`Resume with: npx tsx scripts/generate-facets.ts --resume ${runId}`));
      process.exit(1);
    }
  }

  // Summary
  console.log(cyan(`\n=== Facet Generation Complete ===`));
  console.log(`ASINs processed: ${processedCount}`);
  console.log(`Facets found:    ${totalFacetsFound}`);
  console.log(`Total cost:      $${runningCost.toFixed(4)}`);
  console.log(`Run ID:          ${runId}\n`);
}

main().catch(err => {
  console.error(red(`Unhandled error: ${err.message}`));
  process.exit(1);
});
