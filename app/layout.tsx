import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'House Hack Intel',
  description: 'Utah real estate deal scanner',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex gap-6 items-center">
          <span className="font-bold text-gray-900">House Hack Intel</span>
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">Listings</a>
          <a href="/pipeline" className="text-sm text-gray-600 hover:text-gray-900">Pipeline</a>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
