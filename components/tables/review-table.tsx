'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BRAND_COLORS, downloadCsv } from '@/lib/utils'
import type { ReviewWithProduct } from '@/types'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'

interface Props {
  data: ReviewWithProduct[]
  total: number
  page: number
  onPageChange: (page: number) => void
  loading?: boolean
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
        Not processed
      </span>
    )
  }
  const color =
    sentiment === 'positive'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : sentiment === 'negative'
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${color}`}
    >
      {sentiment}
    </span>
  )
}

function CategoryCell({ category }: { category: string | null }) {
  if (!category) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
        Not processed
      </span>
    )
  }
  return <span className="text-xs">{category}</span>
}

function StarRating({ rating }: { rating: number }) {
  const color =
    rating >= 4 ? 'text-green-600' : rating === 3 ? 'text-yellow-500' : 'text-red-500'
  return (
    <span className={`font-medium text-xs ${color}`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

function ReviewRow({ review }: { review: ReviewWithProduct }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
        <td className="p-2">
          <div className="text-xs font-mono text-muted-foreground">{review.asin}</div>
          <div
            className="text-xs truncate max-w-[150px]"
            title={review.product_name ?? undefined}
          >
            {review.product_name ?? '—'}
          </div>
        </td>
        <td className="p-2">
          {review.brand && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-white text-[10px] font-medium"
              style={{ backgroundColor: BRAND_COLORS[review.brand] ?? '#94a3b8' }}
            >
              {review.brand}
            </span>
          )}
        </td>
        <td className="p-2">
          <StarRating rating={review.rating} />
        </td>
        <td className="p-2">
          <CategoryCell category={review.review_category} />
        </td>
        <td className="p-2">
          <SentimentBadge sentiment={review.sentiment} />
        </td>
        <td className="p-2 max-w-[200px]">
          <div className="text-xs font-medium truncate" title={review.title ?? undefined}>
            {review.title ?? '—'}
          </div>
        </td>
        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
          {review.review_date
            ? new Date(review.review_date + 'T12:00:00').toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : '—'}
        </td>
        <td className="p-2">
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="inline-flex items-center justify-center w-7 h-7 rounded bg-muted hover:bg-muted-foreground/20 border border-border text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/50 bg-muted/10">
          <td colSpan={8} className="px-4 py-3">
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {review.review_text ?? 'No review text'}
            </p>
            <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
              {review.is_verified_purchase && <span>✓ Verified Purchase</span>}
              {review.is_vine_review && <span>🌿 Vine Review</span>}
              {review.helpful_votes != null && review.helpful_votes > 0 && (
                <span>{review.helpful_votes} helpful</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function ReviewTable({ data, total, page, onPageChange, loading }: Props) {
  const pageSize = 100
  const totalPages = Math.ceil(total / pageSize)

  const handleExport = () => {
    downloadCsv(
      data.map((r) => ({
        asin: r.asin,
        product_name: r.product_name ?? '',
        brand: r.brand ?? '',
        rating: r.rating,
        review_category: r.review_category ?? '',
        sentiment: r.sentiment ?? '',
        title: r.title ?? '',
        review_date: r.review_date,
        review_text: r.review_text ?? '',
        verified: r.is_verified_purchase ? 'yes' : 'no',
        vine: r.is_vine_review ? 'yes' : 'no',
      })),
      `reviews-export-${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Reviews</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total.toLocaleString()} matching reviews
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-muted-foreground font-medium">Product</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Brand</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Rating</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Category</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Sentiment</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Title</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Date</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((review) => (
                    <ReviewRow key={review.id} review={review} />
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground">
                        No reviews match the current filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => onPageChange(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => onPageChange(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
