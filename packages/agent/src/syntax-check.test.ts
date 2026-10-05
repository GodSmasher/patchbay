import { describe, expect, it } from 'vitest'
import { preflightSyntax } from './syntax-check'
import type { GeneratedFile } from './types'

const file = (path: string, content: string): GeneratedFile => ({ path, content })

describe('preflightSyntax', () => {
  it('returns null when every file parses', async () => {
    const files = [
      file('src/connector.ts', `export async function handle(input: { email: string }): Promise<string> { return input.email }`),
      file('src/connector.test.ts', `import { describe, it } from 'vitest'\ndescribe('x', () => { it('ok', () => {}) })`),
      file('README.md', '# readme — not a TS file, should be ignored'),
    ]
    expect(await preflightSyntax(files)).toBeNull()
  })

  it('catches an unterminated string', async () => {
    const files = [
      file('src/connector.ts', `export const x = "hello`),
      file('src/connector.test.ts', `describe('x', () => {})`),
    ]
    const report = await preflightSyntax(files)
    expect(report).not.toBeNull()
    expect(report?.typecheckOk).toBe(false)
    expect(report?.ranOn).toBe('preflight:esbuild')
    expect(report?.failures[0]?.name).toMatch(/syntax \(src\/connector\.ts/)
  })

  it('catches a misplaced brace in the test file', async () => {
    const files = [
      file('src/connector.ts', `export const x = 1`),
      file('src/connector.test.ts', `describe('x', () => { it('ok', () => { expect(1) ))`),
    ]
    const report = await preflightSyntax(files)
    expect(report).not.toBeNull()
    expect(report?.failed).toBeGreaterThanOrEqual(1)
    expect(report?.failures.some((f) => f.name.includes('connector.test.ts'))).toBe(true)
  })

  it('reports every failing file at once (parallel parse)', async () => {
    const files = [
      file('src/connector.ts', `export const a = "unterminated`),
      file('src/connector.test.ts', `describe('x', () => { }`), // open bracket
    ]
    const report = await preflightSyntax(files)
    expect(report?.failures.length).toBeGreaterThanOrEqual(2)
  })
})
