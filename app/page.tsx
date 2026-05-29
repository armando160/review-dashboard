'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { KpiCard } from '@/components/charts/kpi-scorecard'
import { VelocityTrend } from '@/components/charts/velocity-trend'
import { RatingEvolution } from '@/components/charts/rating-evolution'
import { useFilters } from '@/hooks/use-filters'
import { fetchKpis, fetchVelocity, fetchRatingEvolution } from '@/lib/queries'
import type { KpiData, VelocityDataPoint } from '@/types'
import { Star, TrendingDown, TrendingUp, MessageSquare } from 'lucide-react'

export default function ExecutiveOverview() {
  const { filters } = useFilters()
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [velocity, setVelocity] = useState<VelocityDataPoint[]>([])
  const [ratingEvolution, setRatingEvolution] = useState<Array<{ period: string; [brand: string]: string | number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchKpis(filters),
      fetchVelocity(filters),
      fetchRatingEvolution(filters),
    ])
      .then(([kpiData, velocityData, ratingData]) => {
        setKpis(kpiData)
        setVelocity(velocityData)
        setRatingEvolution(ratingData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filters])

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Executive Overview" description="Portfolio-wide review performance" />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            title="Total Reviews"
            value={kpis ? kpis.totalReviews.toLocaleString() : '—'}
            delta={kpis?.totalReviewsDelta}
            deltaLabel="%"
            icon={<MessageSquare className="w-4 h-4" />}
            loading={loading}
            tooltip={
              "Count of reviews with a review date inside the selected period.\n\n" +
              "Delta: % change vs. the previous period of equal length.\n\n" +
              "Affected by: Date range, Brand filter, Star Rating filter."
            }
          />
          <KpiCard
            title="Avg Rating"
            value={kpis ? `${kpis.avgRating} ★` : '—'}
            delta={kpis?.avgRatingDelta}
            icon={<Star className="w-4 h-4" />}
            loading={loading}
            tooltip={
              "Simple average of all star ratings (1–5) for reviews in the selected period. Not weighted by product volume.\n\n" +
              "Delta: change in average stars vs. the prior equal period.\n\n" +
              "Note: filtering by specific star ratings will directly skew this number.\n\n" +
              "Affected by: Date range, Brand filter, Star Rating filter."
            }
          />
          <KpiCard
            title="Positive Sentiment"
            value={kpis ? `${kpis.positivePct}%` : '—'}
            delta={kpis?.positivePctDelta}
            deltaLabel="pp"
            icon={<TrendingUp className="w-4 h-4" />}
            loading={loading}
            tooltip={
              "% of LLM-classified reviews labeled positive, out of all classified reviews in the period.\n\n" +
              "Reviews still showing 'Not processed' are excluded — they have not yet been through the AI pipeline.\n\n" +
              "Delta: percentage-point change vs. the prior equal period.\n\n" +
              "Affected by: Date range, Brand filter, Star Rating filter."
            }
          />
          <KpiCard
            title="Negative Sentiment"
            value={kpis ? `${kpis.negativePct}%` : '—'}
            delta={kpis?.negativePctDelta}
            deltaLabel="pp"
            icon={<TrendingDown className="w-4 h-4" />}
            loading={loading}
            invertDelta
            tooltip={
              "% of LLM-classified reviews labeled negative, out of all classified reviews in the period.\n\n" +
              "The delta badge is red when this number rises and green when it falls — an increase in negative sentiment is a warning signal.\n\n" +
              "Reviews still showing 'Not processed' are excluded.\n\n" +
              "Affected by: Date range, Brand filter, Star Rating filter."
            }
          />
        </div>
        <VelocityTrend data={velocity} loading={loading} />
        <RatingEvolution data={ratingEvolution} loading={loading} />
        <p className="text-xs text-muted-foreground text-center pb-2">
          Review data refreshes on a rolling 4-day cycle. Priority products (rating below 4.0) update daily.
          Historical data is available from the date scraping began — full review history prior to that date is not captured.
        </p>
      </div>
    </div>
  )
}
