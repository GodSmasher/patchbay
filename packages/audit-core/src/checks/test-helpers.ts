import type { DirectoryProbe, RemoteProbe, TargetSnapshot } from '../types'

export function remoteSnap(overrides: Partial<RemoteProbe> & { url?: string } = {}): TargetSnapshot {
  const url = overrides.url ?? 'https://x.example'
  return {
    kind: 'remote-url',
    target: url,
    capturedAt: '',
    remote: {
      url,
      reachable: true,
      usesTls: url.startsWith('https://'),
      initializeOk: true,
      toolsListOk: false,
      authRequired: true,
      acceptedAuthHeader: 'none',
      transport: 'streamable-http',
      tools: [],
      originValidation: 'unknown',
      redirectLocalhostInconsistent: false,
      rawErrors: [],
      ...overrides,
    },
  }
}

export function dirSnap(overrides: Partial<DirectoryProbe> = {}): TargetSnapshot {
  return {
    kind: 'directory',
    target: overrides.root ?? '/tmp/x',
    capturedAt: '',
    directory: {
      root: '/tmp/x',
      files: [],
      secretHits: [],
      envVarsUsed: [],
      secretEnvVarsUsed: [],
      hasRefreshTokenPath: false,
      ...overrides,
    },
  }
}
