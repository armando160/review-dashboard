'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { ScatterPlot } from '@/components/charts/scatter-plot'
import { RatingHistogram } from '@/components/charts/rating-histogram'
import { TopBottomTable } from '@/components/tables/top-bottom-table'
import { useFilters } from '@/hooks/use-filters'
import {
  fetchScatterData,
  fetchRatingDistribution,
  fetchTopAsins,
} from '@/lib/queries'
import type { ScatterPoint, RatingDistributionRow, TopAsin } from '@/types'

export default function ProductAnalysis() {
  const { filters } = useFilters()
  const [scatter, setScatter] = useState<ScatterPoint[]>([])
  const [distribution, setDistribution] = useState<RatingDistributionRow[]>([])
  const [topByRating, setTopByRating] = useState<TopAsin[]>([])
  const [bottomByRating, setBottomByRating] = useState<TopAsin[]>([])
  const [topByVolume, setTopByVolume] = useState<TopAsin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchScatterData(filters),
      fetchRatingDistribution(filters),
      fetchTopAsins(filters, 'desc', 10),
      fetchTopAsins(filters, 'asc', 10),
      fetchTopAsins(filters, 'desc', 10),
    ])
      .then(([scatterData, distData, top, bottom, vol]) => {
        setScatter(scatterData)
        setDistribution(distData)
        setTopByRating(top)
        setBottomByRating(bottom)
        setTopByVolume(vol.sort((a, b) => b.review_count - a.review_count))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filters])

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Product Analysis" description="ASIN-level performance and rankings" />
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ScatterPlot data={scatter} loading={loading} />
          <RatingHistogram data={distribution} loading={loading} />
        </div>
        <TopBottomTable
          topByRating={topByRating}
          bottomByRating={bottomByRating}
          topByVolume={topByVolume}
          loading={loading}
        />
      </div>
    </div>
  )
}
