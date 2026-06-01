'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ALL_BRANDS, ALL_CATEGORIES } from '@/lib/utils'
import type { HeatmapRow } from '@/types'
import { useMemo } from 'react'

interface Props {
  data: HeatmapRow[]
  loading?: boolean
}

function sentimentToColor(pct: number): string {
  if (pct >= 80) return '#16a34a'
  if (pct >= 65) return '#22c55e'
  if (pct >= 50) return '#84cc16'
  if (pct >= 40) return '#eab308'
  if (pct >= 25) return '#f97316'
  return '#ef4444'
}

export function Heatmap({ data, loading }: Props) {
  const map = useMemo(() => {
    const m = new Map<string, HeatmapRow>()
    for (const row of data) {
      m.set(`${row.brand}||${row.review_category}`, row)
    }
    return m
  }, [data])

  const activeBrands = ALL_BRANDS.filter((b) => data.some((d) => d.brand === b))
  const activeCategories = ALL_CATEGORIES.filter((c) => data.some((d) => d.review_category === c))

  return (
    <div className="space-y-4">
      {/* ── Color heatmap: % positive ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Brand × Category Heatmap</CardTitle>
          <p className="text-xs text-muted-foreground">% positive sentiment</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted rounded" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 text-muted-foreground font-normal w-24">Brand</th>
                    {activeCategories.map((cat) => (
                      <th key={cat} className="p-1.5 text-muted-foreground font-normal text-center max-w-[80px]">
                        <span className="block truncate" title={cat}>{cat}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeBrands.map((brand) => (
                    <tr key={brand}>
                      <td className="p-1.5 font-medium text-foreground">{brand}</td>
                      {activeCategories.map((cat) => {
                        const cell = map.get(`${brand}||${cat}`)
                        if (!cell) {
                          return <td key={cat} className="p-1 text-center text-muted-foreground/50">—</td>
                        }
                        const bg = sentimentToColor(cell.positive_pct)
                        return (
                          <td key={cat} className="p-1 text-center">
                            <div
                              className="rounded px-1 py-1 text-white text-xs font-medium mx-auto"
                              style={{ backgroundColor: bg, minWidth: '44px' }}
                              title={`${cell.total.toLocaleString()} reviews\n${cell.positive_pct}% positive`}
                            >
                              {cell.positive_pct}%
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No analyzed reviews in selected period
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Numeric counts table ────────────────────────────────────── */}
      {!loading && data.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Brand × Category Counts</CardTitle>
            <p className="text-xs text-muted-foreground">Total · Positive · Negative per cell</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 text-muted-foreground font-normal w-24">Brand</th>
                    {activeCategories.map((cat) => (
                      <th key={cat} className="p-1.5 text-muted-foreground font-normal text-center max-w-[80px]">
                        <span className="block truncate" title={cat}>{cat}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeBrands.map((brand) => (
                    <tr key={brand} className="border-t border-border/40">
                      <td className="p-1.5 font-medium text-foreground align-top">{brand}</td>
                      {activeCategories.map((cat) => {
                        const cell = map.get(`${brand}||${cat}`)
                        if (!cell) {
                          return <td key={cat} className="p-1 text-center text-muted-foreground/50">—</td>
                        }
                        const neg = cell.negative ?? (cell.total - cell.positive)
                        return (
                          <td key={cat} className="p-1 text-center align-top">
                            <div className="flex flex-col gap-0.5 items-center leading-tight">
                              <span className="text-foreground font-semibold">{cell.total}</span>
                              <span className="text-green-600">{cell.positive}</span>
                              <span className="text-red-500">{neg}</span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                <span><span className="font-semibold text-foreground">Bold</span> = Total</span>
                <span><span className="text-green-600 font-medium">Green</span> = Positive</span>
                <span><span className="text-red-500 font-medium">Red</span> = Negative</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
