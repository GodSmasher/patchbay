// Headless Chrome, 60 fps MP4 recorder for the patchbay demo page.
// Usage: node demo.mjs [--prompt="pill label"] [--out=../../docs/screenshots/patchbay.mp4]
import puppeteer from 'puppeteer'
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]))
const PROMPT_LABEL = args.prompt ?? 'Calendly → Slack'
const OUT = resolve(here, args.out ?? '../../docs/screenshots/patchbay-demo.mp4')
const URL = args.url ?? 'https://patchbay-nebius.vercel.app'
const WIDTH = 1440
const HEIGHT = 900

const RECORDER_OPTS = {
  fps: 60,
  videoFrame: { width: WIDTH, height: HEIGHT },
  videoCrf: 20,          // 18-28 is sane; lower = better quality, bigger file
  videoCodec: 'libx264',
  videoPreset: 'slow',   // slow -> smaller files for same quality
  videoBitrate: 2000,
  autopad: { color: 'white' },
}

const MOUSE_HELPER = `
(() => {
  const dot = document.createElement('div')
  dot.setAttribute('id', '__pb_cursor')
  dot.style.cssText = \`
    position: fixed; top: 0; left: 0; width: 24px; height: 24px;
    border-radius: 50%; background: rgba(0,0,0,0.9);
    border: 2px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    transform: translate(-50%, -50%); pointer-events: none; z-index: 999999;
    transition: transform 60ms linear, background 180ms ease, width 180ms ease, height 180ms ease;
  \`
  document.body.appendChild(dot)
  window.__pb_cursorMove = (x, y) => { dot.style.transform = \`translate(\${x - 12}px, \${y - 12}px)\` }
  window.__pb_cursorClick = () => {
    dot.style.background = '#6938EF'; dot.style.width = '32px'; dot.style.height = '32px'
    setTimeout(() => { dot.style.background = 'rgba(0,0,0,0.9)'; dot.style.width = '24px'; dot.style.height = '24px' }, 180)
  }
})()
`

async function tween(from, to, ms, step) {
  const steps = Math.max(6, Math.round(ms / 16))
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps)
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    await step(x, y)
    await new Promise((r) => setTimeout(r, ms / steps))
  }
}

async function smoothMove(page, from, to, ms = 500) {
  await tween(from, to, ms, async (x, y) => {
    await page.mouse.move(x, y)
    await page.evaluate((xx, yy) => window.__pb_cursorMove?.(xx, yy), x, y)
  })
}

async function smoothClick(page, cursor, box, ms = 500) {
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await smoothMove(page, cursor, to, ms)
  await page.evaluate(() => window.__pb_cursorClick?.())
  await page.mouse.click(to.x, to.y)
  return to
}

async function smoothScroll(page, delta, ms = 800) {
  const steps = Math.max(10, Math.round(ms / 16))
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  let last = 0
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps)
    const now = Math.round(delta * t)
    await page.evaluate((d) => window.scrollBy(0, d), now - last)
    last = now
    await new Promise((r) => setTimeout(r, ms / steps))
  }
}

async function waitForText(page, text, timeoutMs = 180_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const found = await page.evaluate((t) => document.body.innerText.includes(t), text)
    if (found) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function run() {
  console.log(`→ launching ${WIDTH}x${HEIGHT} chrome`)
  const browser = await puppeteer.launch({
    headless: 'shell',
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
    args: [`--window-size=${WIDTH},${HEIGHT}`, '--hide-scrollbars'],
  })
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))

  console.log(`→ open ${URL}`)
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60_000 })
  await page.evaluate(MOUSE_HELPER)
  await new Promise((r) => setTimeout(r, 500))

  const recorder = new PuppeteerScreenRecorder(page, RECORDER_OPTS)
  console.log(`→ record to ${OUT}`)
  await recorder.start(OUT)

  let cursor = { x: WIDTH / 2, y: HEIGHT / 2 }
  await page.evaluate((x, y) => window.__pb_cursorMove?.(x, y), cursor.x, cursor.y)

  // 1. Hover the hero for 1s so the viewer can read it.
  await new Promise((r) => setTimeout(r, 1200))

  // 2. Move to the chosen prompt pill and click.
  const pill = await page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const el = buttons.find((b) => b.textContent?.trim().startsWith(label))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }, PROMPT_LABEL)
  if (!pill) throw new Error(`Prompt pill not found: ${PROMPT_LABEL}`)
  console.log(`→ click pill: ${PROMPT_LABEL}`)
  cursor = await smoothClick(page, cursor, pill, 650)
  await new Promise((r) => setTimeout(r, 500))

  // 3. Click Build connector.
  const build = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.trim() === 'Build connector')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  if (!build) throw new Error('Build connector button not found')
  console.log('→ click Build connector')
  cursor = await smoothClick(page, cursor, build, 650)

  // 4. Slow scroll to bring the timeline + plan card into frame.
  await new Promise((r) => setTimeout(r, 2500))
  await smoothScroll(page, 320, 900)

  // 5. Wait for Verify to finish (green). We stop a bit after the final "tests after".
  console.log('→ waiting for sandbox verify to land')
  const greened = await waitForText(page, 'tests after', 180_000)
  console.log(greened ? '→ pipeline green' : '→ timed out waiting for green; stopping anyway')

  // 6. Smooth scroll a little more to show the final draft tab + download button.
  await smoothScroll(page, 240, 900)
  await new Promise((r) => setTimeout(r, 1200))

  // 7. Hover the Download .zip button to end on a visible call-to-action.
  const dl = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('a, button')).find((x) => x.textContent?.trim().includes('Download'))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  if (dl) {
    console.log('→ hover Download .zip')
    cursor = await (async () => { await smoothMove(page, cursor, { x: dl.x + dl.width / 2, y: dl.y + dl.height / 2 }, 700); return { x: dl.x + dl.width / 2, y: dl.y + dl.height / 2 } })()
    await new Promise((r) => setTimeout(r, 1200))
  }

  await recorder.stop()
  await browser.close()
  console.log(`✔ saved ${OUT}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
