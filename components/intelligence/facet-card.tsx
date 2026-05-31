'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ProductFacet } from '@/types'

function SentimentBar({
  positive,
  neutral,
  negative,
  total,
}: {
  positive: number
  neutral: number
  negative: number
  total: number
}) {
  if (total === 0) return null
  const pPct = (positive / total) * 100
  const nePct = (neutral / total) * 100
  const ngPct = (negative / total) * 100

  return (
    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted">
      {pPct > 0 && (
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${pPct}%` }}
        />
      )}
      {nePct > 0 && (
        <div
          className="bg-gray-400 transition-all"
          style={{ width: `${nePct}%` }}
        />
      )}
      {ngPct > 0 && (
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${ngPct}%` }}
        />
      )}
    </div>
  )
}

function sentimentDot(sentiment: string) {
  if (sentiment === 'positive') return 'bg-green-500'
  if (sentiment === 'negative') return 'bg-red-500'
  return 'bg-gray-400'
}

export function FacetCard({ facet }: { facet: ProductFacet }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">{facet.facet_name}</h3>
          <Badge variant="outline" className="text-xs shrink-0">
            {facet.facet_type}
          </Badge>
        </div>

        <SentimentBar
          positive={facet.positive_count}
          neutral={facet.neutral_count}
          negative={facet.negative_count}
          total={facet.total_mentions}
        />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{facet.total_mentions} mentions</span>
          <span className="text-green-600">{facet.positive_count} pos</span>
          <span className="text-gray-500">{facet.neutral_count} neu</span>
          <span className="text-red-500">{facet.negative_count} neg</span>
        </div>

        {facet.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {facet.summary}
          </p>
        )}

        {facet.representative_quotes && facet.representative_quotes.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            {facet.representative_quotes.map((q, i) => (
              <div key={i} className="flex items-start gap-2">
                <div
                  className={`w-2 h-2 rounded-full mt-1 shrink-0 ${sentimentDot(q.sentiment)}`}
                />
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  &ldquo;{q.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
