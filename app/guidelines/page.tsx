import { Header } from '@/components/layout/header'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Rule({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 text-sm">
      <span className="font-medium text-muted-foreground pt-0.5 leading-snug">{label}</span>
      <span className="text-foreground leading-relaxed">{children}</span>
    </div>
  )
}

export default function GuidelinesPage() {
  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Guidelines"
        description="How every chart is built and what the AI pipeline is doing"
      />
      <div className="flex-1 p-6 max-w-4xl space-y-10">

        {/* ── LLM Pipeline ──────────────────────────────────────────────────── */}
        <Section title="AI Classification Pipeline">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every review is passed through a large-language-model (LLM) pipeline that assigns two
            labels: <strong>sentiment</strong> and <strong>review category</strong>. The pipeline
            runs automatically four times per day alongside scraping. Reviews show "Not processed"
            until the pipeline reaches them — the backlog drains newest-first, so recent reviews
            are labeled before older ones.
          </p>

          <div className="space-y-2 mt-2">
            <Rule label="Model order">
              OpenRouter (Claude Haiku) → Gemini 2.5 Flash → Groq Llama 3.3 70B. The pipeline
              tries each provider in order and moves on only if the previous one fails or returns a
              low-confidence result.
            </Rule>
            <Rule label="Confidence threshold">
              A classification is accepted only if the model returns a confidence score ≥ 0.60 (60%).
              Results below this threshold are treated as unclassified and may be retried by the
              next provider.
            </Rule>
            <Rule label="Sentiment labels">
              <strong>Positive</strong> — the reviewer is satisfied overall.{' '}
              <strong>Negative</strong> — the reviewer expresses dissatisfaction or a clear
              problem. <strong>Neutral</strong> — informational or mixed without a dominant tone.
            </Rule>
            <Rule label="What the model reads">
              The review <em>title</em> and <em>body text</em> only. Star rating is not fed to
              the model — a 5-star review can be classified negative if the text is critical, and
              vice-versa.
            </Rule>
            <Rule label="Not processed">
              Reviews with a blank Category or Sentiment column have not yet been through the LLM
              pipeline. This is normal during the initial backlog phase. All reviews will be
              classified within a few days as the pipeline cycles through them.
            </Rule>
          </div>
        </Section>

        {/* ── Review Categories ──────────────────────────────────────────────── */}
        <Section title="Review Categories">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The LLM assigns each review to exactly one of six categories based on the primary
            topic of the review text.
          </p>
          <div className="space-y-2 mt-2">
            <Rule label="Product Quality">
              Physical durability, materials, build quality, defects, or product arrived broken /
              stopped working.
            </Rule>
            <Rule label="Usability & Design">
              Ease of use, ergonomics, instructions, setup, size/fit, aesthetics, or how the
              product functions in practice.
            </Rule>
            <Rule label="Value">
              Price relative to quality, perceived worth, whether the product is worth the money,
              or comparisons to competitors on price.
            </Rule>
            <Rule label="Customer Service">
              Interactions with support, warranty claims, response time, helpfulness of agents, or
              resolution of complaints.
            </Rule>
            <Rule label="Fulfillment">
              Shipping speed, packaging condition on arrival, missing items, wrong item sent, or
              delivery experience.
            </Rule>
            <Rule label="Other">
              Reviews that don't fit the above categories, or where the primary topic is
              ambiguous.
            </Rule>
          </div>
        </Section>

        {/* ── Executive Overview ────────────────────────────────────────────── */}
        <Section title="Executive Overview Charts">
          <div className="space-y-2">
            <Rule label="Total Reviews">
              Count of reviews in the selected date range. The delta badge compares against the
              immediately preceding period of equal length (e.g. if the range is 30 days, the
              prior 30 days are used).
            </Rule>
            <Rule label="Avg Rating">
              Simple mean of all star ratings (1–5) across every review in the date range. Not
              weighted by product volume.
            </Rule>
            <Rule label="Positive Sentiment %">
              Of all classified reviews in the range, the percentage labelled positive. Reviews
              still showing "Not processed" are excluded from this calculation.
            </Rule>
            <Rule label="Negative Sentiment %">
              Same as above for negative reviews. A rising percentage is highlighted red because
              increasing negative sentiment is a signal requiring attention.
            </Rule>
            <Rule label="Review Velocity">
              Stacked bar chart showing how many reviews arrived per period (day / week / month),
              broken out by brand. The line overlay shows the total across all brands.{' '}
              <strong>Important:</strong> while the backlog is being processed, historical reviews
              are being ingested in bulk. The velocity chart will reflect actual incoming review
              cadence only after the backlog clears (estimated 4–5 days from launch).
            </Rule>
            <Rule label="Rating Evolution by Brand">
              For each period and brand, the average star rating of all reviews that fall in that
              window. The amber dashed line marks 4.0 (watch threshold) and the green dashed line
              marks 4.5 (healthy target). A brand dropping below 4.0 deserves immediate attention.
            </Rule>
          </div>
        </Section>

        {/* ── Category Intelligence ─────────────────────────────────────────── */}
        <Section title="Category Intelligence Charts">
          <div className="space-y-2">
            <Rule label="Category Breakdown">
              Horizontal stacked bar showing positive / neutral / negative review counts for each
              of the six categories. Sorted by total volume so the highest-impact categories
              appear first.
            </Rule>
            <Rule label="Brand × Category Heatmap">
              Each cell shows the positive sentiment percentage for one brand–category
              combination. Red cells indicate a high proportion of negative reviews in that
              category for that brand. Use this to identify which specific brand has a problem in
              which specific area (e.g. LifePro + Fulfillment = red → shipping issue specific to
              that brand).
            </Rule>
          </div>
        </Section>

        {/* ── Product Analysis ──────────────────────────────────────────────── */}
        <Section title="Product Analysis Charts">
          <div className="space-y-2">
            <Rule label="Rating vs. Volume Scatter">
              Each dot is one ASIN. X-axis = number of reviews (log scale); Y-axis = average
              rating. High-volume, low-rating products in the bottom-right are your highest-risk
              items — they have many customers talking and the feedback is bad.
            </Rule>
            <Rule label="Rating Distribution">
              Histogram of how many reviews landed at each star level (1–5) across the filtered
              set. A healthy portfolio skews heavily toward 5-star. A spike at 1-star against an
              otherwise healthy distribution often signals a single bad batch or a fulfillment
              event.
            </Rule>
            <Rule label="Top / Bottom ASINs">
              Ranked lists of ASINs by average star rating in the selected period.{' '}
              <em>Top Rating</em> shows your best performers; <em>Bottom Rating</em> shows the
              ones needing attention and lists their dominant negative category so you know what
              to address; <em>Top Volume</em> shows the ASINs with the most reviews regardless of
              rating.
            </Rule>
          </div>
        </Section>

        {/* ── Review Drill-Down ─────────────────────────────────────────────── */}
        <Section title="Review Drill-Down">
          <div className="space-y-2">
            <Rule label="Product & Brand columns">
              Product name and brand are pulled from Monday.com via the brand sync that runs at
              the start of each pipeline cycle. If a product shows no name, it hasn't been synced
              yet or wasn't found on the board.
            </Rule>
            <Rule label="Rating column">
              The raw star rating (1–5) submitted by the reviewer on Woot.
            </Rule>
            <Rule label="Category & Sentiment columns">
              Assigned by the LLM pipeline. "Not processed" means the pipeline hasn't reached
              this review yet — it will be labeled automatically within the next few cycles.
            </Rule>
            <Rule label="Expand button">
              Click the arrow button at the right of any row to reveal the full review text,
              verified purchase status, Vine review flag, and helpful vote count.
            </Rule>
            <Rule label="Export CSV">
              Downloads all reviews matching the current filters (not just the visible page) to a
              CSV file for further analysis in Excel or Google Sheets.
            </Rule>
          </div>
        </Section>

        {/* ── Scraping & Data Freshness ─────────────────────────────────────── */}
        <Section title="Data Freshness & Scraping">
          <div className="space-y-2">
            <Rule label="Scrape frequency">
              The pipeline runs 4 times per day: 12 AM, 6 AM, 12 PM, and 6 PM Eastern. Each run
              processes up to 30 ASINs.
            </Rule>
            <Rule label="Scrape tiers">
              ASINs are prioritized by rating. Low-rated products (below 4.0) are refreshed every
              24 hours (Tier 1). Mid-range (4.0–4.5) every 48 hours (Tier 2). Good (4.5–4.7)
              every 72 hours (Tier 3). Top performers (above 4.7) every 96 hours (Tier 4). This
              ensures monitoring resources focus on products most at risk.
            </Rule>
            <Rule label="Coverage">
              With 460 ASINs across tiers and 120 ASINs processed per day (30 × 4 runs), the full
              catalog cycles roughly every 4 days on average. Higher-tier products cycle faster.
            </Rule>
            <Rule label="Historical data">
              The scraper captures the review history available on Woot at the time of first
              scrape. Reviews posted before scraping began are included. Reviews that have been
              removed from Woot will not appear.
            </Rule>
          </div>
        </Section>

      </div>
    </div>
  )
}
