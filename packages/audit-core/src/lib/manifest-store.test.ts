import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ToolDescriptor } from '../types'
import { fileManifestStore, makeEntry, memoryManifestStore } from './manifest-store'

const sampleTools: ToolDescriptor[] = [
  { name: 'get_user', description: 'look up user' },
  { name: 'list_docs', description: 'list docs' },
]

describe('memoryManifestStore', () => {
  it('returns null for unknown server id', () => {
    const store = memoryManifestStore()
    expect(store.load('unknown')).toBeNull()
  })

  it('round-trips an entry', () => {
    const store = memoryManifestStore()
    const entry = makeEntry('http:abc', sampleTools)
    store.save(entry)
    const loaded = store.load('http:abc')
    expect(loaded).toEqual(entry)
  })

  it('overwrites on repeat save', () => {
    const store = memoryManifestStore()
    const first = makeEntry('http:abc', sampleTools)
    store.save(first)
    const second = makeEntry('http:abc', [...sampleTools, { name: 'new_tool' }])
    store.save(second)
    expect(store.load('http:abc')).toEqual(second)
  })

  it('pathFor returns a memory url', () => {
    const store = memoryManifestStore()
    expect(store.pathFor('http:abc')).toBe('memory://http_abc')
  })
})

describe('fileManifestStore', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'patchbay-manifest-test-'))
  })

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  })

  it('returns null for unknown server id (file does not exist)', () => {
    const store = fileManifestStore(dir)
    expect(store.load('http:nothing')).toBeNull()
  })

  it('creates the directory on first save', () => {
    const nested = join(dir, 'nested', 'manifests')
    const store = fileManifestStore(nested)
    store.save(makeEntry('http:abc', sampleTools))
    expect(existsSync(nested)).toBe(true)
  })

  it('round-trips through disk', () => {
    const store = fileManifestStore(dir)
    const entry = makeEntry('http:abc', sampleTools)
    store.save(entry)
    const loaded = store.load('http:abc')
    expect(loaded).toEqual(entry)
  })

  it('sanitises server-id characters in the filename', () => {
    const store = fileManifestStore(dir)
    const entry = makeEntry('http:some/weird\\id?with=stuff', sampleTools)
    store.save(entry)
    const savedPath = store.pathFor(entry.serverId)
    expect(existsSync(savedPath)).toBe(true)
    expect(savedPath).not.toContain('/')
    expect(savedPath).not.toContain('?')
  })

  it('returns null when file contents are corrupt', () => {
    const store = fileManifestStore(dir)
    const path = store.pathFor('http:abc')
    const parent = dir
    if (!existsSync(parent)) return
    require('node:fs').mkdirSync(parent, { recursive: true })
    require('node:fs').writeFileSync(path, 'not json', 'utf8')
    expect(store.load('http:abc')).toBeNull()
  })

  it('saves pretty-printed JSON with the expected shape', () => {
    const store = fileManifestStore(dir)
    const entry = makeEntry('http:abc', sampleTools)
    store.save(entry)
    const raw = readFileSync(store.pathFor('http:abc'), 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed.serverId).toBe('http:abc')
    expect(parsed.pinnedHash.startsWith('sha256:')).toBe(true)
    expect(parsed.tools).toHaveLength(2)
    expect(typeof parsed.firstSeen).toBe('string')
    expect(typeof parsed.lastSeen).toBe('string')
  })
})

describe('makeEntry', () => {
  it('sets firstSeen and lastSeen to the same timestamp', () => {
    const now = new Date('2026-11-04T10:00:00.000Z')
    const entry = makeEntry('http:abc', sampleTools, now)
    expect(entry.firstSeen).toBe(now.toISOString())
    expect(entry.lastSeen).toBe(now.toISOString())
  })
})
