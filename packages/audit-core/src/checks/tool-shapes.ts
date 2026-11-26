// Mutating verbs: tool names containing these are considered state-changing
// for AUTH-001 severity. Unauthenticated exposure warrants critical.
export const WRITES = new Set([
  'create', 'update', 'delete', 'send', 'pay', 'charge', 'transfer', 'execute',
  'run', 'post', 'put', 'patch', 'destroy', 'remove', 'insert', 'write',
  'add', 'set', 'kill', 'stop', 'deploy', 'publish',
])

// Scaffolding verbs: tool names containing these — and ONLY these — describe
// local client-side initialization (start a project, init a template). They
// don't mutate caller or third-party state. AUTH-001 downgrades to info when
// the server's only "mutating" tools match this narrow set with no broader
// WRITES verb. Keep this tiny and surgical to avoid widening critical→info.
// `start_convex_app` → scaffolding; `start_payment` is still a WRITE because
// `payment` carries its own semantics.
export const SCAFFOLDING = new Set([
  'scaffold', 'init', 'bootstrap',
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

export function isRead(name: string): boolean {
  return tokens(name).some((t) => READS.has(t))
}

export function hasWriteTools(tools: Array<{ name: string }>): boolean {
  return tools.some((t) => isWrite(t.name))
}
