import type { Metadata } from 'next'
import { SiteShell } from '@/components/site-shell'

const TITLE = 'Founding offer: 50% off hosted MCP security scans · patchbay'
const DESCRIPTION =
  'The first 100 teams get the hosted patchbay audit plan for $149 a year instead of $298. Scheduled rescans, drift alerts, history per server. Nothing charged until launch in January 2027.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/early-access' },
  openGraph: { type: 'website', url: '/early-access', title: TITLE, description: DESCRIPTION, siteName: 'patchbay' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, creator: '@GodSmasher' },
}

export default function EarlyAccessLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
