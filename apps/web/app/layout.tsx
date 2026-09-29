import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'patchbay — describe an integration, get a tested connector',
  description:
    'An agent that plans an API integration, reads the docs, writes a TypeScript connector with tests and proves it in an isolated sandbox. Nemotron on Nebius Token Factory.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
