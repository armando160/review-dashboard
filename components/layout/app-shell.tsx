'use client'

import { Sidebar } from './sidebar'
import { useMobileMenu } from '@/hooks/use-mobile-menu'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useMobileMenu()

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — always visible at md+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={close}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div className="relative z-10 h-full w-fit">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  )
}
