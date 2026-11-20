import { Resend } from 'resend'
import { unsubscribeToken } from './lead-store'

/**
 * Transactional email via Resend.
 *
 * Fires from /api/watch after a lead is saved (fire-and-forget: a failed mail
 * never breaks the signup). Later the weekly digest flow uses the same
 * `sendMail()` primitive.
 *
 * Every message carries the standard RFC 8058 `List-Unsubscribe` header AND a
 * visible one-click link in the footer, so Gmail / iCloud / Outlook show a
 * native unsubscribe button and the user can also click through themselves.
 */

const FROM = process.env.RESEND_FROM || 'patchbay <hello@patchbay-mcp.dev>'
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://patchbay-mcp.dev'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function unsubUrl(email: string): string {
  const token = unsubscribeToken(email)
  return `${BASE}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
}

export interface WelcomeMailInput {
  email: string
  target: string
  grade: string
  score: number
  reportId: string
}

export interface TallyWelcomeMailInput {
  email: string
  useCase?: string
  priceAnswer?: string
  /** Where the signup happened; only changes the footer line. Defaults to 'tally'. */
  origin?: 'tally' | 'site'
}

export async function sendWelcomeMail(input: WelcomeMailInput): Promise<{ ok: boolean; error?: string }> {
  const r = client()
  if (!r) return { ok: false, error: 'RESEND_API_KEY not configured' }

  const unsub = unsubUrl(input.email)
  const reportUrl = `${BASE}/report/${input.reportId}`
  const scanUrl = `${BASE}/scan`
  const targetHost = new URL(input.target).hostname
  const targetPath = new URL(input.target).pathname

  const subject = `patchbay is watching ${targetHost} for you`

  const text = [
    `Thanks for signing up.`,
    ``,
    `You asked patchbay to watch the MCP server at ${targetHost}${targetPath}.`,
    `Its current grade is ${input.grade} (score ${input.score}/100).`,
    `Full report: ${reportUrl}`,
    ``,
    `Hosted monitoring launches January 2027. Until then we are only sending this one welcome mail,`,
    `plus one email when the live alerts go on.`,
    ``,
    `We will not send you anything else. One-click unsubscribe:`,
    unsub,
    ``,
    `Sarah`,
    `${BASE}/scan`,
  ].join('\n')

  // Zero-width space between scheme and host prevents Gmail's auto-linker
  // from turning the target into a clickable link (which 405s on MCP GET).
  const targetDisplay = `${targetHost}&#8203;${targetPath}`

  const html = `<!doctype html>
<html>
<body style="font-family: ui-sans-serif, system-ui, sans-serif; background:#fbfaf7; color:#15161a; margin:0; padding:40px 16px; line-height:1.55;">
  <div style="max-width: 560px; margin: 0 auto;">
    <p style="font-size: 13px; color:#6b6b6b; margin:0 0 24px;">patchbay</p>

    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">Thanks for signing up.</h1>

    <p style="margin:0 0 12px;">You asked patchbay to watch the MCP server at <strong>${targetDisplay}</strong>.</p>
    <p style="margin:0 0 20px;">Its current grade is <strong>${input.grade}</strong> (score ${input.score}/100).</p>

    <p style="margin:0 0 24px;">
      <a href="${reportUrl}" style="display:inline-block; background:#15161a; color:#fbfaf7; padding:10px 16px; text-decoration:none; border-radius:4px; font-weight:500;">Open full report</a>
    </p>

    <p style="margin:0 0 12px;">
      Hosted monitoring launches January 2027. Until then we are only sending this one welcome mail,
      plus one email when the live alerts go on.
    </p>

    <p style="margin:0 0 20px;">
      Want to scan another MCP server now? <a href="${scanUrl}" style="color:#15161a;">Run another scan</a>.
    </p>

    <p style="margin:24px 0 8px; font-size: 13px; color:#6b6b6b;">Sarah</p>

    <hr style="border:none; border-top:1px solid #e8e5dd; margin:32px 0 16px;">
    <p style="font-size: 12px; color:#8a8a8a; margin:0;">
      You are receiving this because you clicked Watch on <a href="${scanUrl}" style="color:#8a8a8a;">patchbay-mcp.dev/scan</a>.
      <a href="${unsub}" style="color:#8a8a8a;">Unsubscribe in one click</a> or read the
      <a href="${BASE}/privacy" style="color:#8a8a8a;">privacy policy</a>.
    </p>
  </div>
</body>
</html>`

  try {
    const result = await r.emails.send({
      from: FROM,
      to: input.email,
      subject,
      text,
      html,
      headers: {
        'List-Unsubscribe': `<${unsub}>, <mailto:hello@patchbay-mcp.dev?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Welcome mail for Tally "hosted scans early access" survey respondents.
 * Different wording than the /scan Watch mail because these users have not
 * scanned anything yet, they just told us what they would use the hosted
 * version for.
 */
export async function sendTallyWelcomeMail(input: TallyWelcomeMailInput): Promise<{ ok: boolean; error?: string }> {
  const r = client()
  if (!r) return { ok: false, error: 'RESEND_API_KEY not configured' }

  const unsub = unsubUrl(input.email)
  const scanUrl = `${BASE}/scan`
  const subject = `You are on the patchbay early-access list`
  const signedUpAt = input.origin === 'site' ? 'on patchbay-mcp.dev' : 'at tally.so'

  const useCaseLine = input.useCase
    ? `We saw your note on what you would use hosted scans for ("${input.useCase.slice(0, 120)}") and it will shape what ships.`
    : `When hosted scans go live, we will match the first batch of features to what early-access respondents told us they need.`

  const priceLine = input.priceAnswer
    ? `You answered "${input.priceAnswer}" on the pricing question. Noted. Final pricing will reflect what this group said.`
    : ''

  const text = [
    `Thanks for signing up for early access.`,
    ``,
    useCaseLine,
    priceLine,
    ``,
    `While hosted scans are being built, the free CLI and the browser scan at ${scanUrl} already give you the same checks, just run manually.`,
    ``,
    `You will get one email when hosted scans launch (targeting January 2027) and nothing else between now and then.`,
    ``,
    `One-click unsubscribe:`,
    unsub,
    ``,
    `Sarah`,
    `${scanUrl}`,
  ].filter(Boolean).join('\n')

  const useCaseHtml = input.useCase
    ? `<p style="margin:0 0 12px;">We saw your note on what you would use hosted scans for and it will shape what ships.</p>`
    : `<p style="margin:0 0 12px;">When hosted scans go live, we will match the first batch of features to what early-access respondents told us they need.</p>`

  const priceHtml = input.priceAnswer
    ? `<p style="margin:0 0 20px;">You answered <strong>${input.priceAnswer}</strong> on the pricing question. Noted. Final pricing will reflect what this group said.</p>`
    : ''

  const html = `<!doctype html>
<html>
<body style="font-family: ui-sans-serif, system-ui, sans-serif; background:#fbfaf7; color:#15161a; margin:0; padding:40px 16px; line-height:1.55;">
  <div style="max-width: 560px; margin: 0 auto;">
    <p style="font-size: 13px; color:#6b6b6b; margin:0 0 24px;">patchbay</p>

    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">You are on the early-access list.</h1>

    ${useCaseHtml}
    ${priceHtml}

    <p style="margin:0 0 20px;">
      While hosted scans are being built, the free CLI and the browser scan at
      <a href="${scanUrl}" style="color:#15161a;">patchbay-mcp.dev/scan</a>
      already run the same checks, just manually.
    </p>

    <p style="margin:0 0 24px;">
      <a href="${scanUrl}" style="display:inline-block; background:#15161a; color:#fbfaf7; padding:10px 16px; text-decoration:none; border-radius:4px; font-weight:500;">Try the browser scan</a>
    </p>

    <p style="margin:0 0 12px;">
      You will get one email when hosted scans launch (targeting January 2027) and nothing else between now and then.
    </p>

    <p style="margin:24px 0 8px; font-size: 13px; color:#6b6b6b;">Sarah</p>

    <hr style="border:none; border-top:1px solid #e8e5dd; margin:32px 0 16px;">
    <p style="font-size: 12px; color:#8a8a8a; margin:0;">
      You are receiving this because you signed up ${signedUpAt} for patchbay hosted scans early access.
      <a href="${unsub}" style="color:#8a8a8a;">Unsubscribe in one click</a> or read the
      <a href="${BASE}/privacy" style="color:#8a8a8a;">privacy policy</a>.
    </p>
  </div>
</body>
</html>`

  try {
    const result = await r.emails.send({
      from: FROM,
      to: input.email,
      subject,
      text,
      html,
      headers: {
        'List-Unsubscribe': `<${unsub}>, <mailto:hello@patchbay-mcp.dev?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export interface FoundingMailInput {
  email: string
  position: number
  founding: boolean
}

/**
 * Confirmation for /early-access. Founding members (#1–#100) get their spot
 * number and the locked price; everyone after that gets a plain waitlist
 * confirmation at the regular price.
 */
export async function sendFoundingMail(input: FoundingMailInput): Promise<{ ok: boolean; error?: string }> {
  const r = client()
  if (!r) return { ok: false, error: 'RESEND_API_KEY not configured' }

  const unsub = unsubUrl(input.email)
  const scanUrl = `${BASE}/scan`
  const offerUrl = `${BASE}/early-access`

  const subject = input.founding
    ? `You're founding member #${input.position} — $149/year locked`
    : `You're on the patchbay waitlist (#${input.position})`

  const lines = input.founding
    ? [
        `You claimed founding spot #${input.position} of 100.`,
        ``,
        `Your price for the hosted plan: $149 per year instead of $298 — 50% off.`,
        `Nothing is charged now. When hosted scans launch in January 2027 we send you one email`,
        `with a link to start. You decide then; no card, no commitment until you click.`,
      ]
    : [
        `All 100 founding spots were taken before you got here — sorry.`,
        `You're #${input.position} on the waitlist. We email you once when hosted scans launch in January 2027.`,
      ]

  const text = [
    ...lines,
    ``,
    `Until then the CLI and the browser scan stay free: ${scanUrl}`,
    ``,
    `Sarah`,
    ``,
    `One-click unsubscribe: ${unsub}`,
  ].join('\n')

  const headline = input.founding ? `You're founding member #${input.position}.` : `You're on the waitlist.`
  const body = input.founding
    ? `<p style="margin:0 0 16px;">Your price for the hosted plan is locked at
         <strong style="color:#ffffff;">$149 per year</strong>
         <span style="color:#a3a3ad;text-decoration:line-through;">$298</span> — 50% off.</p>
       <p style="margin:0 0 16px;">Nothing is charged now. When hosted scans launch in January 2027 we send you
         one email with a link to start. You decide then.</p>`
    : `<p style="margin:0 0 16px;">All 100 founding spots were taken before you got here. You're
         <strong style="color:#ffffff;">#${input.position}</strong> on the waitlist — one email when hosted scans
         launch in January 2027.</p>`

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:40px 16px;background:#000000;color:#c8c8d0;font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="margin:0 0 28px;font-size:13px;color:#f4f4f6;">● patchbay audit</p>
    <div style="border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:32px;background:#0d0d11;">
      <p style="margin:0 0 10px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#ffb38a;">founding offer · first 100</p>
      <h1 style="margin:0 0 20px;font-size:30px;line-height:1.1;font-weight:400;letter-spacing:-.02em;color:#f4f4f6;">${headline}</h1>
      ${body}
      <p style="margin:24px 0 0;">
        <a href="${scanUrl}" style="display:inline-block;background:linear-gradient(90deg,#ff6a2b,#ffa36b);background-color:#ff6a2b;color:#000000;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:500;font-size:14px;">Scan a server meanwhile</a>
      </p>
    </div>
    <p style="margin:24px 0 0;font-size:14px;color:#c8c8d0;">Sarah</p>
    <p style="margin:32px 0 0;font-size:12px;color:#8e8e98;">
      You're receiving this because you signed up at <a href="${offerUrl}" style="color:#8e8e98;">patchbay-mcp.dev/early-access</a>.
      <a href="${unsub}" style="color:#8e8e98;">Unsubscribe in one click</a> ·
      <a href="${BASE}/privacy" style="color:#8e8e98;">privacy policy</a>
    </p>
  </div>
</body>
</html>`

  try {
    const result = await r.emails.send({
      from: FROM,
      to: input.email,
      subject,
      text,
      html,
      headers: {
        'List-Unsubscribe': `<${unsub}>, <mailto:hello@patchbay-mcp.dev?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    if (result.error) return { ok: false, error: result.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
