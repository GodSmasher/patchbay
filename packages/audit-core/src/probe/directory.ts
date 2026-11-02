import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import type { DirectoryProbe, TargetSnapshot } from '../types'

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'openai-key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github-token', re: /\bghp_[A-Za-z0-9]{30,}\b/g },
  { name: 'slack-bot-token', re: /\bxoxb-[A-Za-z0-9-]{20,}\b/g },
  { name: 'generic-hex-secret', re: /(?:key|token|secret|password)\s*[:=]\s*['"][A-Fa-f0-9]{32,}['"]/g },
]

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.json', '.yaml', '.yml', '.env'])
const IGNORE_DIR = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage', '.venv', '__pycache__'])

export interface DirectoryProbeOptions {
  maxFiles?: number
  maxBytesPerFile?: number
}

export function probeDirectory(root: string, opts: DirectoryProbeOptions = {}): TargetSnapshot {
  const maxFiles = opts.maxFiles ?? 2000
  const maxBytes = opts.maxBytesPerFile ?? 512 * 1024
  const probe: DirectoryProbe = {
    root,
    files: [],
    secretHits: [],
    envVarsUsed: [],
    secretEnvVarsUsed: [],
    hasRefreshTokenPath: false,
  }
  const envSet = new Set<string>()
  let count = 0

  const walk = (dir: string) => {
    if (count >= maxFiles) return
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const name of entries) {
      if (count >= maxFiles) return
      if (IGNORE_DIR.has(name)) continue
      const p = join(dir, name)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) { walk(p); continue }
      if (!st.isFile()) continue
      const ext = extname(name).toLowerCase()
      if (!SOURCE_EXT.has(ext) && !name.startsWith('.env')) continue
      if (st.size > maxBytes) continue
      let text: string
      try { text = readFileSync(p, 'utf8') } catch { continue }
      const rel = relative(root, p).replace(/\\/g, '/')
      count++
      probe.files.push({ path: rel })

      for (const { name: pname, re } of SECRET_PATTERNS) {
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
          const line = text.slice(0, m.index).split('\n').length
          probe.secretHits.push({ path: rel, line, pattern: pname, match: m[0] })
          if (probe.secretHits.length > 100) break
        }
      }

      const envRe = /process\.env\.([A-Z0-9_]+)|os\.environ\[['"]([A-Z0-9_]+)['"]\]|os\.getenv\(['"]([A-Z0-9_]+)['"]/g
      let em: RegExpExecArray | null
      while ((em = envRe.exec(text)) !== null) {
        const v = em[1] ?? em[2] ?? em[3]
        if (v) envSet.add(v)
      }

      if (/refresh[_-]?token/i.test(text) && /\b(fetch|axios|request|post|http)\b/i.test(text)) {
        probe.hasRefreshTokenPath = true
      }
    }
  }

  walk(root)
  probe.envVarsUsed = [...envSet].sort()
  probe.secretEnvVarsUsed = probe.envVarsUsed.filter((v) => /KEY|TOKEN|SECRET|PASSWORD|PASS\b/.test(v))

  for (const candidate of ['scopes.json', 'auth/scopes.json', 'src/auth/scopes.json']) {
    try {
      const text = readFileSync(join(root, candidate), 'utf8')
      const parsed = JSON.parse(text) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const manifest: Record<string, string[]> = {}
        for (const [tool, scopes] of Object.entries(parsed as Record<string, unknown>)) {
          if (Array.isArray(scopes) && scopes.every((s) => typeof s === 'string')) {
            manifest[tool] = scopes as string[]
          }
        }
        probe.scopeManifest = manifest
        break
      }
    } catch {
      // not present or unreadable; try next
    }
  }

  return {
    kind: 'directory',
    target: root,
    directory: probe,
    capturedAt: new Date().toISOString(),
  }
}
