'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BRAND_COLORS } from '@/lib/utils'
import type { ScatterPoint } from '@/types'
import { useMemo } from 'react'

interface Props {
  data: ScatterPoint[]
  loading?: boolean
}

export function ScatterPlot({ data, loading }: Props) {
  const medianCount = useMemo(() => {
    if (!data.length) return 0
    const sorted = [...data].sort((a, b) => a.review_count - b.review_count)
    const mid = Math.floor(sorted.length / 2)
    return sorted[mid]?.review_count ?? 0
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Review Volume vs. Rating</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                dataKey="review_count"
                name="Reviews"
                tick={{ fontSize: 11 }}
                label={{ value: 'Reviews', position: 'insideBottom', offset: -8, fontSize: 11 }}
                scale="log"
                domain={['auto', 'auto']}
              />
              <YAxis
                type="number"
                dataKey="avg_rating"
                name="Avg Rating"
                domain={[1, 5]}
                tick={{ fontSize: 11 }}
                label={{ value: 'Avg Rating', angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload as ScatterPoint
                  return (
                    <div className="bg-popover text-popover-foreground text-xs rounded shadow p-2 border border-border">
                      <p className="font-medium truncate max-w-[200px]">{d.product_name ?? d.asin}</p>
                      <p className="text-muted-foreground">{d.brand}</p>
                      <p>{d.review_count.toLocaleString()} reviews</p>
                      <p>{d.avg_rating.toFixed(2)} ★</p>
                    </div>
                  )
                }}
              />
              <ReferenceLine y={4.0} stroke="#f59e0b" strokeDasharray="4 4" />
              <ReferenceLine y={4.5} stroke="#22c55e" strokeDasharray="4 4" />
              {medianCount > 0 && <ReferenceLine x={medianCount} stroke="#94a3b8" strokeDasharray="4 4" />}
              <Scatter data={data} r={4}>
                {data.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={BRAND_COLORS[entry.brand ?? ''] ?? '#94a3b8'}
                    fillOpacity={0.8}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
