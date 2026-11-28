import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing · patchbay',
  description:
    'Simple pricing for the hosted patchbay plan: weekly or daily rescans of your MCP server, email on grade change, drift alerts. Single $29/mo. Team $149/mo. Founding-100 $149/yr.',
  alternates: { canonical: 'https://patchbay-mcp.dev/pricing' },
}

type Tier = {
  key: string
  name: string
  price: string
  cadence: string
  description: string
  features: string[]
  checkoutHref: string
  highlighted?: boolean
  footnote?: string
}

const POLAR_BASE = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_BASE || ''

function priceLink(product: string): string {
  // Each Polar product exposes a checkout URL. We read product IDs from
  // env so Sarah can rotate them without a code deploy.
  const map: Record<string, string | undefined> = {
    'single-monthly': process.env.NEXT_PUBLIC_POLAR_PRICE_SINGLE_MONTHLY,
    'single-annual-founding': process.env.NEXT_PUBLIC_POLAR_PRICE_SINGLE_ANNUAL_FOUNDING,
    'single-annual': process.env.NEXT_PUBLIC_POLAR_PRICE_SINGLE_ANNUAL,
    'team-monthly': process.env.NEXT_PUBLIC_POLAR_PRICE_TEAM_MONTHLY,
  }
  const id = map[product]
  if (!id) return '#not-configured'
  // Polar hosted-checkout URL shape. Overridable via POLAR_BASE.
  const base = POLAR_BASE || 'https://buy.polar.sh/polar_cl_'
  return `${base}${id}`
}

const TIERS: Tier[] = [
  {
    key: 'single-monthly',
    name: 'Single',
    price: '$29.99',
    cadence: 'per month',
    description: 'One MCP endpoint, weekly rescan, email on grade change.',
    features: ['1 endpoint', 'weekly rescan', 'email alerts on grade change', 'public leaderboard listing'],
    checkoutHref: priceLink('single-monthly'),
  },
  {
    key: 'single-annual-founding',
    name: 'Single — Founding-100',
    price: '$149',
    cadence: 'per year',
    description: 'First 100 subscribers only. ½ off standard annual. Then $299/yr.',
    features: ['1 endpoint', 'weekly rescan', 'email alerts on grade change', 'public leaderboard listing', '"founding member" badge'],
    checkoutHref: priceLink('single-annual-founding'),
    highlighted: true,
    footnote: 'Limited to the first 100 subscribers.',
  },
  {
    key: 'single-annual',
    name: 'Single — Annual',
    price: '$299',
    cadence: 'per year',
    description: 'Same as monthly, billed yearly. Standard price after Founding-100 fills up.',
    features: ['1 endpoint', 'weekly rescan', 'email alerts on grade change', 'public leaderboard listing'],
    checkoutHref: priceLink('single-annual'),
  },
  {
    key: 'team-monthly',
    name: 'Team',
    price: '$149',
    cadence: 'per month',
    description: 'Up to 10 endpoints, daily rescan, 5 teammates.',
    features: ['10 endpoints', 'daily rescan', '5 seats', 'email alerts on grade change', 'drift alerts (new finding since last scan)', 'public leaderboard listing'],
    checkoutHref: priceLink('team-monthly'),
  },
]

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-6xl leading-none">Pricing</h1>
      <p className="mt-4 max-w-xl text-ink-soft">
        One-shot scanning at <Link href="/audit" className="underline underline-offset-2">/audit</Link> stays free forever. The hosted plan is for teams that want
        continuous re-scanning + email alerts the moment anything changes.
      </p>
      <p className="mt-2 text-xs text-ink-mute">Billing by Polar.sh. Cancel any time, prorated refund.</p>

      <section className="mt-12 grid gap-5 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <div
            key={tier.key}
            className={`g-glass flex flex-col gap-4 rounded-2xl p-6 ${tier.highlighted ? 'g-tint-o' : ''}`}
          >
            <div>
              <div className="font-mono text-[11px] text-[#ffb38a]">{tier.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl">{tier.price}</span>
                <span className="text-sm text-ink-mute">/ {tier.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{tier.description}</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-sm text-ink-soft">
              {tier.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <a href={tier.checkoutHref} className={`g-btn ${tier.highlighted ? 'g-btn-o' : 'g-btn-w'} mt-2 text-center`}>
              {tier.checkoutHref === '#not-configured' ? 'coming soon' : 'start'}
            </a>
            {tier.footnote && <p className="text-xs text-ink-mute">{tier.footnote}</p>}
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="font-display text-3xl">Enterprise</h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          More than 10 endpoints, SSO, custom SLAs, private-MCP scanning workers inside your network, or a specific
          compliance posture? Email sarah@patchbay-mcp.dev and we'll set up a call.
        </p>
      </section>
    </main>
  )
}
