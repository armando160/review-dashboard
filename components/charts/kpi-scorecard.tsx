'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  delta?: number
  deltaLabel?: string
  icon?: React.ReactNode
  loading?: boolean
  /** When true, a rising delta is bad (red) and a falling delta is good (green). Use for Negative Sentiment. */
  invertDelta?: boolean
}

function DeltaBadge({
  delta,
  label,
  invert,
}: {
  delta: number
  label?: string
  invert?: boolean
}) {
  const isPositive = delta > 0
  const isZero = delta === 0
  const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown

  // invert = true means up is bad (e.g. negative sentiment rising)
  const isGood = invert ? !isPositive : isPositive
  const colorClass = isZero
    ? 'text-muted-foreground'
    : isGood
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-500 dark:text-red-400'

  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium', colorClass)}>
      <Icon className="w-3 h-3" />
      {delta > 0 ? '+' : ''}
      {delta.toFixed(1)}
      {label ?? ''}
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />
}

export function KpiCard({
  title,
  value,
  delta,
  deltaLabel,
  icon,
  loading,
  invertDelta,
}: KpiCardProps) {
  return (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        {loading ? (
          <>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-16" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground mb-1">{value}</p>
            {delta !== undefined && (
              <DeltaBadge delta={delta} label={deltaLabel} invert={invertDelta} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
