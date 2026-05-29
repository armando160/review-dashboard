'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { ReviewTable } from '@/components/tables/review-table'
import { useFilters } from '@/hooks/use-filters'
import { fetchReviews } from '@/lib/queries'
import type { ReviewWithProduct, Sentiment, ReviewCategory } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ALL_CATEGORIES, SENTIMENT_COLORS } from '@/lib/utils'

const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative']

export default function ReviewDrillDown() {
  const { filters, setSentiments, setCategories } = useFilters()
  const [reviews, setReviews] = useState<ReviewWithProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (p: number) => {
      setLoading(true)
      fetchReviews(filters, p)
        .then(({ data, count }) => {
          setReviews(data)
          setTotal(count)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    },
    [filters]
  )

  useEffect(() => {
    setPage(0)
    load(0)
  }, [filters, load])

  const handlePageChange = (p: number) => {
    setPage(p)
    load(p)
  }

  const toggleSentiment = (s: Sentiment) => {
    const current = filters.sentiments
    setSentiments(current.includes(s) ? current.filter((x) => x !== s) : [...current, s])
  }

  const toggleCategory = (c: ReviewCategory) => {
    const current = filters.categories
    setCategories(current.includes(c) ? current.filter((x) => x !== c) : [...current, c])
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Review Drill-Down" description="Browse and filter individual reviews" />
      <div className="flex-1 p-6 space-y-4">
        {/* In-page filter bar */}
        <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-card border border-border text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Sentiment</p>
            <div className="flex gap-3">
              {SENTIMENTS.map((s) => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer capitalize">
                  <Checkbox
                    checked={filters.sentiments.includes(s)}
                    onCheckedChange={() => toggleSentiment(s)}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: SENTIMENT_COLORS[s] }}
                  >
                    {s}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Category</p>
            <div className="flex flex-wrap gap-3">
              {ALL_CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={filters.categories.includes(c as ReviewCategory)}
                    onCheckedChange={() => toggleCategory(c as ReviewCategory)}
                  />
                  <Label className="text-xs font-normal cursor-pointer">{c}</Label>
                </label>
              ))}
            </div>
          </div>
        </div>

        <ReviewTable
          data={reviews}
          total={total}
          page={page}
          onPageChange={handlePageChange}
          loading={loading}
        />
      </div>
    </div>
  )
}
