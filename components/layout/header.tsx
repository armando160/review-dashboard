'use client'

import { GlobalFilters } from '@/components/filters/global-filters'
import { GranularityToggle } from '@/components/filters/granularity-toggle'
import { useMobileMenu } from '@/hooks/use-mobile-menu'
import { Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const { open } = useMobileMenu()

  return (
    <div className="border-b border-border bg-card px-4 md:px-6 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
            onClick={open}
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-foreground leading-tight truncate">
              {title}
            </h1>
            {description && (
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <GranularityToggle />
        </div>
      </div>
      <GlobalFilters />
    </div>
  )
}
