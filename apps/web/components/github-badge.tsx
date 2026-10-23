'use client'

import { useEffect, useState } from 'react'

export interface GhUser {
  connected: boolean
  login?: string
  name?: string | null
  avatarUrl?: string
}

export function useGhUser(): { user: GhUser | null; refresh: () => void } {
  const [user, setUser] = useState<GhUser | null>(null)
  const load = () => {
    fetch('/api/auth/github/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: GhUser) => setUser(d))
      .catch(() => setUser({ connected: false }))
  }
  useEffect(() => { load() }, [])
  return { user, refresh: load }
}

export function GitHubBadge({ user }: { user: GhUser | null }) {
  if (!user) return null
  if (!user.connected) {
    return (
      <a
        href="/api/auth/github"
        className="rounded-full border border-paper-line bg-paper-card px-3 py-1 text-xs text-ink hover:border-ink-mute"
      >
        Connect GitHub
      </a>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-paper-line bg-paper-card px-2 py-1 text-xs">
      {user.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
      )}
      <span className="text-ink">@{user.login}</span>
      <a href="/api/auth/github/logout" className="text-ink-mute hover:text-ink" title="Disconnect">×</a>
    </div>
  )
}
