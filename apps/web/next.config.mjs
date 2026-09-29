import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// One .env.local at the repo root serves the CLI and the web app.
const rootEnv = fileURLToPath(new URL('../../.env.local', import.meta.url))
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@patchbay/agent'],
  poweredByHeader: false,
}

export default nextConfig
