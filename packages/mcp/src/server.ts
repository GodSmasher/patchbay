#!/usr/bin/env node
/**
 * patchbay MCP server (stdio transport).
 *
 * Exposes three tools to any MCP client (Claude Code, Codex, Cursor):
 *   - build_connector: full pipeline, returns generated files
 *   - research_api:    plan + API research, returns the spec
 *   - verify_code:     type-check + vitest an existing connector (with repair loop)
 *
 * Each tool streams patchbay's internal step/log/tests events as MCP logging
 * notifications and, when a client passes a progressToken, as progress updates,
 * so the client can render a live spinner while the agent works.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
  loadConfig,
  missingLiveKeys,
  startResearch,
  startRun,
  startVerify,
  type GeneratedFile,
  type RunEvent,
} from '@patchbay/agent'

const VERSION = '0.1.0'

const server = new McpServer({ name: 'patchbay', version: VERSION })

const fileSchema = z.object({
  path: z.string().describe('Relative path inside the connector (e.g. src/connector.ts)'),
  content: z.string().describe('File contents as UTF-8 text'),
})

server.registerTool(
  'build_connector',
  {
    title: 'Build a connector',
    description:
      'Describe an integration in one sentence ("When X happens in A, do Y in B"). ' +
      'patchbay plans it, researches both APIs, generates a TypeScript connector ' +
      'with tests and a README, then verifies it in a sandbox with up to N repair attempts. ' +
      'Falls back to the recorded replay run when live API keys are missing.',
    inputSchema: {
      prompt: z.string().min(4).describe('One-sentence integration description'),
      maxAttempts: z.number().int().min(1).max(5).optional().describe('Repair attempts, default from PATCHBAY_MAX_ATTEMPTS'),
    },
  },
  async ({ prompt, maxAttempts }, extra) => {
    const config = loadConfig()
    if (maxAttempts) config.maxAttempts = maxAttempts
    return runToolStream(extra, startRun(prompt, config), { includeFiles: true })
  },
)

server.registerTool(
  'research_api',
  {
    title: 'Research an integration',
    description:
      'Plan + Tavily-backed API research only. Returns the connector plan, the ranked ' +
      'documentation sources, and a normalized API spec (endpoints, auth, example payloads). ' +
      'No code is generated and no sandbox is used, so this is cheap and fast.',
    inputSchema: {
      prompt: z.string().min(4).describe('One-sentence integration description'),
    },
  },
  async ({ prompt }, extra) => {
    return runToolStream(extra, startResearch(prompt, loadConfig()), { includeSpec: true })
  },
)

server.registerTool(
  'verify_code',
  {
    title: 'Verify a connector',
    description:
      'Type-check and vitest an existing connector (files you provide as {path, content}) ' +
      'in an isolated Nebius sandbox, with up to N repair attempts from the strong model. ' +
      'Requires live keys (NEBIUS_API_KEY, NEBIUS_AI_PROJECT); returns the final test report ' +
      'and the (possibly repaired) files.',
    inputSchema: {
      files: z.array(fileSchema).min(1).describe('Connector files. Must include src/connector.ts and at least one *.test.ts'),
      maxAttempts: z.number().int().min(1).max(5).optional().describe('Repair attempts, default from PATCHBAY_MAX_ATTEMPTS'),
    },
  },
  async ({ files, maxAttempts }, extra) => {
    const config = loadConfig()
    if (maxAttempts) config.maxAttempts = maxAttempts
    const missing = missingLiveKeys(config)
    if (config.mock || missing.length) {
      return errorResult(
        `verify_code needs live keys. Missing: ${missing.join(', ') || 'PATCHBAY_MOCK=false'}. ` +
          'Set them in the MCP server env (see docs/mcp-setup.md).',
      )
    }
    return runToolStream(extra, startVerify(files as GeneratedFile[], config), { includeFiles: true })
  },
)

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

interface StreamOptions {
  includeFiles?: boolean
  includeSpec?: boolean
}

async function runToolStream(
  extra: ToolExtra,
  stream: AsyncGenerator<RunEvent>,
  opts: StreamOptions,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean; structuredContent?: Record<string, unknown> }> {
  const progressToken = extra._meta?.progressToken
  const events: RunEvent[] = []
  let stepCount = 0
  const totalSteps = 5

  const log = async (level: 'info' | 'error', message: string) => {
    try {
      await extra.sendNotification({
        method: 'notifications/message',
        params: { level, logger: 'patchbay', data: message },
      })
    } catch {
      // Client may not have subscribed to logging; ignore.
    }
  }

  const progress = async (message: string) => {
    if (progressToken === undefined || progressToken === null) return
    try {
      await extra.sendNotification({
        method: 'notifications/progress',
        params: { progressToken, progress: stepCount, total: totalSteps, message },
      })
    } catch {
      // ignore
    }
  }

  try {
    for await (const event of stream) {
      events.push(event)
      if (event.type === 'step') {
        if (event.status === 'start') {
          await log('info', `▶ ${event.step}${event.detail ? ` — ${event.detail}` : ''}`)
          await progress(event.step)
        } else if (event.status === 'done') {
          stepCount++
          await log('info', `✔ ${event.step}${event.detail ? ` — ${event.detail}` : ''}`)
          await progress(`${event.step} done`)
        } else {
          await log('error', `✖ ${event.step}${event.detail ? ` — ${event.detail}` : ''}`)
        }
      } else if (event.type === 'log') {
        await log('info', `    ${event.message}`)
      } else if (event.type === 'tests') {
        await log(
          event.report.failed ? 'error' : 'info',
          `attempt ${event.attempt}: ${event.report.passed}/${event.report.total} tests, typecheck ${
            event.report.typecheckOk ? 'ok' : 'failed'
          }`,
        )
      } else if (event.type === 'error') {
        await log('error', event.message)
      }
    }
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error))
  }

  return summarize(events, opts)
}

function summarize(events: RunEvent[], opts: StreamOptions) {
  const result = events.find((e) => e.type === 'result')
  const spec = events.find((e) => e.type === 'spec')
  const plan = events.find((e) => e.type === 'plan')
  const sources = events.find((e) => e.type === 'sources')
  const usage = events.find((e) => e.type === 'usage')
  const errorEvent = events.find((e) => e.type === 'error')

  const structured: Record<string, unknown> = {}
  const lines: string[] = []

  if (plan?.type === 'plan') {
    lines.push(`Plan: ${plan.plan.summary}`)
    structured.plan = plan.plan
  }
  if (opts.includeSpec && spec?.type === 'spec') {
    lines.push(`Spec: ${spec.spec.target.length + 1} endpoints`)
    structured.spec = spec.spec
  }
  if (sources?.type === 'sources') {
    structured.sources = sources.sources
    const official = sources.sources.filter((s) => s.official).length
    lines.push(`Sources: ${sources.sources.length} pages (${official} official)`)
  }
  if (result?.type === 'result') {
    const r = result
    lines.push(
      `Result: ${r.ok ? 'green' : 'red'} after ${r.attempts} attempt${r.attempts > 1 ? 's' : ''}` +
        (r.report ? ` (${r.report.passed}/${r.report.total} tests, typecheck ${r.report.typecheckOk ? 'ok' : 'failed'})` : ''),
    )
    structured.ok = r.ok
    structured.attempts = r.attempts
    if (r.report) structured.report = r.report
    if (opts.includeFiles) structured.files = r.files
  }
  if (usage?.type === 'usage') {
    const totalCost = usage.usage.reduce((s, u) => s + u.costUsd, 0)
    lines.push(`Cost: $${totalCost.toFixed(4)} across ${usage.usage.length} model call(s)`)
    structured.usage = usage.usage
  }
  if (errorEvent?.type === 'error') {
    lines.push(`Error: ${errorEvent.message}`)
    return {
      content: [{ type: 'text' as const, text: lines.join('\n') }],
      isError: true,
      structuredContent: structured,
    }
  }

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') || 'Done.' }],
    structuredContent: structured,
  } as const as { content: { type: 'text'; text: string }[]; structuredContent: Record<string, unknown> }
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  }
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write(`patchbay MCP server v${VERSION} ready on stdio\n`)
}

main().catch((error) => {
  process.stderr.write(`patchbay MCP fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
