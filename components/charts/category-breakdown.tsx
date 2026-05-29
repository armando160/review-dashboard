'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SENTIMENT_COLORS, ALL_CATEGORIES } from '@/lib/utils'
import type { CategorySentimentRow } from '@/types'
import { useMemo } from 'react'

interface Props {
  data: CategorySentimentRow[]
  loading?: boolean
}

export function CategoryBreakdown({ data, loading }: Props) {
  const chartData = useMemo(() => {
    const map = new Map<string, { positive: number; neutral: number; negative: number }>()
    for (const row of data) {
      const e = map.get(row.review_category) ?? { positive: 0, neutral: 0, negative: 0 }
      if (row.sentiment === 'positive') e.positive += row.count
      if (row.sentiment === 'neutral') e.neutral += row.count
      if (row.sentiment === 'negative') e.negative += row.count
      map.set(row.review_category, e)
    }
    return ALL_CATEGORIES
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, ...map.get(cat)! }))
      .sort((a, b) => (b.positive + b.neutral + b.negative) - (a.positive + a.neutral + a.negative))
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Category Volume + Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 16, bottom: 4, left: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: unknown, name: unknown) => [Number(value).toLocaleString(), String(name ?? '')]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="positive" name="Positive" stackId="s" fill={SENTIMENT_COLORS.positive} />
              <Bar dataKey="neutral" name="Neutral" stackId="s" fill={SENTIMENT_COLORS.neutral} />
              <Bar dataKey="negative" name="Negative" stackId="s" fill={SENTIMENT_COLORS.negative} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
