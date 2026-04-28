import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'House Hack Intel',
  description: 'Utah real estate deal scanner',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className={cn('bg-background text-foreground min-h-screen', inter.variable)}>
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-6">
            <Link href="/" className="font-bold text-sm tracking-tight">
              House Hack Intel
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <nav className="flex gap-4">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Listings
              </Link>
              <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pipeline
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
