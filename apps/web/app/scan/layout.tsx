import type { Metadata } from 'next'
import { ScanInfo, SCAN_FAQ } from '@/components/scan-info'
import { SiteShell } from '@/components/site-shell'

// /scan/page.tsx is a client component and cannot export metadata itself, so
// without this layout the page inherits the homepage title and description.
const TITLE = 'MCP server security scanner: free OAuth 2.1 audit | patchbay'
const DESCRIPTION =
  'Paste an MCP server URL and get a security grade in seconds. Checks authentication, OAuth 2.1 metadata, PKCE, client registration, scopes and transport. Free, open source, no account. 17 checks in the CLI.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/scan' },
  openGraph: {
    type: 'website',
    url: '/scan',
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'patchbay',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    creator: '@GodSmasher',
  },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'patchbay audit',
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Any',
  description: DESCRIPTION,
  url: 'https://patchbay-mcp.dev/scan',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  license: 'https://opensource.org/licenses/MIT',
  codeRepository: 'https://github.com/GodSmasher/patchbay',
}

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: SCAN_FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      {children}
      <ScanInfo />
    </SiteShell>
  )
}
