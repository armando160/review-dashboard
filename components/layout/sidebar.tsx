'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, TrendingUp, Package, MessageSquare, Lightbulb, BookOpen, Activity, X } from 'lucide-react'
import { useMobileMenu } from '@/hooks/use-mobile-menu'

const navItems = [
  { href: '/', label: 'Executive Overview', icon: BarChart3 },
  { href: '/categories', label: 'Category Intelligence', icon: TrendingUp },
  { href: '/products', label: 'Product Analysis', icon: Package },
  { href: '/reviews', label: 'Review Drill-Down', icon: MessageSquare },
  { href: '/intelligence', label: 'Review Intelligence', icon: Lightbulb },
  { href: '/health', label: 'Data Health', icon: Activity },
  { href: '/guidelines', label: 'Guidelines', icon: BookOpen },
]

export function Sidebar() {
  const pathname = usePathname()
  const { close } = useMobileMenu()

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-card h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Chai Vision
          </div>
          <div className="text-base font-bold text-foreground mt-0.5">Review Analytics</div>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          onClick={close}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={close}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground/60 leading-snug">
          Review data sourced from{' '}
          <a
            href="https://www.woot.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground transition-colors"
          >
            Woot.com
          </a>
        </p>
      </div>
    </aside>
  )
}
