'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { BRAND_COLORS } from '@/lib/utils'
import type { TopAsin } from '@/types'

interface Props {
  topByRating: TopAsin[]
  bottomByRating: TopAsin[]
  topByVolume: TopAsin[]
  loading?: boolean
}

function AsinTable({ data, showNegCat }: { data: TopAsin[]; showNegCat?: boolean }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data in selected period</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 text-muted-foreground font-medium">#</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Product</th>
            <th className="text-left p-2 text-muted-foreground font-medium">Brand</th>
            <th className="text-right p-2 text-muted-foreground font-medium">Rating</th>
            <th className="text-right p-2 text-muted-foreground font-medium">Reviews</th>
            {showNegCat && (
              <th className="text-left p-2 text-muted-foreground font-medium">Top Issue</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.asin} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="p-2 text-muted-foreground">{i + 1}</td>
              <td className="p-2">
                <div className="font-medium text-foreground truncate max-w-[200px]" title={row.product_name ?? row.asin}>
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
                <span className={row.avg_rating >= 4 ? 'text-green-600' : row.avg_rating >= 3 ? 'text-yellow-600' : 'text-red-500'}>
                  {row.avg_rating.toFixed(2)} ★
                </span>
              </td>
              <td className="p-2 text-right text-foreground">{row.review_count.toLocaleString()}</td>
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
              <AsinTable data={topByRating} />
            </TabsContent>
            <TabsContent value="bottom-rating">
              <AsinTable data={bottomByRating} showNegCat />
            </TabsContent>
            <TabsContent value="top-volume">
              <AsinTable data={topByVolume} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
