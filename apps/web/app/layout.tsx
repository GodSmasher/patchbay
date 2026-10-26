import type { Metadata } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-nebius.vercel.app'
const TITLE = 'patchbay — describe an integration, get a tested connector'
const DESCRIPTION =
  'An agent that plans an API integration, reads the docs, writes a TypeScript connector with tests and proves it in an isolated sandbox. 90% green over 92 real runs on Nebius Token Factory.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'patchbay',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'patchbay' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
    creator: '@GodSmasher',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
