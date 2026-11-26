// Mutating verbs: tool names containing these are considered state-changing
// at the tool-shape level. Unauthenticated exposure of a WRITES-shaped tool
// is at least worth flagging, but severity depends on whether the mutation
// is *heavy* (persistent third-party state) or *scaffolding* (client-local
// developer helper) — see HEAVY_WRITES / SCAFFOLDING below.
export const WRITES = new Set([
  'create', 'update', 'delete', 'send', 'pay', 'charge', 'transfer', 'execute',
  'run', 'post', 'put', 'patch', 'destroy', 'remove', 'insert', 'write',
  'add', 'set', 'kill', 'stop', 'deploy', 'publish',
])

// Heavy-write verbs: a strict subset of WRITES that implies mutating the
// caller's or a third party's persistent state — the kind of mutation that
// AUTH-001 critical is really meant to flag (data loss, credential theft,
// money movement). Unauthenticated exposure of a heavy-write tool is a
// genuine credential-theft / integrity risk.
export const HEAVY_WRITES = new Set([
  'create', 'update', 'delete', 'send', 'pay', 'charge', 'transfer',
  'post', 'put', 'patch', 'destroy', 'remove', 'insert', 'write',
  'deploy', 'publish', 'cancel', 'refund', 'approve', 'revoke',
  'invite', 'archive', 'restore',
])

// Scaffolding verbs: tool names containing these — and ONLY these — describe
// local client-side initialization or dev-help (scaffold a project, start a
// local app, run an example SQL query the client executes). They don't
// mutate caller or third-party persistent state. AUTH-001 downgrades from
// critical to high when the server's only WRITES-shaped tools match this
// set and no HEAVY_WRITES verb appears.
//
// Examples this catches: `start_convex_app`, `run_example`, `init_template`,
// `execute_sql` (client-local by convention: scanner cannot prove the SQL
// runs against third-party state without issuing a destructive call). Heavy-
// write intent names like `send_payment`, `delete_user` still flag critical.
export const SCAFFOLDING = new Set([
  'scaffold', 'init', 'bootstrap', 'start', 'run', 'execute', 'stop', 'kill',
  'add', 'set',
])

export const READS = new Set([
  'get', 'list', 'read', 'search', 'find', 'query', 'fetch', 'lookup',
  'describe', 'show', 'inspect', 'view', 'explain',
])

export function tokens(name: string): string[] {
  return name.toLowerCase().split(/[_\-\s./]+/).filter(Boolean)
}

export function isWrite(name: string): boolean {
  return tokens(name).some((t) => WRITES.has(t))
}

export function isHeavyWrite(name: string): boolean {
  return tokens(name).some((t) => HEAVY_WRITES.has(t))
}

export function isScaffoldingOnly(name: string): boolean {
  const ts = tokens(name)
  const hasScaffold = ts.some((t) => SCAFFOLDING.has(t))
  const hasHeavy = ts.some((t) => HEAVY_WRITES.has(t))
  return hasScaffold && !hasHeavy
}

export function isRead(name: string): boolean {
  return tokens(name).some((t) => READS.has(t))
}

export function hasWriteTools(tools: Array<{ name: string }>): boolean {
  return tools.some((t) => isWrite(t.name))
}

export function hasHeavyWriteTools(tools: Array<{ name: string }>): boolean {
  return tools.some((t) => isHeavyWrite(t.name))
}
