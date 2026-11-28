import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'scripts/**/*.test.ts', 'apps/web/lib/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'packages/agent/src/fixtures/**'],
    environment: 'node',
  },
})
