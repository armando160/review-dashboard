'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BRAND_COLORS } from '@/lib/utils'
import type { VelocityDataPoint } from '@/types'
import { useMemo } from 'react'

interface Props {
  data: VelocityDataPoint[]
  loading?: boolean
}

export function VelocityTrend({ data, loading }: Props) {
  const { chartData, brands } = useMemo(() => {
    const periodMap = new Map<string, Record<string, number>>()
    const brandSet = new Set<string>()

    for (const d of data) {
      brandSet.add(d.brand)
      const row = periodMap.get(d.period) ?? {}
      row[d.brand] = (row[d.brand] ?? 0) + d.review_count
      periodMap.set(d.period, row)
    }

    const brands = Array.from(brandSet).sort()
    const chartData = Array.from(periodMap.entries())
      .map(([period, vals]) => ({
        period,
        ...vals,
        total: Object.values(vals).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => a.period.localeCompare(b.period))

    return { chartData, brands }
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Review Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: unknown, name: unknown) => [Number(value).toLocaleString(), String(name ?? '')]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {brands.map((brand) => (
                <Bar
                  key={brand}
                  yAxisId="left"
                  dataKey={brand}
                  stackId="stack"
                  fill={BRAND_COLORS[brand] ?? '#94a3b8'}
                  maxBarSize={40}
                />
              ))}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="total"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                name="Total"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
