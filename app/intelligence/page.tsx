'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { BRAND_COLORS, ALL_BRANDS } from '@/lib/utils'
import {
  fetchPortfolioSnapshots,
  fetchProductDrilldown,
} from '@/lib/intelligence-queries'
import type {
  ProductSnapshot,
  CategoryStat,
  MonthlyNeg,
  NegativeReview,
} from '@/lib/intelligence-queries'
import type { AnalysisTheme } from '@/app/api/analyze/route'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  X,
  RefreshCw,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'Product Quality':   '#ef4444',
  'Usability & Design': '#f97316',
  'Value':             '#eab308',
  'Customer Service':  '#3b82f6',
  'Fulfillment':       '#8b5cf6',
  'Other':             '#6b7280',
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#6b7280'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMonth(yyyyMM: string) {
  const [y, m] = yyyyMM.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function borderAccent(negPct: number, classified: number) {
  if (classified === 0) return 'border-border'
  if (negPct >= 30) return 'border-red-500'
  if (negPct >= 18) return 'border-yellow-500'
  return 'border-green-500'
}

function negBadge(negPct: number, classified: number) {
  if (classified === 0) return 'bg-muted text-muted-foreground'
  if (negPct >= 30) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
  if (negPct >= 18) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
  return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-500 text-xs tracking-tighter">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

// ── Product card (overview grid) ──────────────────────────────────────────────

function ProductCard({ s, onClick }: { s: ProductSnapshot; onClick: () => void }) {
  const border  = borderAccent(s.negative_pct, s.classified)
  const badge   = negBadge(s.negative_pct, s.classified)
  const bColor  = BRAND_COLORS[s.brand ?? ''] ?? '#888'
  const topCats = s.categories.filter(c => c.negative > 0).slice(0, 3)

  return (
    <button
      onClick={onClick}
      className={`text-left w-full border-2 ${border} rounded-lg bg-card shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 p-4 flex flex-col gap-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: bColor }} />
          <span className="text-xs font-semibold truncate" style={{ color: bColor }}>{s.brand ?? 'Unknown'}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{s.asin}</span>
      </div>

      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
        {s.product_name ?? s.asin}
      </p>

      <div className="flex items-center flex-wrap gap-1.5">
        {s.classified > 0 ? (
          <>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${badge}`}>
              {s.negative_pct}% neg
            </span>
            <span className="text-xs text-muted-foreground">
              {s.negative_count.toLocaleString()} of {s.classified.toLocaleString()} analyzed
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">Not yet analyzed</span>
        )}
      </div>

      {topCats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topCats.map(c => (
            <span
              key={c.category}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: catColor(c.category) + '22', color: catColor(c.category) }}
            >
              {c.category} · {c.negative}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

// ── Category complaint card (drilldown) ───────────────────────────────────────

function CategoryCard({ stat, totalNeg }: { stat: CategoryStat; totalNeg: number }) {
  const [expanded, setExpanded] = useState(false)
  const color    = catColor(stat.category)
  const barWidth = totalNeg > 0 ? Math.min(100, (stat.negative / totalNeg) * 100) : 0

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-sm font-semibold text-foreground">{stat.category}</span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold leading-none" style={{ color }}>{stat.negative}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">complaints</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{stat.shareOfAllNeg}% of all complaints</span>
            <span>{stat.negativePct}% neg rate</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: color }} />
          </div>
        </div>

        <div className="flex gap-3 text-xs">
          <span className="text-green-600 font-medium">+{stat.positive} pos</span>
          <span className="text-muted-foreground">{stat.neutral} neu</span>
          <span className="font-medium" style={{ color }}>{stat.negative} neg</span>
        </div>

        {stat.sampleQuotes.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Complaints ({stat.sampleQuotes.length})
            </p>
            {stat.sampleQuotes.slice(0, expanded ? undefined : 3).map(q => (
              <div key={q.id} className="p-2.5 bg-muted/40 rounded-md space-y-1">
                <div className="flex items-center gap-1.5">
                  <Stars rating={q.rating} />
                  <span className="text-[10px] text-muted-foreground">{fmtDate(q.date)}</span>
                </div>
                {q.text
                  ? <p className="text-xs text-foreground leading-relaxed line-clamp-3">&ldquo;{q.text}&rdquo;</p>
                  : <p className="text-xs text-muted-foreground italic">(no text)</p>
                }
              </div>
            ))}
            {stat.sampleQuotes.length > 3 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Show fewer' : `View all ${stat.sampleQuotes.length} reviews`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Monthly trend chart ────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: MonthlyNeg[] }) {
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set())

  const toggleCat = (cat: string) =>
    setHiddenCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })

  if (trend.length === 0) return null
  const cats = Array.from(
    new Set(trend.flatMap(d => Object.keys(d).filter(k => k !== 'month')))
  ).sort()

  const visibleCats = cats.filter(c => !hiddenCats.has(c))

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tickFormatter={fmtMonth}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <RechartsTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  padding: '8px 12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}>
                  <p style={{ marginBottom: 4, fontWeight: 600, color: '#0f172a' }}>
                    {typeof label === 'string' ? fmtMonth(label) : String(label)}
                  </p>
                  {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color, margin: '2px 0' }}>
                      {p.name}: {p.value}
                    </p>
                  ))}
                </div>
              )
            }}
          />
          {cats.map((cat, idx) =>
            hiddenCats.has(cat) ? null : (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="a"
                fill={catColor(cat)}
                radius={idx === visibleCats.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
              />
            )
          )}
        </BarChart>
      </ResponsiveContainer>

      {/* Toggleable category pills */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {cats.map(cat => {
          const color = catColor(cat)
          const hidden = hiddenCats.has(cat)
          return (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                borderColor: hidden ? '#e2e8f0' : color,
                backgroundColor: hidden ? 'transparent' : `${color}22`,
                color: hidden ? '#94a3b8' : color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: hidden ? '#cbd5e1' : color }}
              />
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── AI analysis panel ─────────────────────────────────────────────────────────

function AiPanel({ snapshot, negatives }: { snapshot: ProductSnapshot; negatives: NegativeReview[] }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'no-key' | 'no-credits'>('idle')
  const [themes, setThemes] = useState<AnalysisTheme[]>([])
  const [errMsg, setErrMsg] = useState('')
  const [analyzedCount, setAnalyzedCount] = useState(0)

  const reviewsToSend = negatives.slice(0, 60)
  const hasEnoughReviews = reviewsToSend.length >= 5

  async function run() {
    setStatus('loading')
    setAnalyzedCount(reviewsToSend.length)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asin: snapshot.asin,
          productName: snapshot.product_name ?? snapshot.asin,
          reviews: reviewsToSend.map(r => ({
            id: r.id,
            text: r.review_text,
            rating: r.rating,
            category: r.review_category,
            date: r.review_date,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 503) { setStatus('no-key'); return }
        if (res.status === 402) { setStatus('no-credits'); return }
        setErrMsg(data.error ?? 'Unknown error')
        setStatus('error')
        return
      }
      setThemes(data.themes ?? [])
      setStatus('done')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  const sev = (s: string) =>
    s === 'high'   ? 'bg-red-100 text-red-700'
    : s === 'medium' ? 'bg-yellow-100 text-yellow-700'
    : 'bg-muted text-muted-foreground'

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border pb-2">
        AI Deep Analysis
      </h2>
      <Card>
        <CardContent className="pt-4">

          {/* Not enough reviews */}
          {!hasEnoughReviews && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Not enough data</p>
                <p className="text-xs text-muted-foreground">
                  AI analysis needs at least 5 negative reviews to identify patterns.
                  This product has {reviewsToSend.length} — check back once more reviews have been analyzed.
                </p>
              </div>
            </div>
          )}

          {hasEnoughReviews && status === 'idle' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Find specific complaint patterns with AI</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends {reviewsToSend.length} negative reviews to Claude and surfaces specific recurring issues — more granular than the category breakdown above.
                </p>
              </div>
              <button
                onClick={run}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                Analyze with AI
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex items-center gap-3 py-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Analyzing {analyzedCount} reviews — this takes about 10–20 seconds…
              </span>
            </div>
          )}

          {status === 'no-key' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-amber-800">AI not configured</p>
                <p className="text-xs text-amber-700">
                  Add <code className="bg-amber-100 px-1 rounded">OPENROUTER_API_KEY</code> to your environment variables and redeploy.
                </p>
              </div>
            </div>
          )}

          {status === 'no-credits' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-red-800">Out of AI credits</p>
                <p className="text-xs text-red-700">
                  Your OpenRouter balance is depleted. Top up at openrouter.ai to continue.
                </p>
                <button onClick={() => setStatus('idle')} className="text-xs text-red-600 underline mt-1">
                  Try again
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-red-800">Analysis failed</p>
                <p className="text-xs text-red-700">{errMsg || 'An unexpected error occurred. Please try again.'}</p>
                <button onClick={() => setStatus('idle')} className="text-xs text-red-600 underline mt-1">
                  Try again
                </button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {themes.length} complaint pattern{themes.length !== 1 ? 's' : ''} found
                  <span className="ml-1">· based on {analyzedCount} reviews</span>
                </p>
                <button onClick={() => { setStatus('idle'); setThemes([]) }} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Re-run
                </button>
              </div>
              {themes.map((t, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{t.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sev(t.severity)}`}>{t.severity}</span>
                      <span className="text-xs text-muted-foreground">~{t.count} reviews</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t.summary}</p>
                  {t.quotes?.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      {t.quotes.map((q, j) => (
                        <p key={j} className="text-xs text-foreground italic before:content-[open-quote] after:content-[close-quote]">{q}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>
    </section>
  )
}

// ── Drilldown view ────────────────────────────────────────────────────────────

function DrilldownView({ snapshot, onBack }: { snapshot: ProductSnapshot; onBack: () => void }) {
  const [drilldown, setDrilldown] = useState<{
    categories: CategoryStat[]
    trend: MonthlyNeg[]
    recentNegatives: NegativeReview[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchProductDrilldown(snapshot.asin)
      .then(setDrilldown)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [snapshot.asin])

  const bColor     = BRAND_COLORS[snapshot.brand ?? ''] ?? '#888'
  const negCats    = (drilldown?.categories ?? []).filter(c => c.negative > 0)
  const totalNeg   = negCats.reduce((s, c) => s + c.negative, 0)
  const topCat     = negCats[0]
  const latestNeg  = drilldown?.recentNegatives[0]

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border pb-2">
        {children}
      </h2>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Products
      </button>

      {/* Product header */}
      <div>
        <h1 className="text-xl font-bold text-foreground leading-tight mb-2">
          {snapshot.product_name ?? snapshot.asin}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: bColor + '22', color: bColor }}
          >
            {snapshot.brand}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{snapshot.asin}</span>
          {snapshot.amazon_rating && (
            <span className="text-xs text-muted-foreground">★ {snapshot.amazon_rating} on Amazon</span>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Analyzed',
            value: snapshot.classified.toLocaleString(),
            sub: snapshot.total_reviews > 0
              ? `${Math.round((snapshot.classified / snapshot.total_reviews) * 100)}% of ${snapshot.total_reviews.toLocaleString()} Amazon reviews`
              : 'total analyzed reviews',
            accent: '',
          },
          {
            label: 'Negative',
            value: snapshot.negative_count.toLocaleString(),
            sub: `${snapshot.negative_pct}% of analyzed`,
            accent: snapshot.negative_pct >= 30
              ? 'text-red-500'
              : snapshot.negative_pct >= 18 ? 'text-yellow-600' : 'text-green-600',
          },
          {
            label: 'Top Complaint',
            value: topCat?.category ?? (loading ? '…' : 'None'),
            sub: topCat ? `${topCat.negative} reviews · ${topCat.negativePct}% neg` : undefined,
            accent: 'text-base font-semibold',
          },
          {
            label: 'Last Negative',
            value: latestNeg ? timeAgo(latestNeg.review_date) : (loading ? '…' : '—'),
            sub: latestNeg ? fmtDate(latestNeg.review_date) : undefined,
            accent: '',
          },
        ].map(({ label, value, sub, accent }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">{label}</p>
              <p className={`text-2xl font-bold mb-0.5 ${accent || 'text-foreground'}`}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category breakdown */}
      {loading ? (
        <div className="h-48 animate-pulse bg-muted rounded-lg" />
      ) : negCats.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Complaint Breakdown by Category</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {negCats.map(c => (
              <CategoryCard key={c.category} stat={c} totalNeg={totalNeg} />
            ))}
          </div>
        </section>
      ) : (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            {snapshot.classified === 0
              ? 'No reviews have been analyzed for this product yet.'
              : 'No negative reviews found among analyzed reviews.'}
          </CardContent>
        </Card>
      )}

      {/* Trend chart */}
      {!loading && drilldown && drilldown.trend.length > 1 && (
        <section className="space-y-3">
          <SectionTitle>Complaint Trend — Last 12 Months</SectionTitle>
          <Card>
            <CardContent className="pt-4">
              <TrendChart trend={drilldown.trend} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* AI panel — above recent reviews so it's not missed */}
      {!loading && drilldown && (
        <AiPanel snapshot={snapshot} negatives={drilldown.recentNegatives} />
      )}

      {/* Recent negatives table */}
      {!loading && drilldown && drilldown.recentNegatives.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Recent Negative Reviews</SectionTitle>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-muted-foreground font-medium">Date</th>
                      <th className="text-left p-2 text-muted-foreground font-medium w-20">Rating</th>
                      <th className="text-left p-2 text-muted-foreground font-medium w-32">Category</th>
                      <th className="text-left p-2 text-muted-foreground font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.recentNegatives.map(r => (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20 align-top">
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{fmtDate(r.review_date)}</td>
                        <td className="p-2"><Stars rating={r.rating} /></td>
                        <td className="p-2">
                          {r.review_category
                            ? <span className="px-1.5 py-0.5 rounded-full font-medium text-[10px]"
                                style={{ background: catColor(r.review_category) + '22', color: catColor(r.review_category) }}>
                                {r.review_category}
                              </span>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="p-2 max-w-md">
                          {r.title && <p className="font-medium text-foreground mb-0.5">{r.title}</p>}
                          {r.review_text
                            ? <p className="text-muted-foreground line-clamp-2 leading-relaxed">{r.review_text}</p>
                            : <span className="text-muted-foreground italic">No text</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

// ── Overview grid (main page) ──────────────────────────────────────────────────

type SortKey = 'complaints' | 'risk' | 'least-data'

export default function IntelligencePage() {
  const [snapshots, setSnapshots]   = useState<ProductSnapshot[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [brand, setBrand]           = useState<string | null>(null)
  const [sort, setSort]             = useState<SortKey>('complaints')
  const [showAll, setShowAll]       = useState(false)

  useEffect(() => {
    fetchPortfolioSnapshots()
      .then(setSnapshots)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const brands = useMemo(
    () => Array.from(new Set(
      snapshots.map(s => s.brand).filter((b): b is string => !!b && ALL_BRANDS.includes(b))
    )).sort(),
    [snapshots]
  )

  const filtered = useMemo(() => {
    let list = snapshots
    if (brand) list = list.filter(s => s.brand === brand)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.asin.toLowerCase().includes(q) ||
        (s.product_name?.toLowerCase().includes(q) ?? false)
      )
    }
    if (!showAll) list = list.filter(s => s.classified > 0)
    if (sort === 'complaints')  list = [...list].sort((a, b) => b.negative_count - a.negative_count)
    if (sort === 'risk')        list = [...list].sort((a, b) => b.negative_pct - a.negative_pct)
    if (sort === 'least-data')  list = [...list].sort((a, b) => a.classified - b.classified)
    return list
  }, [snapshots, brand, search, showAll, sort])

  const noDataCount = useMemo(() => snapshots.filter(s => s.classified === 0).length, [snapshots])

  const selectedSnapshot = useMemo(
    () => selected ? snapshots.find(s => s.asin === selected) ?? null : null,
    [selected, snapshots]
  )

  if (selectedSnapshot) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Review Intelligence" description={selectedSnapshot.product_name ?? selectedSnapshot.asin} />
        <div className="flex-1 p-4 md:p-6">
          <DrilldownView snapshot={selectedSnapshot} onBack={() => setSelected(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Review Intelligence"
        description="Surface complaint patterns across your product portfolio"
      />
      <div className="flex-1 p-4 md:p-6 space-y-5">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product name or ASIN…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Brand chips + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setBrand(null)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              brand === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            All brands
          </button>
          {brands.map(b => {
            const color = BRAND_COLORS[b] ?? '#888'
            const active = brand === b
            return (
              <button
                key={b}
                onClick={() => setBrand(active ? null : b)}
                className="text-xs px-3 py-1 rounded-full border font-medium transition-all flex items-center gap-1.5"
                style={{
                  borderColor: color,
                  backgroundColor: active ? color : `${color}18`,
                  color: active ? 'white' : color,
                }}
              >
                {b}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-1.5">
            {(['complaints', 'risk', 'least-data'] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  sort === k
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {k === 'complaints' ? 'Most complaints' : k === 'risk' ? 'Highest risk' : 'Least data'}
              </button>
            ))}
          </div>
        </div>

        {/* Count summary */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> products
              {brand && ` in ${brand}`}
            </span>
            {noDataCount > 0 && !showAll && (
              <button onClick={() => setShowAll(true)} className="underline hover:text-foreground">
                +{noDataCount} without analyzed reviews (show)
              </button>
            )}
            {showAll && noDataCount > 0 && (
              <button onClick={() => setShowAll(false)} className="underline hover:text-foreground">
                Hide {noDataCount} not yet analyzed
              </button>
            )}
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse bg-muted rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            {search ? 'No products match your search.' : 'No products to show.'}
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(s => (
              <ProductCard key={s.asin} s={s} onClick={() => setSelected(s.asin)} />
            ))}
          </div>
        )}

        {/* Legend */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-wrap gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Card border:</span>
            {[
              { label: '≥ 30% negative', cls: 'border-red-500' },
              { label: '18–29% negative', cls: 'border-yellow-500' },
              { label: '< 18% negative', cls: 'border-green-500' },
              { label: 'Not classified', cls: 'border-border' },
            ].map(({ label, cls }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`w-4 h-4 border-2 ${cls} rounded-sm`} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
