'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MentionSparkline } from './mention-sparkline'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { IssueTheme } from '@/types'

function severityClasses(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default:
      return ''
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-xs">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  )
}

export function IssueCard({ theme }: { theme: IssueTheme }) {
  const [expanded, setExpanded] = useState(false)

  const reviewDates = (theme.reviews ?? [])
    .map(r => r.review?.review_date)
    .filter(Boolean) as string[]

  const reviewCount = theme.reviews?.length ?? 0

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Title row */}
        <div>
          <h3 className="text-sm font-bold text-foreground leading-tight">
            {theme.theme_label}
          </h3>
          {(theme.product_name || theme.brand) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {theme.product_name}{theme.brand ? ` - ${theme.brand}` : ''}
            </p>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {theme.mention_count} mentions
          </Badge>
          <Badge
            className={severityClasses(theme.severity) || undefined}
            variant={theme.severity === 'low' ? 'secondary' : 'default'}
          >
            {theme.severity}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {theme.category}
          </Badge>
        </div>

        {/* Sparkline */}
        <MentionSparkline dates={reviewDates} />

        {/* Expand reviews */}
        {reviewCount > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              View {reviewCount} review{reviewCount !== 1 ? 's' : ''}
            </button>

            {expanded && (
              <div className="mt-2 space-y-3 border-t border-border pt-3">
                {(theme.reviews ?? []).map((r) => {
                  if (!r.review) return null
                  return (
                    <div key={r.review_id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StarRating rating={r.review.rating} />
                        <span className="text-xs text-muted-foreground">
                          {r.review.review_date}
                        </span>
                      </div>
                      {r.review.title && (
                        <p className="text-xs font-semibold text-foreground">
                          {r.review.title}
                        </p>
                      )}
                      {r.relevance && (
                        <p className="text-xs text-muted-foreground italic">
                          {r.relevance}
                        </p>
                      )}
                      {r.review.review_text && (
                        <p className="text-xs text-muted-foreground">
                          {r.review.review_text.length > 200
                            ? r.review.review_text.slice(0, 200) + '...'
                            : r.review.review_text}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
