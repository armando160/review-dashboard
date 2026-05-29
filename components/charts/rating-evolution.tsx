'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BRAND_COLORS } from '@/lib/utils'

interface Props {
  data: Array<{ period: string; [brand: string]: string | number }>
  loading?: boolean
}

export function RatingEvolution({ data, loading }: Props) {
  const brands = data.length > 0
    ? Object.keys(data[0]).filter((k) => k !== 'period')
    : []

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Rating Evolution by Brand</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
              />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: unknown) => [Number(value).toFixed(2) + ' ★', '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={4.0} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '4.0', position: 'right', fontSize: 10 }} />
              <ReferenceLine y={4.5} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '4.5', position: 'right', fontSize: 10 }} />
              {brands.map((brand) => (
                <Line
                  key={brand}
                  type="monotone"
                  dataKey={brand}
                  stroke={BRAND_COLORS[brand] ?? '#94a3b8'}
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
