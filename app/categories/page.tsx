'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { CategoryBreakdown } from '@/components/charts/category-breakdown'
import { SentimentTrend } from '@/components/charts/sentiment-trend'
import { Heatmap } from '@/components/charts/heatmap'
import { useFilters } from '@/hooks/use-filters'
import { fetchCategorySentiment, fetchHeatmap } from '@/lib/queries'
import type { CategorySentimentRow, HeatmapRow } from '@/types'

export default function CategoryIntelligence() {
  const { filters } = useFilters()
  const [catSentiment, setCatSentiment] = useState<CategorySentimentRow[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchCategorySentiment(filters), fetchHeatmap(filters)])
      .then(([catData, heatmapData]) => {
        setCatSentiment(catData)
        setHeatmap(heatmapData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filters])

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Category Intelligence" description="Sentiment breakdown by review category" />
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
        <CategoryBreakdown data={catSentiment} loading={loading} />
        <SentimentTrend data={catSentiment} periodData={[]} loading={loading} />
        <Heatmap data={heatmap} loading={loading} />
      </div>
    </div>
  )
}
