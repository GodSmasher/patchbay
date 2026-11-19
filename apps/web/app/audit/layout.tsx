import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit your MCP server in 30 seconds · patchbay',
  description: 'Paste an MCP endpoint URL. 37 security checks run server-side and you get the grade, the top findings and a shareable report. No sign-up, no install.',
  openGraph: {
    title: 'Audit your MCP server in 30 seconds · patchbay',
    description: 'OAuth 2.1 / RFC 9728 / RFC 8693 / poisoning / manifest drift — scan any public MCP server, share the grade.',
    type: 'website',
    url: 'https://patchbay-mcp.dev/audit',
  },
}

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return children
}
