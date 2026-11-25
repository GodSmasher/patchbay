import type { Metadata } from 'next'
import Script from 'next/script'
import { SiteShell } from '@/components/site-shell'

const TITLE = 'Audit your MCP server in 30 seconds · patchbay'
const DESCRIPTION =
  'OAuth 2.1 / RFC 9728 / PKCE / tool poisoning — paste any public MCP endpoint, get a grade and findings in 30 seconds. No sign-up, no install. Free MIT-licensed CLI also available.'
const PAGE_URL = 'https://patchbay-mcp.dev/audit'
const OG_IMAGE_ALT = 'patchbay — open-source security scanner for MCP servers'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: PAGE_URL,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
    creator: '@sarahvogel_dev',
  },
}

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'patchbay',
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Any',
  description: DESCRIPTION,
  url: PAGE_URL,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: {
    '@type': 'Organization',
    name: 'patchbay',
    url: 'https://patchbay-mcp.dev',
  },
  softwareHelp: {
    '@type': 'CreativeWork',
    url: 'https://patchbay-mcp.dev/docs',
  },
  license: 'https://opensource.org/licenses/MIT',
}

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        id="audit-jsonld"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <SiteShell>{children}</SiteShell>
    </>
  )
}
