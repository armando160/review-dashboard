'use client'

import { GlobalFilters } from '@/components/filters/global-filters'
import { GranularityToggle } from '@/components/filters/granularity-toggle'

interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <GranularityToggle />
      </div>
      <GlobalFilters />
    </div>
  )
}
