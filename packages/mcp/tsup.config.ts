import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: false,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  external: ['@patchbay/agent', '@modelcontextprotocol/sdk'],
  // Shebang stays in source — tsup inlines it correctly at the top of the bundle.
})
