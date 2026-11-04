'use strict'
// Fake MCP server for manifest-demo. Reads tool list from
// PATCHBAY_DEMO_TOOLS env var (JSON array) and responds to
// initialize + tools/list requests over stdio. No deps, no startup lag.

const tools = JSON.parse(process.env.PATCHBAY_DEMO_TOOLS || '[]')
let buf = ''

process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buf += chunk
  let idx
  while ((idx = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    try {
      const req = JSON.parse(line)
      if (req.method === 'initialize') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { capabilities: {}, protocolVersion: '2024-11-05', serverInfo: { name: 'demo', version: '1.0.0' } } }) + '\n')
      } else if (req.method === 'tools/list') {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { tools } }) + '\n')
      }
    } catch (e) {
      process.stderr.write('demo-server parse error: ' + e.message + '\n')
    }
  }
})

process.stdin.on('end', () => process.exit(0))
