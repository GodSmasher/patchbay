import { describe, it, expect } from 'vitest'
import { scanFiles, type ScanInputFile } from './scanner'

/**
 * Hero feature coverage. Each test picks a real-world shape the scanner has to
 * either flag correctly or NOT flag (false positives tank the demo).
 */

function f(path: string, content: string): ScanInputFile {
  return { path, content }
}

describe('scanner / env-var detection', () => {
  it('flags Stripe when STRIPE_* keys appear in a .env.example', () => {
    const ops = scanFiles([
      f('.env.example', 'STRIPE_SECRET_KEY=sk_test_x\nSTRIPE_WEBHOOK_SECRET=whsec_x\n'),
    ])
    expect(ops.length).toBe(1)
    expect(ops[0]!.vendors).toEqual(['Stripe'])
    expect(ops[0]!.kind).toBe('env-var')
  })

  it('groups multiple vendors in one env file as separate opportunities', () => {
    const ops = scanFiles([
      f('apps/web/.env.example', [
        'STRIPE_SECRET_KEY=sk_test_x',
        'SLACK_WEBHOOK_URL=https://hooks.slack.com/x',
        'GITHUB_TOKEN=ghp_x',
      ].join('\n')),
    ])
    const vendors = ops.map(o => o.vendors[0]).sort()
    expect(vendors).toEqual(['GitHub', 'Slack', 'Stripe'])
  })

  it('skips non-vendor env entries', () => {
    const ops = scanFiles([
      f('.env.example', 'NODE_ENV=production\nDATABASE_URL=postgres://x\n'),
    ])
    expect(ops).toEqual([])
  })
})

describe('scanner / webhook-handler stub detection', () => {
  it('flags an Express stripe webhook route with a TODO body', () => {
    const content = `
      router.post('/webhook/stripe', (req, res) => {
        // TODO: verify stripe signature and forward to Slack
      })
    `
    const ops = scanFiles([f('server.ts', content)])
    expect(ops.length).toBeGreaterThan(0)
    const hook = ops.find(o => o.kind === 'webhook-handler')
    expect(hook).toBeDefined()
    expect(hook!.vendors).toContain('Stripe')
  })

  it('flags a FastAPI decorator-style stripe webhook with a pass body', () => {
    const content = `
from fastapi import FastAPI, Request
app = FastAPI()

@app.post("/webhook/stripe")
async def stripe_webhook(req: Request):
    # TODO: verify stripe signature and forward to Slack
    pass
`
    const ops = scanFiles([f('server.py', content)])
    const hook = ops.find(o => o.kind === 'webhook-handler')
    expect(hook).toBeDefined()
    expect(hook!.vendors).toContain('Stripe')
  })

  it('flags a Flask @app.route stripe webhook with raise NotImplementedError', () => {
    const content = `
from flask import Flask, request
app = Flask(__name__)

@app.route("/webhooks/stripe", methods=["POST"])
def stripe_hook():
    raise NotImplementedError("wire up stripe + slack")
`
    const ops = scanFiles([f('app.py', content)])
    const hook = ops.find(o => o.kind === 'webhook-handler')
    expect(hook).toBeDefined()
    expect(hook!.vendors).toContain('Stripe')
  })

  it('does not flag a webhook route with a real implementation', () => {
    const content = `
      router.post('/webhook/stripe', async (req, res) => {
        const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature']!, process.env.STRIPE_WEBHOOK_SECRET!)
        await db.events.insert(event)
        await slackClient.chat.postMessage({ channel: '#billing', text: formatEvent(event) })
        res.status(200).json({ received: true })
      })
    `
    const ops = scanFiles([f('server.ts', content)])
    const hook = ops.find(o => o.kind === 'webhook-handler')
    expect(hook).toBeUndefined()
  })
})

describe('scanner / TODO detection', () => {
  it('flags a TODO comment that names a vendor and an integration keyword', () => {
    const content = `function foo() {
      // TODO: send order confirmation to Mailchimp when payment succeeds
      return null
    }`
    const ops = scanFiles([f('src/orders.ts', content)])
    const todo = ops.find(o => o.kind === 'todo')
    expect(todo).toBeDefined()
    expect(todo!.vendors).toContain('Mailchimp')
  })

  it('does NOT flag "colored square" (vendor-word false positive guard)', () => {
    const content = `// TODO: add colored square like list (see columns)`
    const ops = scanFiles([f('ui/table.tsx', content)])
    const todo = ops.find(o => o.kind === 'todo' && o.vendors[0] === 'Square')
    expect(todo).toBeUndefined()
  })

  it('does NOT confuse CI "pipeline" references with Pipedrive', () => {
    const content = `// TODO: refactor the build pipeline to parallelise lint + test`
    const ops = scanFiles([f('src/x.ts', content)])
    const todo = ops.find(o => o.vendors[0] === 'Pipedrive')
    expect(todo).toBeUndefined()
  })

  it('ignores TODOs with no vendor and no integration keyword', () => {
    const content = `// TODO: refactor this later`
    const ops = scanFiles([f('src/x.ts', content)])
    expect(ops).toEqual([])
  })
})

describe('scanner / vendor SDK import detection', () => {
  it('flags an imported but barely-used Stripe SDK', () => {
    const content = `
      import Stripe from 'stripe'
      // placeholder: the Stripe client is set up but no handler calls it yet
      export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-10-28.acacia' })
    `
    const ops = scanFiles([f('src/stripe.ts', content)])
    const sdk = ops.find(o => o.kind === 'vendor-sdk-import')
    expect(sdk).toBeDefined()
    expect(sdk!.vendors).toContain('Stripe')
  })

  it('does NOT flag a framework import that happens to contain a vendor name', () => {
    // @shopify/hydrogen is a framework, not an integration opportunity.
    const content = `import { CartForm } from '@shopify/hydrogen'\nexport const x = CartForm`
    const ops = scanFiles([f('app/routes/cart.tsx', content)])
    const sdk = ops.find(o => o.kind === 'vendor-sdk-import')
    expect(sdk).toBeUndefined()
  })

  it('does NOT flag an SDK that is already actively used in the file', () => {
    const content = `
      import Stripe from 'stripe'
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-10-28.acacia' })
      export async function createCheckoutSession(items: any[]) {
        return stripe.checkout.sessions.create({ line_items: items, mode: 'payment', success_url: '/x' })
      }
      export async function listCustomers() { return stripe.customers.list({ limit: 100 }) }
      export async function retrieveSubscription(id: string) { return stripe.subscriptions.retrieve(id) }
    `
    const ops = scanFiles([f('src/stripe.ts', content)])
    expect(ops.find(o => o.kind === 'vendor-sdk-import')).toBeUndefined()
  })

  it('skips .d.ts type declarations', () => {
    const content = `import type { Stripe } from 'stripe'\nexport type X = Stripe.Event`
    const ops = scanFiles([f('src/types.d.ts', content)])
    const sdk = ops.find(o => o.kind === 'vendor-sdk-import')
    expect(sdk).toBeUndefined()
  })
})

describe('scanner / ranking', () => {
  it('caps vendor-sdk-import at 3 per vendor so a template repo cannot flood the report', () => {
    const files: ScanInputFile[] = []
    for (let i = 0; i < 10; i++) {
      files.push(f(`src/stripe-page-${i}.ts`, `import Stripe from 'stripe'\nconst s = new Stripe('x')\nexport default s`))
    }
    const ops = scanFiles(files)
    const stripeImports = ops.filter(o => o.kind === 'vendor-sdk-import' && o.vendors[0] === 'Stripe')
    expect(stripeImports.length).toBeLessThanOrEqual(3)
  })
})
