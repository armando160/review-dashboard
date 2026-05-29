'use client'

import { useFilters } from '@/hooks/use-filters'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { format, subDays, startOfYear } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import { ALL_BRANDS, ALL_CATEGORIES, cn } from '@/lib/utils'
import type { ReviewCategory, Sentiment } from '@/types'
import { useState } from 'react'

const DATE_PRESETS = [
  { label: 'Last 7d', from: () => subDays(new Date(), 7), to: () => new Date() },
  { label: 'Last 30d', from: () => subDays(new Date(), 30), to: () => new Date() },
  { label: 'Last 90d', from: () => subDays(new Date(), 90), to: () => new Date() },
  { label: 'YTD', from: () => startOfYear(new Date()), to: () => new Date() },
  { label: 'Last 12mo', from: () => subDays(new Date(), 365), to: () => new Date() },
]

const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative']

function MultiCheckFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: T[]
  selected: T[]
  onChange: (vals: T[]) => void
}) {
  const toggle = (val: T) =>
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val])

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1.5')}
      >
        {label}
        {selected.length > 0 && (
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
            {selected.length}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-2">
          {options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                id={`${label}-${opt}`}
                checked={selected.includes(opt)}
                onCheckedChange={() => toggle(opt)}
              />
              <Label htmlFor={`${label}-${opt}`} className="text-sm font-normal cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function GlobalFilters() {
  const { filters, setDateRange, setBrands, setCategories, setSentiments, setRatings, resetFilters } =
    useFilters()
  const [calOpen, setCalOpen] = useState(false)
  const isMobile = useIsMobile()

  const activeCount =
    filters.brands.length +
    filters.categories.length +
    filters.sentiments.length +
    filters.ratings.length

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range */}
      <Popover open={calOpen} onOpenChange={(open) => setCalOpen(open)}>
        <PopoverTrigger
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1.5')}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          {format(filters.dateFrom, 'MMM d')} – {format(filters.dateTo, 'MMM d, yyyy')}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setDateRange(p.from(), p.to())
                  setCalOpen(false)
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            selected={{ from: filters.dateFrom, to: filters.dateTo }}
            onSelect={(range) => {
              if (range?.from && range.to) {
                setDateRange(range.from, range.to)
                setCalOpen(false)
              }
            }}
            numberOfMonths={isMobile ? 1 : 2}
          />
        </PopoverContent>
      </Popover>

      {/* Brand */}
      <MultiCheckFilter
        label="Brand"
        options={ALL_BRANDS as string[] as typeof ALL_BRANDS}
        selected={filters.brands as string[]}
        onChange={setBrands}
      />

      {/* Star Rating */}
      <Popover>
        <PopoverTrigger
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 gap-1.5')}
        >
          Rating
          {filters.ratings.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {filters.ratings.length}
            </Badge>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-40 p-3" align="start">
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((r) => (
              <div key={r} className="flex items-center gap-2">
                <Checkbox
                  id={`rating-${r}`}
                  checked={filters.ratings.includes(r)}
                  onCheckedChange={() =>
                    setRatings(
                      filters.ratings.includes(r)
                        ? filters.ratings.filter((x) => x !== r)
                        : [...filters.ratings, r]
                    )
                  }
                />
                <Label htmlFor={`rating-${r}`} className="text-sm font-normal cursor-pointer">
                  {'★'.repeat(r)} {r}★
                </Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Category */}
      <MultiCheckFilter
        label="Category"
        options={ALL_CATEGORIES as ReviewCategory[]}
        selected={filters.categories}
        onChange={setCategories}
      />

      {/* Sentiment */}
      <MultiCheckFilter
        label="Sentiment"
        options={SENTIMENTS}
        selected={filters.sentiments}
        onChange={setSentiments}
      />

      {/* Reset */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground gap-1"
          onClick={resetFilters}
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
