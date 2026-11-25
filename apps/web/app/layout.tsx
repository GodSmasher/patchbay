import type { Metadata } from 'next'
import Script from 'next/script'
import { UmamiUtmCapture } from '@/components/umami-utm'
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
  // Umami Cloud — Sarah picked Umami over Plausible on 2026-11-18 (free
  // tier up to 10k events/month). Website id is not secret; env-gate so
  // dev / preview can override, fall back to the production id when not
  // set so the prod deploy never silently drops analytics.
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || 'f49ceef8-1492-4db4-907a-57d4bb6fceee'
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js'
  return (
    <html lang="en">
      <body>
        {children}
        {umamiWebsiteId && (
          <>
            <Script
              defer
              data-website-id={umamiWebsiteId}
              src={umamiSrc}
              strategy="afterInteractive"
            />
            <UmamiUtmCapture />
          </>
        )}
      </body>
    </html>
  )
}
