export const WRITES = new Set([
  'create', 'update', 'delete', 'send', 'pay', 'charge', 'transfer', 'execute',
  'run', 'post', 'put', 'patch', 'destroy', 'remove', 'insert', 'write',
  'add', 'set', 'kill', 'stop', 'start', 'deploy', 'publish',
])

export const READS = new Set([
  'get', 'list', 'read', 'search', 'find', 'query', 'fetch', 'lookup',
  'describe', 'show', 'inspect', 'view',
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
