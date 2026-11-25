import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PostHogProvider } from '@/components/posthog-provider'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'
const TITLE = 'patchbay — describe an integration, get a tested connector'
const DESCRIPTION =
  'One sentence in. Tested TypeScript connector out. 90% green over 92 real runs on Nemotron + Nebius sandboxes.'

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
  // PostHog Cloud (EU) — picked 2026-11-25 for the free-tier API.
  // Autocaptures $pageview with UTM parameters as event properties.
  // If NEXT_PUBLIC_POSTHOG_KEY is unset (dev builds without the var),
  // the provider short-circuits and no requests are made.
  return (
    <html lang="en">
      <body>
        {children}
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
      </body>
    </html>
  )
}
