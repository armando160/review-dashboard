import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { FiltersProvider } from '@/hooks/use-filters'
import { TooltipProvider } from '@/components/ui/tooltip'

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
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 flex flex-col min-w-0">{children}</main>
            </div>
          </TooltipProvider>
        </FiltersProvider>
      </body>
    </html>
  )
}
