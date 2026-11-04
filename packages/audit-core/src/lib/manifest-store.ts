import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ManifestEntry, ToolDescriptor } from '../types'
import { hashManifest } from './manifest'

/**
 * Pinned manifests live on the user's filesystem so MANIFEST-001 can
 * compare the current scan against the previously approved state.
 *
 * Location:
 *   ~/.patchbay/manifests/<server-id>.json
 *
 * One file per MCP server (HTTP URL or stdio invocation). The store is
 * local to the machine running the audit; there is no network component.
 */

export interface ManifestStore {
  load(serverId: string): ManifestEntry | null
  save(entry: ManifestEntry): void
  pathFor(serverId: string): string
}

export function defaultManifestDir(): string {
  const base = process.env.PATCHBAY_STATE_DIR ?? join(homedir(), '.patchbay')
  return join(base, 'manifests')
}

export function fileManifestStore(dir: string = defaultManifestDir()): ManifestStore {
  return {
    pathFor(serverId: string): string {
      return join(dir, `${sanitise(serverId)}.json`)
    },

    load(serverId: string): ManifestEntry | null {
      const path = join(dir, `${sanitise(serverId)}.json`)
      if (!existsSync(path)) return null
      try {
        const raw = readFileSync(path, 'utf8')
        const parsed = JSON.parse(raw) as ManifestEntry
        if (!parsed.serverId || !parsed.pinnedHash || !Array.isArray(parsed.tools)) return null
        return parsed
      } catch {
        return null
      }
    },

    save(entry: ManifestEntry): void {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const path = join(dir, `${sanitise(entry.serverId)}.json`)
      writeFileSync(path, JSON.stringify(entry, null, 2), 'utf8')
    },
  }
}

/**
 * In-memory store, useful for tests and for probes that want to run
 * without touching the filesystem.
 */
export function memoryManifestStore(seed: Record<string, ManifestEntry> = {}): ManifestStore {
  const map = new Map(Object.entries(seed))
  return {
    pathFor(serverId: string): string {
      return `memory://${sanitise(serverId)}`
    },
    load(serverId: string): ManifestEntry | null {
      return map.get(serverId) ?? null
    },
    save(entry: ManifestEntry): void {
      map.set(entry.serverId, entry)
    },
  }
}

export function makeEntry(serverId: string, tools: ToolDescriptor[], now = new Date()): ManifestEntry {
  const iso = now.toISOString()
  return {
    serverId,
    pinnedHash: hashManifest(tools),
    tools,
    firstSeen: iso,
    lastSeen: iso,
  }
}

function sanitise(serverId: string): string {
  return serverId.replace(/[^a-zA-Z0-9._-]/g, '_')
}
