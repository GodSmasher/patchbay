import Link from 'next/link'
import { GlowShape } from '@/components/glow'
import { FoundingClaim } from '@/components/founding-claim'
import { claimedCount, FOUNDING_LIMIT, PRICE_FOUNDING, PRICE_REGULAR } from '@/lib/founding-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REF_RE = /^[\w.-]{1,64}$/

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I pay anything now?',
    a: 'No. You leave an email, nothing else. When hosted scans launch in January 2027 you get one email with a link to start at the founding price. You decide then.',
  },
  {
    q: 'What happens after the first 100?',
    a: 'The counter stops at 100 and the offer closes. Later sign-ups land on the regular waitlist and pay the regular price.',
  },
  {
    q: 'Does the CLI stay free?',
    a: 'Yes. The CLI, the GitHub Action and the browser scan stay free and MIT licensed. The hosted plan adds what needs a server: scheduled rescans, change alerts and history.',
  },
  {
    q: 'What do you store?',
    a: 'Your email, and the server URL if you add one. Nothing is sold or shared; one-click unsubscribe in every email.',
  },
]

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: { ref?: string; url?: string }
}) {
  const claimed = await claimedCount()
  const initial = {
    claimed: Math.min(claimed, FOUNDING_LIMIT),
    limit: FOUNDING_LIMIT,
    remaining: Math.max(0, FOUNDING_LIMIT - claimed),
  }
  const refTag = searchParams.ref && REF_RE.test(searchParams.ref) ? searchParams.ref : undefined
  // ?url= lets a personalised outreach link pre-fill the server we scanned.
  let prefillUrl: string | undefined
  try {
    if (searchParams.url && searchParams.url.length < 300) {
      const u = new URL(searchParams.url)
      if (u.protocol === 'https:') prefillUrl = u.toString()
    }
  } catch {}

  return (
    <main>
      <section className="relative">
        <GlowShape className="right-[-120px] top-[-40px] h-[340px] w-[320px] sm:right-[6%] lg:h-[600px] lg:w-[560px]" />
        <GlowShape className="left-[-160px] top-[420px] hidden h-[320px] w-[300px] lg:block" delay={-6} hue={35} />

        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:pt-20">
          <div>
            <p className="g-eyebrow">founding offer · first {FOUNDING_LIMIT} teams</p>
            <h1 className="mt-6 text-[clamp(60px,10.5vw,128px)] leading-[.9]">
              <span className="block">be one of</span>
              <span className="block pl-[0.5em] lg:pl-[1.2em]">the first</span>
              <span className="g-grad-text block">{FOUNDING_LIMIT}</span>
            </h1>
            <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft">
              Hosted patchbay audit launches in January 2027: scheduled rescans of your MCP servers,
              an alert when a tool manifest or OAuth metadata drifts, and the history per server. The
              first {FOUNDING_LIMIT} sign-ups get <span className="text-white">50% off the annual plan</span>.
            </p>

            <div className="mt-10 flex flex-wrap items-end gap-x-5 gap-y-2">
              <span className="font-display text-[clamp(88px,12vw,140px)] font-light leading-[.8] text-white"><span className="align-top text-[.45em] text-ink-soft">$</span>{PRICE_FOUNDING}</span>
              <span className="pb-2 text-ink-soft">
                <span className="block text-sm">per year</span>
                <span className="block text-sm">
                  instead of <span className="text-ink-mute line-through">${PRICE_REGULAR}</span>
                </span>
              </span>
              <span className="g-sev g-sev-critical mb-3">−50%</span>
            </div>
          </div>

          <div className="g-glass flex flex-col gap-6 self-start bg-[rgba(10,10,13,.78)] p-7 lg:mt-16">
            <p className="font-display text-3xl leading-tight">claim your spot</p>
            <FoundingClaim initial={initial} refTag={refTag} prefillUrl={prefillUrl} />
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-10 sm:px-8">
        <h2 className="text-center text-[clamp(38px,6vw,56px)] leading-none">how it works</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          <li className="g-glass g-tint-b flex min-h-[200px] flex-col justify-between p-7">
            <span className="font-mono text-[11px] text-[#ffb38a]">01 · today</span>
            <span>
              <span className="font-display block text-[28px] leading-tight">claim a spot</span>
              <span className="mt-2 block text-sm text-ink-soft">Email only. Add your server URL if you want it watched first.</span>
            </span>
          </li>
          <li className="g-glass g-tint-o flex min-h-[200px] flex-col justify-between p-7">
            <span className="font-mono text-[11px] text-[#ffb38a]">02 · january 2027</span>
            <span>
              <span className="font-display block text-[28px] leading-tight">one email at launch</span>
              <span className="mt-2 block text-sm text-ink-soft">With your founding price and a link to start. Nothing before that.</span>
            </span>
          </li>
          <li className="g-glass flex min-h-[200px] flex-col justify-between p-7" style={{ background: 'radial-gradient(120% 80% at 100% 0%, rgba(77,76,255,.24), transparent 60%), #0d0d11' }}>
            <span className="font-mono text-[11px] text-[#ffb38a]">03 · your call</span>
            <span>
              <span className="font-display block text-[28px] leading-tight">start at ${PRICE_FOUNDING}, or don&apos;t</span>
              <span className="mt-2 block text-sm text-ink-soft">No card on file, nothing charged without you clicking.</span>
            </span>
          </li>
        </ol>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-5 pt-20 sm:px-8 md:grid-cols-2">
        <div className="g-glass p-7">
          <p className="g-eyebrow" style={{ color: '#c3c8ff' }}>free · forever</p>
          <p className="font-display mt-3 text-3xl">the cli</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>Every check, run on your machine</li>
            <li>CI gate, SARIF, PR comments, GitHub Action</li>
            <li>Browser scan with a shareable report</li>
            <li>MIT licensed</li>
          </ul>
        </div>
        <div className="g-glass g-tint-o p-7">
          <p className="g-eyebrow">hosted · ${PRICE_FOUNDING} a year for founders</p>
          <p className="font-display mt-3 text-3xl">the hosted plan</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>Scheduled rescans of your servers</li>
            <li>An alert when a tool manifest or OAuth metadata changes</li>
            <li>History per server</li>
            <li>Everything in the CLI</li>
          </ul>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 pb-10 pt-20 sm:px-8 lg:grid-cols-[4fr_8fr]">
        <h2 className="text-[clamp(38px,6vw,56px)] leading-none">questions</h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((f, i) => (
            <details key={f.q} className="g-glass rounded-[18px] p-6" open={i === 0}>
              <summary className="font-display cursor-pointer text-xl">{f.q}</summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
          <p className="mt-2 text-sm text-ink-mute">
            Something else? <a href="mailto:hello@patchbay-mcp.dev" className="text-[#ffb38a] hover:text-white">hello@patchbay-mcp.dev</a> ·{' '}
            <Link href="/scan" className="text-[#ffb38a] hover:text-white">scan a server</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
