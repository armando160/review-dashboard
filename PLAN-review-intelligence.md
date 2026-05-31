# Review Intelligence — Implementation Plan

Two features: **Issue Radar** (proactive) and **Review Investigator** (reactive).

---

## Architecture Overview

```
                     OFFLINE (scripts)                           ONLINE (dashboard)
              ┌───────────────────────────┐             ┌──────────────────────────────┐
              │  1. Theme Extraction      │             │  Issue Radar page            │
  reviews ──> │     (Claude API batch)    │──> Supabase │    cards, sparklines, drills │
  table       │  2. Facet Generation      │    tables   │                              │
              │     (per-product facets)  │             │  Review Investigator page    │
              └───────────────────────────┘             │    search bar + Q&A (API)    │
                                                        │    facet drill-down (DB)     │
                                                        └──────────────────────────────┘
```

Both features share a common pattern: an offline batch job writes structured AI output to Supabase, and the dashboard reads it. The one exception is the Q&A search in the Investigator, which calls Claude at query time via a Next.js API route.

---

## Part 1: Issue Radar (Proactive Issue Surfacing)

### 1A. New Supabase Tables

Create these via the Supabase SQL editor.

```sql
-- Stores AI-extracted themes ("the switch fails after 3 weeks")
CREATE TABLE issue_themes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  theme_label  TEXT NOT NULL,           -- e.g. "Switch fails after 3 weeks"
  description  TEXT,                    -- 1-2 sentence summary of what customers are saying
  category     TEXT,                    -- quality | design | durability | packaging | usability | shipping | other
  severity     TEXT DEFAULT 'medium',   -- low | medium | high | critical
  asin         TEXT NOT NULL REFERENCES products(asin),
  mention_count INT NOT NULL DEFAULT 0,
  first_seen   DATE,                   -- earliest review_date among linked reviews
  last_seen    DATE,                   -- most recent review_date among linked reviews
  status       TEXT DEFAULT 'active',  -- active | acknowledged | resolved
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Junction table linking themes to their source reviews
CREATE TABLE issue_theme_reviews (
  theme_id     BIGINT NOT NULL REFERENCES issue_themes(id) ON DELETE CASCADE,
  review_id    BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  relevance    TEXT,                   -- why this review is relevant (1-line excerpt or note)
  PRIMARY KEY (theme_id, review_id)
);

CREATE INDEX idx_issue_themes_asin ON issue_themes(asin);
CREATE INDEX idx_issue_themes_status ON issue_themes(status);
CREATE INDEX idx_issue_theme_reviews_review ON issue_theme_reviews(review_id);

-- Tracks which ASINs have been processed and where we left off
CREATE TABLE theme_extraction_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asin          TEXT NOT NULL,
  reviews_sent  INT NOT NULL DEFAULT 0,
  tokens_used   INT,
  themes_found  INT DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | completed | failed | skipped
  error_message TEXT,
  run_id        TEXT NOT NULL,                    -- groups all ASINs from a single script execution
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_extraction_log_run ON theme_extraction_log(run_id);
CREATE INDEX idx_extraction_log_asin ON theme_extraction_log(asin);
```

### 1B. Offline Theme Extraction Script

**File:** `review-dashboard/scripts/extract-themes.ts`

This is a standalone Node/TypeScript script run from the command line (not part of the Next.js app). It does NOT scrape Amazon — it only reads reviews already in the Supabase `reviews` table and sends them to Claude for theme analysis.

**CLI flags:**
```bash
npx tsx scripts/extract-themes.ts                    # normal run (30-day window)
npx tsx scripts/extract-themes.ts --backfill         # 12-month backfill (first run)
npx tsx scripts/extract-themes.ts --dry-run          # estimate cost, process nothing
npx tsx scripts/extract-themes.ts --max-cost 5.00    # stop before exceeding $5
npx tsx scripts/extract-themes.ts --resume <run_id>  # resume a failed/interrupted run
```

**Logic:**

1. **Determine review window:**
   - `--backfill` flag: analyze ALL reviews in the database that haven't been processed yet (not limited to 12 months). This is safe to run multiple times — it checks `issue_theme_reviews` to skip reviews already linked to themes, so as the scraper backfills more historical data, you re-run `--backfill` and it only processes the new-to-the-database reviews. Run this periodically until the scraper has finished its full catalog pass.
   - Normal mode (no flag): pull reviews from the last 30 days, or since the most recent completed run (whichever is more recent). This is for ongoing use once the catalog is stable.

2. **Generate a `run_id`** (timestamp-based, e.g. `run_2026-05-30T14:00:00`). All processing in this execution is tagged with this ID in `theme_extraction_log`.

3. **If `--resume <run_id>`:** query `theme_extraction_log` for that run_id, find ASINs with `status != 'completed'`, and only process those. Skip everything already done.

4. **Group reviews by ASIN.** For each ASIN that has 5+ reviews in the window, prepare a batch.

5. **If `--dry-run`:** print a summary (total ASINs to process, total reviews, estimated batches, estimated cost at Haiku rates) and exit without calling the API.

6. **If `--max-cost`:** estimate token cost per ASIN batch (~200 tokens/review input + ~500 tokens output). Track running cost across batches. Stop processing and print a message when the budget would be exceeded. Already-processed ASINs are committed — nothing is lost.

7. **For each ASIN, write a `theme_extraction_log` row with `status = 'pending'`** before calling Claude. On success, update to `completed`. On failure (rate limit, credit exhaustion, network error), update to `failed` with `error_message`. This makes every run resumable.

8. **Claude prompt per ASIN batch:**
   ```
   You are analyzing customer reviews for a product. Extract recurring themes —
   complaints, quality issues, feature requests, or design problems that appear
   in MULTIPLE reviews. A theme must appear in at least 2 reviews to qualify.

   Important: themes can come from ANY star rating. A 5-star review that says
   "love it but the switch is flimsy" contains a valid complaint theme.

   For each theme, return:
   - theme_label: short phrase (max 10 words) customers would recognize
   - description: 1-2 sentences explaining what customers are experiencing
   - category: one of [quality, design, durability, packaging, usability, shipping, other]
   - severity: low | medium | high | critical (based on frequency + impact)
   - review_ids: array of review IDs that mention this theme
   - relevance_notes: for each review_id, a short note on why it's relevant

   Return JSON array. If no recurring themes exist, return [].
   ```

9. **Send reviews in batches of ~50 per API call** (to stay within context limits). Each review includes: `id`, `title`, `review_text`, `rating`, `review_date`.

10. **Merge results with existing themes.** Before inserting, check if a theme with a similar `theme_label` already exists for this ASIN (case-insensitive substring match). If yes: update `mention_count`, `last_seen`, and add new review links to `issue_theme_reviews` (skip review_ids that already exist — the primary key prevents duplicates). If no: insert a new theme row + junction rows.

11. **Write to Supabase:** Insert/update `issue_themes` rows and `issue_theme_reviews` junction rows.

12. **On completion:** print a summary — ASINs processed, themes found, themes updated, estimated cost, any failures.

**Dependencies to install:**
```bash
npm install @anthropic-ai/sdk dotenv tsx
```

**Environment variables needed in `.env.local`:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Cost estimate:** With ~481 ASINs and ~50 reviews each on the 12-month backfill, that's roughly 24,000 reviews. At ~200 tokens per review and batches of 50, that's about 480 API calls. Using Claude Haiku for extraction keeps cost under $5 for the full backfill. Ongoing 30-day runs will be a fraction of that.

**Error handling:** If Claude returns HTTP 429 (rate limit), wait and retry with exponential backoff (3 attempts). If it returns 402 (out of credits) or any other fatal error, stop immediately, mark the current ASIN as `failed`, and print the resume command so the user can top up credits and continue.

### 1C. Dashboard Page — Issue Radar

**File:** `review-dashboard/app/intelligence/page.tsx`

**Add to sidebar** in `components/layout/sidebar.tsx`:
```typescript
{ href: '/intelligence', label: 'Review Intelligence', icon: Lightbulb },
```
Import `Lightbulb` from lucide-react.

**Page layout (top to bottom):**

1. **KPI row (4 cards):**
   - Active Issues (count of `status = 'active'`)
   - Critical Issues (count of `severity = 'critical'`)
   - Products Affected (count of distinct ASINs with active issues)
   - New This Month (themes with `created_at` in current month)

2. **Issue cards grid** — the main content. Each card shows:
   - **Theme label** as the title (bold, e.g. "Switch fails after 3 weeks")
   - **Product name** and **brand** (from joined `products` table)
   - **Mention count** badge
   - **Severity** badge (color-coded: red=critical, orange=high, yellow=medium, gray=low)
   - **Category** tag
   - **Monthly mentions sparkline** — a small line/bar chart showing mentions per month. Computed by grouping `issue_theme_reviews.review_id → reviews.review_date` by month.
   - **"View reviews" expandable section** — shows the linked reviews with the `relevance` excerpt highlighted

3. **Filters at top:**
   - Brand dropdown (reuse existing brand filter logic)
   - Severity dropdown
   - Category dropdown
   - Status toggle (Active / Acknowledged / Resolved)
   - Sort by: Mention count | Severity | Newest first

**Data fetching:**

Add to `lib/queries.ts`:

```typescript
export async function fetchIssueThemes(filters: {
  brands?: string[]
  severity?: string[]
  category?: string[]
  status?: string
  sortBy?: 'mentions' | 'severity' | 'newest'
}): Promise<IssueTheme[]> {
  let q = supabase
    .from('issue_themes')
    .select(`
      *,
      products!inner(product_name, brand),
      issue_theme_reviews(
        review_id,
        relevance,
        reviews(id, title, review_text, rating, review_date)
      )
    `)

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.severity?.length) q = q.in('severity', filters.severity)
  if (filters.category?.length) q = q.in('category', filters.category)
  if (filters.brands?.length) q = q.in('products.brand', filters.brands)

  // Sort
  if (filters.sortBy === 'mentions') q = q.order('mention_count', { ascending: false })
  else if (filters.sortBy === 'newest') q = q.order('created_at', { ascending: false })
  else q = q.order('mention_count', { ascending: false })

  const { data } = await q
  return (data ?? []) as IssueTheme[]
}
```

**Sparkline component:**

Create `components/charts/mention-sparkline.tsx` — a tiny Recharts `<BarChart>` (height ~40px) showing monthly mention counts. Input: array of review dates from the linked reviews. Group by month client-side.

**Types to add to `types/index.ts`:**

```typescript
export interface IssueTheme {
  id: number
  theme_label: string
  description: string | null
  category: string
  severity: string
  asin: string
  mention_count: number
  first_seen: string | null
  last_seen: string | null
  status: string
  created_at: string
  product_name?: string | null
  brand?: string | null
  reviews?: Array<{
    id: number
    title: string | null
    review_text: string | null
    rating: number
    review_date: string
    relevance: string | null
  }>
}
```

---

## Part 2: Review Investigator (Reactive Analysis)

This is a new page with two tabs: **Ask** (Option A — Q&A search) and **Explore** (Option B — faceted drill-down).

### 2A. Tab 1: Ask (Q&A Search)

**How it works:** User types a question → Next.js API route searches Supabase for relevant reviews → sends them to Claude with the question → streams a response back.

**API Route:** `review-dashboard/app/api/ask-reviews/route.ts`

```typescript
// POST { question: string, brands?: string[], asins?: string[] }
// Returns: streaming text response from Claude
```

**Logic:**

1. Parse the question from the request body.
2. Search for relevant reviews using a combination of:
   - Full-text search on `review_text` and `title` using Supabase `.textSearch()` or `.ilike()` with key terms extracted from the question
   - Filter by brand/ASIN if provided
   - Limit to 100 most relevant reviews
3. Send to Claude with this prompt:
   ```
   You are a review analyst for an ecommerce company. Answer the user's question
   based ONLY on the customer reviews provided below. Cite specific reviews by
   their ID when making claims. If the reviews don't contain enough information
   to answer, say so.

   Question: {question}

   Reviews:
   {reviews formatted as ID | Rating | Date | Title | Text}
   ```
4. Stream the response back to the client using the Anthropic SDK's streaming API.

**Frontend component:** `components/intelligence/ask-panel.tsx`

- Text input with a submit button
- Optional brand/ASIN filter dropdowns
- Response area that streams in markdown-formatted text
- "Sources" section below the response showing the cited reviews (clickable to expand full text)

**Cost consideration:** Each query sends ~100 reviews (~20k tokens input). Using Claude Haiku, that's ~$0.005 per query. Very cheap. Could use Sonnet for better quality at ~$0.06 per query — still fine for occasional executive use. Start with Haiku, add a model toggle later if needed.

**Full-text search improvement (optional but recommended):**

Add a GIN index to Supabase for faster text search:
```sql
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(review_text, ''))) STORED;

CREATE INDEX idx_reviews_search ON reviews USING GIN(search_vector);
```

This enables PostgreSQL full-text search instead of slow `ILIKE` queries.

### 2B. Tab 2: Explore (Faceted Drill-Down)

**How it works:** Pre-generated facets per product are stored in Supabase. When a user clicks into a product, they see the facets with sentiment breakdowns.

**New Supabase table:**

```sql
CREATE TABLE product_facets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asin          TEXT NOT NULL REFERENCES products(asin),
  facet_name    TEXT NOT NULL,          -- e.g. "Timer", "Build Quality", "Noise Level", "Size/Fit"
  facet_type    TEXT DEFAULT 'feature', -- feature | experience | comparison
  positive_count INT DEFAULT 0,
  negative_count INT DEFAULT 0,
  neutral_count  INT DEFAULT 0,
  total_mentions INT DEFAULT 0,
  summary       TEXT,                   -- AI-generated 1-2 sentence summary of what people say
  representative_quotes JSONB,          -- Array of { review_id, quote, sentiment }
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asin, facet_name)
);

CREATE INDEX idx_product_facets_asin ON product_facets(asin);
```

**Offline facet generation script:** `review-dashboard/scripts/generate-facets.ts`

Same resilience pattern as `extract-themes.ts`: supports `--dry-run`, `--max-cost`, `--resume <run_id>`, logs progress to `theme_extraction_log` (reuses the same table with a different `run_id` prefix like `facets_2026-05-30T14:00:00`).

1. For each ASIN with 10+ reviews, pull all reviews.
2. Send to Claude with this prompt:
   ```
   Analyze these customer reviews and identify the key FACETS (specific features,
   aspects, or experiences) that customers discuss. For each facet:
   - facet_name: short label (1-3 words)
   - facet_type: feature | experience | comparison
   - sentiment_breakdown: { positive: N, negative: N, neutral: N }
   - summary: 1-2 sentences on what customers generally say
   - representative_quotes: 3-5 short quotes (under 20 words each) with review_id and sentiment

   Return 5-15 facets per product, ordered by total mentions.
   ```
3. Write results to `product_facets` table.

**Frontend layout:**

The Explore tab shows:

1. **Product selector** — dropdown or search to pick a product/ASIN
2. **Facet cards grid** — each card shows:
   - Facet name (e.g. "Timer", "Noise Level")
   - Sentiment bar (horizontal stacked bar: green/gray/red proportional to positive/neutral/negative)
   - Total mentions count
   - AI-generated summary
   - Expandable quotes section with sentiment-colored badges
3. **Facet comparison** (stretch goal) — select two products to compare facets side by side

**Data fetching:**

```typescript
export async function fetchProductFacets(asin: string): Promise<ProductFacet[]> {
  const { data } = await supabase
    .from('product_facets')
    .select('*')
    .eq('asin', asin)
    .order('total_mentions', { ascending: false })
  return (data ?? []) as ProductFacet[]
}
```

---

## Page Structure

**New route:** `review-dashboard/app/intelligence/page.tsx`

This single page has three sections/tabs:

```
┌─────────────────────────────────────────────────────────────┐
│  Review Intelligence                                        │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │  Issue Radar │   Explore    │     Ask      │             │
│  └──────────────┴──────────────┴──────────────┘             │
│                                                             │
│  [Content for selected tab]                                 │
└─────────────────────────────────────────────────────────────┘
```

Use the existing `Tabs` component from `components/ui/tabs.tsx`.

---

## New Files to Create

```
review-dashboard/
├── app/
│   ├── intelligence/
│   │   └── page.tsx              ← Main page with 3 tabs
│   └── api/
│       └── ask-reviews/
│           └── route.ts          ← Claude Q&A streaming endpoint
├── components/
│   └── intelligence/
│       ├── issue-radar.tsx       ← Issue cards grid + filters
│       ├── issue-card.tsx        ← Single issue theme card
│       ├── ask-panel.tsx         ← Q&A search interface
│       ├── explore-panel.tsx     ← Faceted drill-down interface
│       ├── facet-card.tsx        ← Single facet card
│       └── mention-sparkline.tsx ← Tiny monthly bar chart
├── scripts/
│   ├── extract-themes.ts        ← Offline theme extraction (Claude API)
│   └── generate-facets.ts       ← Offline facet generation (Claude API)
└── (existing files to modify)
    ├── components/layout/sidebar.tsx  ← Add nav item
    ├── lib/queries.ts                 ← Add fetch functions
    └── types/index.ts                 ← Add new types
```

---

## Existing Files to Modify

1. **`components/layout/sidebar.tsx`** — Add `{ href: '/intelligence', label: 'Review Intelligence', icon: Lightbulb }` to `navItems` array. Import `Lightbulb` from lucide-react.

2. **`lib/queries.ts`** — Add `fetchIssueThemes()` and `fetchProductFacets()` functions as described above.

3. **`types/index.ts`** — Add `IssueTheme`, `ProductFacet`, and related interfaces.

4. **`package.json`** — Add `@anthropic-ai/sdk` dependency for the API route and scripts.

5. **`.env.local`** — Add `ANTHROPIC_API_KEY`.

---

## Implementation Order

### Phase 1: Database + Scripts (do first — dashboard needs data)
1. Run the SQL to create `issue_themes`, `issue_theme_reviews`, `product_facets` tables
2. Create `scripts/extract-themes.ts` — the 12-month backfill script
3. Create `scripts/generate-facets.ts` — the facet generation script
4. Run both scripts to populate the tables

### Phase 2: Issue Radar tab
5. Add types to `types/index.ts`
6. Add `fetchIssueThemes()` to `lib/queries.ts`
7. Create `mention-sparkline.tsx` component
8. Create `issue-card.tsx` component
9. Create `issue-radar.tsx` component (grid + filters)
10. Create `app/intelligence/page.tsx` with tabs (Issue Radar active first)
11. Add sidebar nav item

### Phase 3: Explore tab (second tab — faceted drill-down)
12. Add `fetchProductFacets()` to `lib/queries.ts`
13. Create `facet-card.tsx` component
14. Create `explore-panel.tsx` component
15. Wire into the Explore tab (appears as second tab after Issue Radar)

### Phase 4: Ask tab (third tab — Q&A search)
16. Add full-text search index to Supabase (the `search_vector` column + GIN index)
17. Install `@anthropic-ai/sdk`, create `app/api/ask-reviews/route.ts`
18. Create `ask-panel.tsx` component with streaming UI
19. Wire into the Ask tab (appears as third/last tab)

---

## Technical Notes for Implementation

- **Supabase client** is already configured at `lib/supabase.ts` — use the same client for new queries.
- **All pages are `'use client'`** in this codebase — follow the same pattern.
- **Filters:** The Issue Radar tab uses its OWN local filters (severity, category, status), not the global `useFilters()` context, because global filters (date range, brand, star rating) don't map cleanly to pre-computed themes. Brand filter can be shared.
- **Styling:** Use Tailwind classes consistent with existing components. Card style: `bg-card border border-border rounded-lg p-4`. Text: `text-foreground`, `text-muted-foreground`.
- **Charts:** Use Recharts (already installed) for the sparkline. A tiny `<BarChart>` with no axes, just bars.
- **Streaming:** The Ask tab uses `fetch()` with `ReadableStream` to stream Claude's response. The API route uses the Anthropic SDK's `.stream()` method and returns a `ReadableStream`.
- **AGENTS.md warns** about Next.js API changes — read `node_modules/next/dist/docs/` before writing the API route for `ask-reviews`.
- **Scripts** should be run with `npx tsx scripts/extract-themes.ts` — they are standalone and not part of the Next.js build.
