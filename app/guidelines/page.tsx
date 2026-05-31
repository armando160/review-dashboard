'use client'

import { Header } from '@/components/layout/header'

const SECTIONS = [
  { id: 'ai-pipeline',      label: 'AI Pipeline' },
  { id: 'categories',       label: 'Review Categories' },
  { id: 'executive',        label: 'Executive Overview' },
  { id: 'category-intel',   label: 'Category Intelligence' },
  { id: 'product-analysis', label: 'Product Analysis' },
  { id: 'drill-down',       label: 'Review Drill-Down' },
  { id: 'data-freshness',   label: 'Data Freshness' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-6">
      <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 text-sm">
      <span className="font-medium text-muted-foreground pt-0.5 leading-snug">{label}</span>
      <span className="text-foreground leading-relaxed">{children}</span>
    </div>
  )
}

export default function GuidelinesPage() {
  return (
    <div className="flex flex-col min-h-full">
      <Header title="Guidelines" description="How every chart is built and what the AI pipeline does" showFilters={false} />
      <div className="flex-1 p-4 md:p-6 max-w-4xl space-y-8 md:space-y-10">

        {/* ── Table of contents ──────────────────────────────────────────────── */}
        <nav className="flex flex-wrap gap-2">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* ── AI Pipeline ────────────────────────────────────────────────────── */}
        <Section id="ai-pipeline" title="AI Classification Pipeline">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every review is automatically assigned a <strong>sentiment</strong> (Positive / Negative / Neutral)
            and a <strong>category</strong> by an AI model. The pipeline runs four times daily alongside scraping.
            Reviews show "Not processed" until the pipeline reaches them — recent reviews are labeled before older ones.
          </p>
          <div className="space-y-2 mt-2">
            <Row label="Confidence threshold">
              A result is accepted only if the model's confidence is ≥ 60%. Lower-confidence results are retried.
            </Row>
            <Row label="Sentiment labels">
              <strong>Positive</strong> — satisfied overall.{' '}
              <strong>Negative</strong> — clear dissatisfaction or problem.{' '}
              <strong>Neutral</strong> — informational or mixed tone.
            </Row>
            <Row label="Star rating vs. text">
              Star rating is <em>not</em> fed to the model. A 5-star review can be marked negative if the
              text is critical — and vice-versa.
            </Row>
            <Row label="Not processed">
              Pipeline hasn't reached that review yet. Normal during backlog phase — all reviews are analyzed
              within a few days.
            </Row>
          </div>
        </Section>

        {/* ── Review Categories ──────────────────────────────────────────────── */}
        <Section id="categories" title="Review Categories">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Each review is assigned to exactly one category based on the primary topic of the text.
          </p>
          <div className="space-y-2 mt-2">
            <Row label="Product Quality">Durability, materials, defects, or product stopped working.</Row>
            <Row label="Usability & Design">Ease of use, setup, ergonomics, size/fit, or how it works in practice.</Row>
            <Row label="Value">Price relative to quality, or comparisons to competitors.</Row>
            <Row label="Customer Service">Support interactions, warranty, response time, issue resolution.</Row>
            <Row label="Fulfillment">Shipping speed, packaging damage, missing or wrong items.</Row>
            <Row label="Other">Doesn't clearly fit the above categories.</Row>
          </div>
        </Section>

        {/* ── Executive Overview ────────────────────────────────────────────── */}
        <Section id="executive" title="Executive Overview">
          <div className="space-y-2">
            <Row label="Total Reviews">Count in the selected date range. Delta compares to the prior equal-length period.</Row>
            <Row label="Avg Rating">Mean star rating (1–5) across all reviews in range. Not weighted by product volume.</Row>
            <Row label="Positive / Negative %">
              Share of analyzed reviews labeled positive or negative. "Not processed" reviews are excluded.
              Rising negative % is flagged red.
            </Row>
            <Row label="Review Velocity">
              Stacked bar by brand showing review arrivals per period, with a total line overlay. Click brand
              pills to show/hide individual brands.
            </Row>
            <Row label="Rating Evolution">
              Average star rating per brand per period. Amber dashed line = 4.0 (watch threshold);
              green = 4.5 (healthy target). Below 4.0 requires immediate attention.
            </Row>
          </div>
        </Section>

        {/* ── Category Intelligence ─────────────────────────────────────────── */}
        <Section id="category-intel" title="Category Intelligence">
          <div className="space-y-2">
            <Row label="Category Breakdown">
              Stacked bar showing positive / neutral / negative counts per category, sorted by total volume.
            </Row>
            <Row label="Brand × Category Heatmap">
              Each cell = positive sentiment % for one brand + category combo. Red = high negative rate.
              Use it to find which brand has a problem in which specific area (e.g. Lifepro + Fulfillment).
            </Row>
          </div>
        </Section>

        {/* ── Product Analysis ──────────────────────────────────────────────── */}
        <Section id="product-analysis" title="Product Analysis">
          <div className="space-y-2">
            <Row label="Rating vs. Volume Scatter">
              Each dot = one ASIN. High-volume, low-rating (bottom-right) = highest-risk products.
            </Row>
            <Row label="Rating Distribution">
              Histogram of star levels across the filtered set. A spike at 1-star against an otherwise
              healthy distribution often signals a single bad batch or a fulfillment event.
            </Row>
            <Row label="Top / Bottom ASINs">
              Ranked by average rating. Bottom Rating includes the dominant negative category so you
              know what to address. Top Volume = most-reviewed regardless of rating.
            </Row>
          </div>
        </Section>

        {/* ── Review Drill-Down ─────────────────────────────────────────────── */}
        <Section id="drill-down" title="Review Drill-Down">
          <div className="space-y-2">
            <Row label="Category & Sentiment">
              Assigned by the AI pipeline. "Not processed" = pipeline hasn't reached this review yet.
            </Row>
            <Row label="Expand row">
              Click the arrow to reveal full review text, verified purchase status, Vine flag, and helpful votes.
            </Row>
            <Row label="Export CSV">
              Downloads all reviews matching current filters (not just the visible page) for use in Excel or Sheets.
            </Row>
          </div>
        </Section>

        {/* ── Data Freshness ────────────────────────────────────────────────── */}
        <Section id="data-freshness" title="Data Freshness & Scraping">
          <div className="space-y-2">
            <Row label="Run frequency">4× per day (12 AM, 6 AM, 12 PM, 6 PM Eastern). Up to 30 ASINs per run.</Row>
            <Row label="Priority tiers">
              Products rated below 4.0 refresh every 24 h. 4.0–4.5 every 48 h. 4.5–4.7 every 72 h.
              Above 4.7 every 96 h. Worst products get the most attention.
            </Row>
            <Row label="Full catalog cycle">~4 days on average across all 460 ASINs.</Row>
            <Row label="Historical data">
              Captures review history available on Woot at time of first scrape. Removed reviews won't appear.
            </Row>
          </div>
        </Section>

      </div>
    </div>
  )
}
