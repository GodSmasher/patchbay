import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// One .env.local at the repo root serves the CLI and the web app.
const rootEnv = fileURLToPath(new URL('../../.env.local', import.meta.url))
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @patchbay/agent now ships compiled ESM in dist/, so transpilePackages is no
  // longer necessary. Keeping it would pull esbuild (a runtime dep of the preflight
  // syntax check) through webpack's loaders and crash the build.
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['esbuild', '@patchbay/agent'],
  },
  webpack: (config, { isServer }) => {
    // esbuild is a Node binary dep of @patchbay/agent; webpack must leave it as a
    // runtime import or it tries to bundle the native platform fallbacks.
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)
      externals.push({ esbuild: 'commonjs esbuild' })
      config.externals = externals
    }
    return config
  },
}

export default nextConfig
