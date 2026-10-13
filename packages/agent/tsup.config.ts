import { defineConfig } from 'tsup'
import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  // esbuild is a runtime dependency of the preflight syntax check; keep it
  // external so npm installs it instead of inlining the native binary.
  external: ['esbuild'],
  async onSuccess() {
    // The replay fixture is imported as JSON at runtime; copy the bundled example
    // next to the compiled output so `import ./fixtures/typeform-pipedrive/run.json`
    // in dist resolves.
    cpSync(resolve('src/fixtures'), resolve('dist/fixtures'), { recursive: true })
  },
})
