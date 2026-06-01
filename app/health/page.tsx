'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchHealthStats, fetchRecentRuns } from '@/lib/health-queries'
import type { HealthStats, RecentRun } from '@/lib/health-queries'
import {
  Database,
  Cpu,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(num: number, den: number) {
  if (!den) return 0
  return Math.round((num / den) * 1000) / 10
}

function fmt(n: number) {
  return n.toLocaleString()
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function duration(start: string, end: string | null) {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({
  value,
  max,
  colorClass = 'bg-primary',
}: {
  value: number
  max: number
  colorClass?: string
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full bg-muted rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full transition-all ${colorClass}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className={`text-2xl font-bold mb-0.5 ${accent ?? 'text-foreground'}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border pb-2">
      {children}
    </h2>
  )
}

function Skeleton() {
  return <div className="h-48 animate-pulse bg-muted rounded-lg" />
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DataHealthPage() {
  const [stats, setStats] = useState<HealthStats | null>(null)
  const [runs, setRuns] = useState<RecentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date())

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [s, r] = await Promise.all([fetchHealthStats(), fetchRecentRuns(25)])
      setStats(s)
      setRuns(r)
      setRefreshedAt(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const classifiedPct = stats ? pct(stats.reviews.classified, stats.reviews.total) : 0
  const coveragePct   = stats ? pct(stats.products.on_cycle, stats.products.total) : 0
  const successRate   = stats ? pct(stats.pipeline.completed_runs, stats.pipeline.total_runs) : 0
  const dedupRate     = stats && stats.pipeline.total_found > 0
    ? pct(stats.pipeline.total_found - stats.pipeline.total_new, stats.pipeline.total_found)
    : 0

  // Stale pipeline warning — flag if last run was > 8 hours ago
  const pipelineStaleHours = stats?.pipeline?.last_run_at
    ? Math.floor((Date.now() - new Date(stats.pipeline.last_run_at).getTime()) / 3_600_000)
    : null

  // Estimate days to clear classification backlog at 2,000/day
  const daysToClassify = stats
    ? stats.reviews.unclassified === 0
      ? 0
      : Math.ceil(stats.reviews.unclassified / 2000)
    : null

  const tierRows = stats
    ? [
        { label: 'Tier 1 — High Risk',  sub: 'Scraped every 24h', count: stats.products.tier_1,        color: 'bg-red-500' },
        { label: 'Tier 2 — Watch',       sub: 'Scraped every 48h', count: stats.products.tier_2,        color: 'bg-yellow-500' },
        { label: 'Tier 3 — Good',        sub: 'Scraped every 72h', count: stats.products.tier_3,        color: 'bg-green-500' },
        { label: 'Tier 4 — Top',         sub: 'Scraped every 96h', count: stats.products.tier_4,        color: 'bg-blue-500' },
        { label: 'Not yet scraped',       sub: 'First scrape pending', count: stats.products.never_scraped, color: 'bg-muted-foreground' },
      ]
    : []

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Data Health" description="Pipeline status, scraping coverage, and analysis progress" showFilters={false} />
      <div className="flex-1 p-4 md:p-6 space-y-8">

        {/* Refresh bar */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Last refreshed: {refreshedAt.toLocaleTimeString()}
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <strong>Failed to load stats:</strong> {error}
            <br />
            <span className="text-xs">Make sure the <code>data_health_stats</code> SQL function has been created in Supabase.</span>
          </div>
        )}

        {/* ── Stale pipeline warning ────────────────────────────────────────── */}
        {!loading && pipelineStaleHours !== null && pipelineStaleHours >= 8 && (
          <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${
            pipelineStaleHours >= 14
              ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300'
          }`}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>Pipeline overdue — last run was {pipelineStaleHours}h ago.</strong>
              {' '}Scheduled runs fire at 12 AM, 6 AM, 12 PM, and 6 PM Eastern.
              {pipelineStaleHours >= 14 && (
                <span> At least one scheduled run appears to have been skipped.</span>
              )}
              <div className="mt-1 text-xs opacity-80">
                To trigger manually: go to{' '}
                <a
                  href="https://github.com/armando160/review-dashboard-scraper/actions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  GitHub Actions → Review Dashboard Scraper → Run workflow
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Quick stats ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Overview</SectionTitle>
          <p className="text-xs text-muted-foreground -mt-2">
            All-time totals — not filtered by the date selector
          </p>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard
                label="Total Reviews"
                value={fmt(stats.reviews.total)}
                sub={`${fmt(stats.reviews.classified)} analyzed`}
                icon={Database}
              />
              <StatCard
                label="Analyzed"
                value={`${classifiedPct}%`}
                sub={`${fmt(stats.reviews.unclassified)} remaining`}
                icon={CheckCircle}
                accent={classifiedPct >= 90 ? 'text-green-600' : classifiedPct >= 70 ? 'text-yellow-600' : 'text-red-500'}
              />
              <StatCard
                label="ASIN Coverage"
                value={`${coveragePct}%`}
                sub={`${fmt(stats.products.on_cycle)} / ${fmt(stats.products.total)} on cycle`}
                icon={Cpu}
                accent={coveragePct >= 90 ? 'text-green-600' : coveragePct >= 60 ? 'text-yellow-600' : 'text-red-500'}
              />
              <StatCard
                label="Last Pipeline Run"
                value={timeAgo(stats.pipeline.last_run_at)}
                sub={formatDate(stats.pipeline.last_run_at)}
                icon={Clock}
              />
            </div>
          )}
        </section>

        {/* ── Classification health ──────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Analysis Health</SectionTitle>
          {loading ? <Skeleton /> : stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Progress */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Analysis Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold">{fmt(stats.reviews.classified)} analyzed</span>
                      <span className="text-muted-foreground">{fmt(stats.reviews.total)} total</span>
                    </div>
                    <ProgressBar
                      value={stats.reviews.classified}
                      max={stats.reviews.total}
                      colorClass={classifiedPct >= 90 ? 'bg-green-500' : classifiedPct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">{classifiedPct}% complete</p>
                  </div>

                  {stats.reviews.unclassified > 0 ? (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-1">
                      <p className="font-medium">{fmt(stats.reviews.unclassified)} reviews pending analysis</p>
                      <p className="text-muted-foreground">
                        At ~2,000/day (500 per run × 4 runs) — estimated{' '}
                        <span className="font-semibold text-foreground">
                          {daysToClassify === 1 ? '~1 day' : `~${daysToClassify} days`}
                        </span>{' '}
                        to clear backlog
                      </p>
                      <p className="text-muted-foreground">Newest reviews are processed first.</p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300 font-medium">
                      ✓ All reviews analyzed — no backlog
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Oldest review</p>
                      <p className="font-medium mt-0.5">{formatDate(stats.reviews.oldest_date)}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Newest review</p>
                      <p className="font-medium mt-0.5">{formatDate(stats.reviews.newest_date)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sentiment breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Sentiment Breakdown</CardTitle>
                  <p className="text-xs text-muted-foreground">Analyzed reviews only</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Positive', count: stats.reviews.positive, color: 'bg-green-500', text: 'text-green-600' },
                    { label: 'Neutral',  count: stats.reviews.neutral,  color: 'bg-gray-400',  text: 'text-gray-500' },
                    { label: 'Negative', count: stats.reviews.negative, color: 'bg-red-500',   text: 'text-red-500' },
                  ].map(({ label, count, color, text }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{label}</span>
                        <span className={`font-semibold ${text}`}>
                          {fmt(count)} ({pct(count, stats.reviews.classified)}%)
                        </span>
                      </div>
                      <ProgressBar value={count} max={stats.reviews.classified} colorClass={color} />
                    </div>
                  ))}

                  <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Not yet processed</span>
                      <span className="font-medium text-foreground">{fmt(stats.reviews.unclassified)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total in database</span>
                      <span className="font-medium text-foreground">{fmt(stats.reviews.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </section>

        {/* ── Scraping coverage ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Scraping Coverage</SectionTitle>
          {loading ? <Skeleton /> : stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* ASIN progress */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">ASIN Initial Scrape Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold">{fmt(stats.products.on_cycle)} on cycle</span>
                      <span className="text-muted-foreground">{fmt(stats.products.total)} total ASINs</span>
                    </div>
                    <ProgressBar
                      value={stats.products.on_cycle}
                      max={stats.products.total}
                      colorClass={coveragePct >= 90 ? 'bg-green-500' : coveragePct >= 60 ? 'bg-yellow-500' : 'bg-blue-500'}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">{coveragePct}% of ASINs have been scraped at least once</p>
                  </div>

                  {stats.products.never_scraped > 0 ? (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-1">
                      <p className="font-medium">{fmt(stats.products.never_scraped)} ASINs not yet scraped</p>
                      <p className="text-muted-foreground">
                        At 120 ASINs/day (30 per run × 4 runs) — estimated{' '}
                        <span className="font-semibold text-foreground">
                          ~{Math.ceil(stats.products.never_scraped / 120)} day{Math.ceil(stats.products.never_scraped / 120) !== 1 ? 's' : ''}
                        </span>{' '}
                        to complete initial coverage
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300 font-medium">
                      ✓ All ASINs on cycle — pipeline is in maintenance mode
                    </div>
                  )}

                  {stats.products.stale_7d > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-700 dark:text-yellow-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <span className="font-semibold">{fmt(stats.products.stale_7d)} ASINs</span> not scraped in the last 7 days — may indicate scraping errors
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tier distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Scrape Tier Distribution</CardTitle>
                  <p className="text-xs text-muted-foreground">Tiers are assigned automatically by avg rating</p>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-muted-foreground font-medium">Tier</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Condition</th>
                        <th className="text-right p-2 text-muted-foreground font-medium">ASINs</th>
                        <th className="text-right p-2 text-muted-foreground font-medium">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { tier: 'Tier 1', cond: 'Rating < 4.0',   interval: '24h', count: stats.products.tier_1,        dot: 'bg-red-500' },
                        { tier: 'Tier 2', cond: '4.0 – 4.49',     interval: '48h', count: stats.products.tier_2,        dot: 'bg-yellow-500' },
                        { tier: 'Tier 3', cond: '4.5 – 4.7',      interval: '72h', count: stats.products.tier_3,        dot: 'bg-green-500' },
                        { tier: 'Tier 4', cond: 'Rating > 4.7',   interval: '96h', count: stats.products.tier_4,        dot: 'bg-blue-500' },
                        { tier: 'Pending', cond: 'Not yet scraped', interval: '—',  count: stats.products.never_scraped, dot: 'bg-muted-foreground' },
                      ].map(({ tier, cond, interval, count, dot }) => (
                        <tr key={tier} className="border-b border-border/50">
                          <td className="p-2">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                              <span className="font-medium">{tier}</span>
                              {interval !== '—' && (
                                <span className="text-muted-foreground">({interval})</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-muted-foreground">{cond}</td>
                          <td className="p-2 text-right font-medium">{fmt(count)}</td>
                          <td className="p-2 text-right text-muted-foreground">
                            {stats.products.total > 0 ? `${pct(count, stats.products.total)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </section>

        {/* ── Pipeline performance ───────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Pipeline Performance</SectionTitle>
          {loading ? <Skeleton /> : stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Runs</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last 24h</span>
                      <span className="font-semibold">{stats.pipeline.runs_last_24h}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total all time</span>
                      <span className="font-semibold">{fmt(stats.pipeline.total_runs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success rate</span>
                      <span className={`font-semibold ${successRate >= 95 ? 'text-green-600' : successRate >= 80 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {successRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Errors</span>
                      <span className={`font-semibold ${stats.pipeline.error_runs > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {stats.pipeline.error_runs}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">New Reviews</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last 24h</span>
                      <span className="font-semibold">{fmt(stats.pipeline.new_last_24h)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last 7 days</span>
                      <span className="font-semibold">{fmt(stats.pipeline.new_last_7d)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">All time</span>
                      <span className="font-semibold">{fmt(stats.pipeline.total_new)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Deduplication</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total found</span>
                      <span className="font-semibold">{fmt(stats.pipeline.total_found)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actually new</span>
                      <span className="font-semibold">{fmt(stats.pipeline.total_new)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duplicate rate</span>
                      <span className="font-semibold text-muted-foreground">{dedupRate}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Data Range</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Oldest review</span>
                      <span className="font-semibold text-right">{formatDate(stats.reviews.oldest_date)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Newest review</span>
                      <span className="font-semibold text-right">{formatDate(stats.reviews.newest_date)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Total ASINs</span>
                      <span className="font-semibold">{fmt(stats.products.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </section>

        {/* ── Recent pipeline runs ───────────────────────────────────────── */}
        <section className="space-y-3">
          <SectionTitle>Recent Pipeline Runs</SectionTitle>
          {loading ? (
            <div className="h-64 animate-pulse bg-muted rounded-lg" />
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-muted-foreground font-medium">ASIN</th>
                        <th className="text-right p-2 text-muted-foreground font-medium">Found</th>
                        <th className="text-right p-2 text-muted-foreground font-medium">New</th>
                        <th className="text-center p-2 text-muted-foreground font-medium">Status</th>
                        <th className="text-right p-2 text-muted-foreground font-medium">Duration</th>
                        <th className="text-right p-2 text-muted-foreground font-medium">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr key={run.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="p-2 font-mono text-muted-foreground">{run.asin}</td>
                          <td className="p-2 text-right">{run.reviews_found}</td>
                          <td className="p-2 text-right font-medium">
                            <span className={run.new_reviews > 0 ? 'text-green-600' : ''}>
                              {run.new_reviews > 0 ? `+${run.new_reviews}` : '0'}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              run.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : run.status === 'error'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {run.status}
                            </span>
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {duration(run.started_at, run.completed_at)}
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {run.completed_at ? timeAgo(run.completed_at) : '—'}
                          </td>
                        </tr>
                      ))}
                      {runs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-muted-foreground">
                            No pipeline runs recorded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
