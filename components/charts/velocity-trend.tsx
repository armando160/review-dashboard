'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BRAND_COLORS, ALL_BRANDS } from '@/lib/utils'
import type { VelocityDataPoint } from '@/types'
import { useMemo, useState } from 'react'

interface Props {
  data: VelocityDataPoint[]
  loading?: boolean
}

export function VelocityTrend({ data, loading }: Props) {
  const [hiddenBrands, setHiddenBrands] = useState<Set<string>>(new Set())

  const toggleBrand = (brand: string) =>
    setHiddenBrands((prev) => {
      const next = new Set(prev)
      next.has(brand) ? next.delete(brand) : next.add(brand)
      return next
    })

  const { chartData, brands } = useMemo(() => {
    const periodMap = new Map<string, Record<string, number>>()
    const brandSet = new Set<string>()

    for (const d of data) {
      // Guard: skip rows where brand is not a recognised brand name
      if (typeof d.brand !== 'string' || !ALL_BRANDS.includes(d.brand)) continue

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

  const visibleBrands = brands.filter((b) => !hiddenBrands.has(b))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Review Velocity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toggleable brand legend */}
        <div className="flex flex-wrap gap-1.5">
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
          {/* Total line toggle */}
          <button
            onClick={() => toggleBrand('__total__')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
            style={{
              borderColor: hiddenBrands.has('__total__') ? '#e2e8f0' : '#0ea5e9',
              backgroundColor: hiddenBrands.has('__total__') ? 'transparent' : '#0ea5e922',
              color: hiddenBrands.has('__total__') ? '#94a3b8' : '#0ea5e9',
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: hiddenBrands.has('__total__') ? '#cbd5e1' : '#0ea5e9' }}
            />
            Total
          </button>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
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
              {brands.map((brand) =>
                hiddenBrands.has(brand) ? null : (
                  <Bar
                    key={brand}
                    yAxisId="left"
                    dataKey={brand}
                    stackId="stack"
                    fill={BRAND_COLORS[brand] ?? '#94a3b8'}
                    maxBarSize={40}
                  />
                )
              )}
              {!hiddenBrands.has('__total__') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name="Total"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
