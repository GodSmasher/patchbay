import type { Metadata } from 'next'

// /scan/page.tsx is a client component and cannot export metadata itself, so
// without this layout the page inherits the homepage title and description.
const TITLE = 'MCP server security scanner: free OAuth 2.1 audit | patchbay'
const DESCRIPTION =
  'Paste an MCP server URL and get a security grade in seconds. 16 checks for OAuth 2.1, PKCE, audience validation, loopback redirects, scopes and exposed secrets. Free, open source, no account.'

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

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      {children}
    </>
  )
}
