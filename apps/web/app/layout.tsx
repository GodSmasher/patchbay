import type { Metadata } from 'next'
import Script from 'next/script'
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
  // Plausible Analytics — self-hosted or plausible.io, gated on the env var
  // so it never injects a tag in dev or on preview deployments where the
  // domain is not set. Enable in production by setting
  // NEXT_PUBLIC_PLAUSIBLE_DOMAIN=patchbay-mcp.dev (and optionally
  // NEXT_PUBLIC_PLAUSIBLE_SRC for a custom host).
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.tagged-events.outbound-links.js'
  return (
    <html lang="en">
      <body>
        {children}
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src={plausibleSrc}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
