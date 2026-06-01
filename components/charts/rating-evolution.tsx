'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BRAND_COLORS } from '@/lib/utils'
import { useState } from 'react'

interface Props {
  data: Array<{ period: string; [brand: string]: string | number }>
  loading?: boolean
}

export function RatingEvolution({ data, loading }: Props) {
  const brands = data.length > 0
    ? Object.keys(data[0]).filter((k) => k !== 'period')
    : []

  const [hiddenBrands, setHiddenBrands] = useState<Set<string>>(new Set())

  const toggleBrand = (brand: string) =>
    setHiddenBrands((prev) => {
      const next = new Set(prev)
      next.has(brand) ? next.delete(brand) : next.add(brand)
      return next
    })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Rating Evolution by Brand</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
                contentStyle={{ fontSize: 12, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6 }}
                formatter={(value: unknown, name: unknown) => [Number(value).toFixed(2) + ' ★', String(name ?? '')]}
                labelFormatter={(v) => {
                  const d = new Date(v)
                  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                }}
              />
              <ReferenceLine y={4.0} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '4.0', position: 'right', fontSize: 10 }} />
              <ReferenceLine y={4.5} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '4.5', position: 'right', fontSize: 10 }} />
              {brands.map((brand) =>
                hiddenBrands.has(brand) ? null : (
                  <Line
                    key={brand}
                    type="monotone"
                    dataKey={brand}
                    stroke={BRAND_COLORS[brand] ?? '#94a3b8'}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )
              )}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Toggleable brand pills — below chart, centered */}
        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {brands.map((brand) => {
            const color = BRAND_COLORS[brand] ?? '#94a3b8'
            const hidden = hiddenBrands.has(brand)
            return (
              <button
                key={brand}
                onClick={() => toggleBrand(brand)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  borderColor: hidden ? '#e2e8f0' : color,
                  backgroundColor: hidden ? 'transparent' : `${color}22`,
                  color: hidden ? '#94a3b8' : color,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: hidden ? '#cbd5e1' : color }}
                />
                {brand}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
