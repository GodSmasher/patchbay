import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'

/**
 * `patchbay scan <dir>` walks a repository looking for integration opportunities
 * patchbay could build. It reports a prioritised list with a concrete one-sentence
 * prompt per opportunity so the user can go straight to `patchbay build "..."`
 * (or `patchbay scan <dir> --build-top=N` for the hands-off path).
 *
 * The scanner is deliberately heuristic — regex + file-structure only, no LLM —
 * so it's instant, free, and the user can audit every signal we flagged.
 */

export interface Opportunity {
  score: number
  kind: 'todo' | 'env-var' | 'webhook-handler' | 'vendor-sdk-import'
  file: string
  line: number
  evidence: string
  prompt: string
  vendors: string[]
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'out', 'build', '.turbo', '.vercel', 'coverage'])
const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rb', '.env', '.example'])
const SCAN_MAX_BYTES = 500_000

/** Default cap on the formatted report so a template repo doesn't produce 100 lines. */
const DEFAULT_REPORT_LIMIT = 15

const INTEGRATION_KEYWORDS = /\b(webhook|sync|notify|integrate|forward|post\s+to|send\s+to|push\s+to|pull\s+from|fetch\s+from|subscribe|publish|route\s+to|hook\s+into)\b/i

/** Vendor name → canonical title case for the prompt. */
const VENDOR_HINTS: Record<string, string> = {
  stripe: 'Stripe', shopify: 'Shopify', mailchimp: 'Mailchimp', typeform: 'Typeform', pipedrive: 'Pipedrive',
  hubspot: 'HubSpot', salesforce: 'Salesforce', slack: 'Slack', discord: 'Discord', notion: 'Notion',
  airtable: 'Airtable', asana: 'Asana', jira: 'Jira', linear: 'Linear', github: 'GitHub', gitlab: 'GitLab',
  zendesk: 'Zendesk', intercom: 'Intercom', twilio: 'Twilio', sendgrid: 'SendGrid', brevo: 'Brevo',
  resend: 'Resend', postmark: 'Postmark', mailgun: 'Mailgun', calendly: 'Calendly', jotform: 'Jotform',
  pusher: 'Pusher', zoom: 'Zoom', trello: 'Trello', freshdesk: 'Freshdesk', monday: 'Monday',
  quickbooks: 'QuickBooks', xero: 'Xero', paypal: 'PayPal', square: 'Square',
}

const VENDOR_PATTERN = new RegExp(`\\b(${Object.keys(VENDOR_HINTS).join('|')})\\b`, 'gi')

export interface ScanInputFile {
  /** Repo-relative path, forward slashes. */
  path: string
  content: string
}

/**
 * Scan a list of in-memory files. Used by both the CLI (which populates it by walking
 * disk) and the web scanner (which populates it from the GitHub REST API).
 */
export function scanFiles(files: ScanInputFile[]): Opportunity[] {
  const opportunities: Opportunity[] = []
  const contentByPath = new Map<string, string>()
  for (const f of files) contentByPath.set(f.path, f.content)
  for (const { path, content } of files) {
    if (content.length > SCAN_MAX_BYTES) continue
    const name = basename(path).toLowerCase()
    const lines = content.split('\n')
    if (name.endsWith('.env') || name.endsWith('.env.example') || name === '.env.example' || name === '.env.sample') {
      opportunities.push(...scanEnvFile(path, lines))
    }
    opportunities.push(...scanTodos(path, lines))
    opportunities.push(...scanWebhookHandlers(path, lines, content))
    opportunities.push(...scanVendorImportsFromMemory(path, lines, contentByPath))
  }
  return rankAndDedupe(opportunities)
}

export function scanRepo(root: string): Opportunity[] {
  const paths = walk(root)
  const files: ScanInputFile[] = []
  for (const abs of paths) {
    try {
      const size = statSync(abs).size
      if (size > SCAN_MAX_BYTES) continue
      files.push({ path: relative(root, abs).replace(/\\/g, '/'), content: readFileSync(abs, 'utf8') })
    } catch { /* skip */ }
  }
  return scanFiles(files)
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const entry of entries) {
    if (entry.startsWith('.') && !entry.startsWith('.env')) continue
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walk(full, out)
    else if (SCAN_EXTS.has(extname(entry).toLowerCase()) || entry.startsWith('.env')) out.push(full)
  }
  return out
}

function scanEnvFile(file: string, lines: string[]): Opportunity[] {
  const found: Opportunity[] = []
  const grouped = new Map<string, { line: number; vars: string[] }>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const match = line.match(/^([A-Z][A-Z0-9_]+)=/)
    if (!match) continue
    const key = match[1]!
    const vendor = detectVendor(key.toLowerCase())
    if (!vendor) continue
    const bucket = grouped.get(vendor) ?? { line: i + 1, vars: [] }
    bucket.vars.push(key)
    grouped.set(vendor, bucket)
  }
  for (const [vendor, info] of grouped) {
    const title = VENDOR_HINTS[vendor]!
    found.push({
      score: 60 + info.vars.length * 5,
      kind: 'env-var',
      file,
      line: info.line,
      evidence: info.vars.join(', '),
      vendors: [title],
      prompt: `When something happens that needs ${title}, call ${title}'s API with the fields configured via ${info.vars.join(' / ')}.`,
    })
  }
  return found
}

function scanTodos(file: string, lines: string[]): Opportunity[] {
  const found: Opportunity[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    // Only inline / block comments, not strings or type literals.
    const match = line.match(/(?:\/\/|\/\*|#|<!--|\*)\s*(?:TODO|FIXME|XXX|HACK)\b[: ]*(.*)/i)
    if (!match) continue
    const text = match[1]!.replace(/\*\/\s*$/, '').trim()
    if (text.length < 15) continue
    if (!INTEGRATION_KEYWORDS.test(text) && !VENDOR_PATTERN.test(text)) continue
    const vendors = detectVendors(text)
    // Guard against false positives like "colored square like list" where the
    // vendor pattern matches a plain English word. If the ONLY signal is a
    // vendor name AND that name is also a common English word AND there's no
    // integration keyword, skip it.
    if (vendors.length > 0 && !INTEGRATION_KEYWORDS.test(text)) {
      const vendorText = vendors.join(' ').toLowerCase()
      const AMBIGUOUS = /^(square|monday|discord|notion|linear|slack|resend|pipeline|hook|paypal)$/
      if (vendors.length === 1 && AMBIGUOUS.test(vendorText.split(' ')[0]!)) continue
    }
    found.push({
      score: 50 + vendors.length * 10 + (INTEGRATION_KEYWORDS.test(text) ? 10 : 0),
      kind: 'todo',
      file,
      line: i + 1,
      evidence: text.slice(0, 160),
      vendors,
      prompt: text.length < 180 && /^when|^on\b/i.test(text) ? text : promptFromTodo(text, vendors),
    })
  }
  return found
}

function scanWebhookHandlers(file: string, lines: string[], content: string): Opportunity[] {
  const found: Opportunity[] = []
  // Node/TS: look for Express/Next route handlers that are near-empty or throw.
  const routeRe = /(?:router|app)\.(?:post|put|patch)\s*\(\s*['"`]([^'"`]*(?:webhook|hook|callback|notify|event)[^'"`]*)['"`]/gi
  let m: RegExpExecArray | null
  while ((m = routeRe.exec(content))) {
    const path = m[1]!
    const upto = content.slice(0, m.index)
    const lineNo = upto.split('\n').length
    const windowStart = Math.max(0, lineNo - 1)
    const window = lines.slice(windowStart, Math.min(lines.length, windowStart + 20)).join('\n')
    const stubby = /(TODO|FIXME|not\s+implemented|throw\s+new\s+Error)/i.test(window) || window.replace(/[^{}]/g, '').length < 4
    if (!stubby) continue
    const vendors = detectVendors(path + ' ' + window)
    found.push({
      score: 70 + vendors.length * 10,
      kind: 'webhook-handler',
      file,
      line: lineNo,
      evidence: `${path} — route body is empty / TODO / not-implemented`,
      vendors,
      prompt: vendors.length
        ? `When a ${vendors[0]} webhook hits ${path}, handle the payload and ${inferAction(vendors)}.`
        : `When an incoming webhook hits ${path}, verify the signature, parse the payload and forward the result to the configured target.`,
    })
  }
  return found
}

/** SDK import specifiers that are frameworks (not integrations) — skip entirely. */
const FRAMEWORK_IMPORT_HINTS = /\/(hydrogen|remix-oxygen|next|nuxt|express|fastify|koa|hono|svelte|solid|qwik|astro|react|vue|polaris|themes|plugin|cli)(\/|$)/i

function scanVendorImports(file: string, lines: string[]): Opportunity[] {
  const found: Opportunity[] = []
  // Skip declaration files and generated code — these are types, not business logic.
  if (file.endsWith('.d.ts') || file.includes('.generated.') || file.includes('/generated/')) return found
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const match = line.match(/(?:from\s+|require\(\s*)['"]([^'"\n]+)['"]/)
    if (!match) continue
    const spec = match[1]!
    // Only real npm packages: skip relative imports (./x, ../x) and node builtins (node:x).
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue
    // Skip framework/toolkit imports that happen to contain a vendor name (e.g. @shopify/hydrogen is a framework not Shopify as an integration target).
    if (FRAMEWORK_IMPORT_HINTS.test(spec)) continue
    const vendor = detectVendor(spec.replace(/^@/, '').toLowerCase())
    if (!vendor) continue
    // Count how many times the vendor name shows up in the file to tell "imported-and-used" from "imported-but-stubbed".
    const vendorUses = (readSafe(file).match(new RegExp(`\\b${vendor}`, 'gi')) || []).length
    if (vendorUses > 6) continue // actively used; probably not an opportunity
    const title = VENDOR_HINTS[vendor]!
    found.push({
      score: 40 + (vendorUses < 3 ? 15 : 0),
      kind: 'vendor-sdk-import',
      file,
      line: i + 1,
      evidence: `imports '${spec}' but only uses "${vendor}" ${vendorUses}× in this file`,
      vendors: [title],
      prompt: `Write a ${title} integration — the ${title} SDK is already a dependency but there's no handler wired up.`,
    })
  }
  return found
}

function readSafe(file: string): string {
  try { return readFileSync(file, 'utf8') } catch { return '' }
}

function scanVendorImportsFromMemory(file: string, lines: string[], contentByPath: Map<string, string>): Opportunity[] {
  const found: Opportunity[] = []
  if (file.endsWith('.d.ts') || file.includes('.generated.') || file.includes('/generated/')) return found
  const fileContent = contentByPath.get(file) ?? ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const match = line.match(/(?:from\s+|require\(\s*)['"]([^'"\n]+)['"]/)
    if (!match) continue
    const spec = match[1]!
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue
    if (FRAMEWORK_IMPORT_HINTS.test(spec)) continue
    const vendor = detectVendor(spec.replace(/^@/, '').toLowerCase())
    if (!vendor) continue
    const vendorUses = (fileContent.match(new RegExp(`\\b${vendor}`, 'gi')) || []).length
    if (vendorUses > 6) continue
    const title = VENDOR_HINTS[vendor]!
    found.push({
      score: 40 + (vendorUses < 3 ? 15 : 0),
      kind: 'vendor-sdk-import',
      file,
      line: i + 1,
      evidence: `imports '${spec}' but only uses "${vendor}" ${vendorUses}× in this file`,
      vendors: [title],
      prompt: `Write a ${title} integration — the ${title} SDK is already a dependency but there's no handler wired up.`,
    })
  }
  return found
}

function detectVendor(text: string): string | null {
  for (const key of Object.keys(VENDOR_HINTS)) if (text.includes(key)) return key
  return null
}

function detectVendors(text: string): string[] {
  const set = new Set<string>()
  const lower = text.toLowerCase()
  for (const key of Object.keys(VENDOR_HINTS)) if (lower.includes(key)) set.add(VENDOR_HINTS[key]!)
  return [...set]
}

function promptFromTodo(text: string, vendors: string[]): string {
  if (vendors.length >= 2) return `When something happens in ${vendors[0]}, do the matching thing in ${vendors[1]}. (From TODO: "${text.slice(0, 100)}")`
  if (vendors.length === 1) return `Build the ${vendors[0]} integration this TODO describes: "${text.slice(0, 160)}"`
  return `Build the integration this TODO describes: "${text.slice(0, 180)}"`
}

function inferAction(vendors: string[]): string {
  if (vendors.length >= 2) return `forward the result to ${vendors[1]}`
  return 'persist the result and reply 200'
}

function rankAndDedupe(opportunities: Opportunity[]): Opportunity[] {
  // Collapse duplicates (same file + same first vendor + same kind) to the highest-scoring.
  const map = new Map<string, Opportunity>()
  for (const op of opportunities) {
    const key = `${op.file}::${op.kind}::${op.vendors.join(',')}`
    const existing = map.get(key)
    if (!existing || op.score > existing.score) map.set(key, op)
  }
  // Second pass: cap vendor-sdk-import to 3 per (vendor, kind) so one framework/template
  // repo can't flood the report with 90 Shopify entries. Keep the highest-scoring 3.
  const perVendorKind = new Map<string, number>()
  const all = [...map.values()].sort((a, b) => b.score - a.score)
  const kept: Opportunity[] = []
  for (const op of all) {
    if (op.kind !== 'vendor-sdk-import') { kept.push(op); continue }
    const key = `${op.vendors[0] ?? '?'}::${op.kind}`
    const seen = perVendorKind.get(key) ?? 0
    if (seen >= 3) continue
    perVendorKind.set(key, seen + 1)
    kept.push(op)
  }
  return kept
}

export function formatReport(opportunities: Opportunity[], root: string, limit = DEFAULT_REPORT_LIMIT): string {
  if (!opportunities.length) return `No integration opportunities found under ${root}.`
  const total = opportunities.length
  const shown = opportunities.slice(0, limit)
  const header = `patchbay scan found ${total} integration opportunit${total === 1 ? 'y' : 'ies'} under ${root}` + (total > shown.length ? ` (showing top ${shown.length}; pass --all to see them all)` : '') + '\n'
  const body = shown
    .map((op, i) => `#${i + 1}  score ${op.score}  ${op.kind}  ${op.file}:${op.line}\n    ${op.evidence}\n    build: patchbay build "${op.prompt}"`)
    .join('\n\n')
  const footer = `\n\nRun one directly:\n  patchbay build "${opportunities[0]!.prompt}"\nOr let patchbay build the top N for you:\n  patchbay scan ${root} --build-top=1`
  return header + '\n' + body + footer
}
