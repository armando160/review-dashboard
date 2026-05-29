'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORY_COLORS, ALL_CATEGORIES } from '@/lib/utils'
import type { CategorySentimentRow } from '@/types'
import { useMemo } from 'react'

interface Props {
  data: CategorySentimentRow[]
  periodData: Array<{ period: string; review_category: string; sentiment: string; count: number }>
  loading?: boolean
}

export function SentimentTrend({ periodData, loading }: Props) {
  const { chartData, categories } = useMemo(() => {
    const periodMap = new Map<string, Record<string, { pos: number; total: number }>>()
    const catSet = new Set<string>()

    for (const d of periodData) {
      catSet.add(d.review_category)
      const row = periodMap.get(d.period) ?? {}
      if (!row[d.review_category]) row[d.review_category] = { pos: 0, total: 0 }
      row[d.review_category].total += d.count
      if (d.sentiment === 'positive') row[d.review_category].pos += d.count
      periodMap.set(d.period, row)
    }

    const categories = ALL_CATEGORIES.filter((c) => catSet.has(c))
    const chartData = Array.from(periodMap.entries())
      .map(([period, cats]) => {
        const row: Record<string, string | number> = { period }
        for (const cat of categories) {
          const v = cats[cat]
          row[cat] = v && v.total > 0 ? Math.round((v.pos / v.total) * 1000) / 10 : 0
        }
        return row
      })
      .sort((a, b) => String(a.period).localeCompare(String(b.period)))

    return { chartData, categories }
  }, [periodData])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Positive Sentiment % by Category</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
              />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: unknown, name: unknown) => [`${Number(value).toFixed(1)}%`, String(name ?? '')]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {categories.map((cat) => (
                <Line
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stroke={CATEGORY_COLORS[cat] ?? '#94a3b8'}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
