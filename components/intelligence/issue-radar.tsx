'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/charts/kpi-scorecard'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { IssueCard } from './issue-card'
import { fetchIssueThemes, fetchIssueThemeStats } from '@/lib/queries'
import { ALL_BRANDS, cn } from '@/lib/utils'
import { AlertTriangle, AlertCircle, Package, CalendarPlus } from 'lucide-react'
import type { IssueTheme } from '@/types'

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const CATEGORIES = ['quality', 'design', 'durability', 'packaging', 'usability', 'shipping', 'other']
const STATUSES = ['active', 'acknowledged', 'resolved'] as const
const SORT_OPTIONS = [
  { value: 'mentions' as const, label: 'Mention count' },
  { value: 'newest' as const, label: 'Newest' },
]

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
              <Label htmlFor={`${label}-${opt}`} className="text-sm font-normal cursor-pointer capitalize">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function IssueRadar() {
  const [themes, setThemes] = useState<IssueTheme[]>([])
  const [stats, setStats] = useState<{
    activeCount: number
    criticalCount: number
    productsAffected: number
    newThisMonth: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Local filter state
  const [brands, setBrands] = useState<string[]>([])
  const [severity, setSeverity] = useState<string[]>([])
  const [category, setCategory] = useState<string[]>([])
  const [status, setStatus] = useState<string>('active')
  const [sortBy, setSortBy] = useState<'mentions' | 'severity' | 'newest'>('mentions')

  useEffect(() => {
    fetchIssueThemeStats()
      .then(setStats)
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchIssueThemes({ brands, severity, category, status, sortBy })
      .then(setThemes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [brands, severity, category, status, sortBy])

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Issues"
          value={stats?.activeCount?.toLocaleString() ?? '—'}
          icon={<AlertTriangle className="w-4 h-4" />}
          loading={!stats}
          tooltip="Total number of issue themes with 'active' status"
        />
        <KpiCard
          title="Critical Issues"
          value={stats?.criticalCount?.toLocaleString() ?? '—'}
          icon={<AlertCircle className="w-4 h-4" />}
          loading={!stats}
          tooltip="Issue themes marked as critical severity"
        />
        <KpiCard
          title="Products Affected"
          value={stats?.productsAffected?.toLocaleString() ?? '—'}
          icon={<Package className="w-4 h-4" />}
          loading={!stats}
          tooltip="Unique ASINs with at least one active issue theme"
        />
        <KpiCard
          title="New This Month"
          value={stats?.newThisMonth?.toLocaleString() ?? '—'}
          icon={<CalendarPlus className="w-4 h-4" />}
          loading={!stats}
          tooltip="Issue themes created during the current month"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiCheckFilter
          label="Brand"
          options={ALL_BRANDS}
          selected={brands}
          onChange={setBrands}
        />
        <MultiCheckFilter
          label="Severity"
          options={SEVERITIES}
          selected={severity}
          onChange={setSeverity}
        />
        <MultiCheckFilter
          label="Category"
          options={CATEGORIES}
          selected={category}
          onChange={setCategory}
        />

        {/* Status toggle */}
        <div className="flex items-center gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={status === s ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs capitalize"
              onClick={() => setStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-muted-foreground">Sort:</span>
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={sortBy === opt.value ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSortBy(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Issue Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-lg h-48" />
          ))}
        </div>
      ) : themes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No issue themes found matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {themes.map((theme) => (
            <IssueCard key={theme.id} theme={theme} />
          ))}
        </div>
      )}
    </div>
  )
}
