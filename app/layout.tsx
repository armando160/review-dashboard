import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'
import { FiltersProvider } from '@/hooks/use-filters'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MobileMenuProvider } from '@/hooks/use-mobile-menu'

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Review Analytics | Chai Vision',
  description: 'Amazon review analytics dashboard for 9-brand ecommerce portfolio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="bg-background text-foreground antialiased">
        <FiltersProvider>
          <TooltipProvider>
            <MobileMenuProvider>
              <AppShell>{children}</AppShell>
            </MobileMenuProvider>
          </TooltipProvider>
        </FiltersProvider>
      </body>
    </html>
  )
}
