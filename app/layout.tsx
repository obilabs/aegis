import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Aegis - Open Source ITSM Platform',
  description: 'Self-hosted IT Service Management. Manage tickets, assets, contacts, and knowledge base. Break vendor lock-in.',
  keywords: ['ITSM', 'IT service management', 'helpdesk', 'ticketing', 'asset management', 'open source', 'self-hosted'],
  authors: [{ name: 'ObiLabs' }],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Aegis - Open Source ITSM Platform',
    description: 'Self-hosted IT Service Management. Break vendor lock-in.',
    // apps/aegis has no global canonical URL — every operator runs it
    // on their own domain. NEXT_PUBLIC_APP_URL is the operator's
    // self-declared URL (build-time baked); falls back to a generic
    // marker so social shares don't claim the wrong vendor domain.
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://aegis.local',
    siteName: 'Aegis',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased`}>{children}</body>
    </html>
  )
}
