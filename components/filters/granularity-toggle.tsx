'use client'

import { useFilters } from '@/hooks/use-filters'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Granularity } from '@/types'

const OPTIONS: { label: string; value: Granularity }[] = [
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
  { label: 'Monthly', value: 'month' },
]

export function GranularityToggle() {
  const { filters, setGranularity } = useFilters()

  return (
    <div className="flex items-center border border-border rounded-md overflow-hidden">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 rounded-none px-3 text-xs font-medium border-r last:border-r-0 border-border',
            filters.granularity === opt.value
              ? 'bg-primary text-primary-foreground hover:bg-primary'
              : 'hover:bg-accent'
          )}
          onClick={() => setGranularity(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
