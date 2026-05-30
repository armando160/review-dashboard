'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { BRAND_COLORS } from '@/lib/utils'
import type { TopAsin } from '@/types'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

type SortCol = 'rating' | 'volume'
type SortDir = 'asc' | 'desc'

interface Props {
  topByRating: TopAsin[]
  bottomByRating: TopAsin[]
  topByVolume: TopAsin[]
  loading?: boolean
}

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
  return dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
}

function AsinTable({
  data,
  showNegCat,
  defaultSort,
}: {
  data: TopAsin[]
  showNegCat?: boolean
  defaultSort: SortCol
}) {
  const [sortCol, setSortCol] = useState<SortCol>(defaultSort)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    const val = sortCol === 'rating'
      ? a.avg_rating - b.avg_rating
      : a.review_count - b.review_count
    return sortDir === 'desc' ? -val : val
  })

  if (!sorted.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No data in selected period
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 text-muted-foreground font-medium w-6">#</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Product</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Brand</th>
            <th
              className="text-right p-2 text-muted-foreground font-medium cursor-pointer hover:text-foreground select-none"
              onClick={() => toggleSort('rating')}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Rating
                <SortIcon col="rating" active={sortCol === 'rating'} dir={sortDir} />
              </span>
            </th>
            <th
              className="text-right p-2 text-muted-foreground font-medium cursor-pointer hover:text-foreground select-none"
              onClick={() => toggleSort('volume')}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Reviews
                <SortIcon col="volume" active={sortCol === 'volume'} dir={sortDir} />
              </span>
            </th>
            {showNegCat && (
              <th className="text-left p-2 text-muted-foreground font-medium">Top Issue</th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.asin}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              <td className="p-2 text-muted-foreground">{i + 1}</td>
              <td className="p-2">
                <div
                  className="font-medium text-foreground truncate max-w-[200px]"
                  title={row.product_name ?? row.asin}
                >
                  {row.product_name ?? row.asin}
                </div>
                <div className="text-muted-foreground font-mono">{row.asin}</div>
              </td>
              <td className="p-2">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-white text-[10px] font-medium"
                  style={{ backgroundColor: BRAND_COLORS[row.brand ?? ''] ?? '#94a3b8' }}
                >
                  {row.brand ?? '—'}
                </span>
              </td>
              <td className="p-2 text-right font-medium">
                <span
                  className={
                    row.avg_rating >= 4
                      ? 'text-green-600'
                      : row.avg_rating >= 3
                      ? 'text-yellow-600'
                      : 'text-red-500'
                  }
                >
                  {row.avg_rating.toFixed(2)} ★
                </span>
              </td>
              <td className="p-2 text-right text-foreground">
                {row.review_count.toLocaleString()}
              </td>
              {showNegCat && (
                <td className="p-2">
                  {row.dominant_negative_category ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {row.dominant_negative_category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TopBottomTable({ topByRating, bottomByRating, topByVolume, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">ASIN Rankings</CardTitle>
        <p className="text-xs text-muted-foreground">
          Click the Rating or Reviews column headers to re-sort
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 animate-pulse bg-muted rounded" />
        ) : (
          <Tabs defaultValue="top-rating">
            <TabsList className="mb-3">
              <TabsTrigger value="top-rating">Top Rating</TabsTrigger>
              <TabsTrigger value="bottom-rating">Bottom Rating</TabsTrigger>
              <TabsTrigger value="top-volume">Top Volume</TabsTrigger>
            </TabsList>
            <TabsContent value="top-rating">
              <AsinTable data={topByRating} defaultSort="rating" />
            </TabsContent>
            <TabsContent value="bottom-rating">
              <AsinTable data={bottomByRating} showNegCat defaultSort="rating" />
            </TabsContent>
            <TabsContent value="top-volume">
              <AsinTable data={topByVolume} defaultSort="volume" />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
