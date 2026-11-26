// Dashboard shell — week-1 scaffolding. Shows user email + an empty
// "no endpoints yet" state + a disabled "add endpoint" button.
// Business logic lands in week-2 (scan integration, cron, alerts).
import Link from 'next/link'
import { serverClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard · patchbay' }

export default async function DashboardPage() {
  const supabase = await serverClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware already gated /app on auth; user is non-null by the time we get here,
  // but narrow for TypeScript.
  if (!user) return null

  const { data: endpoints } = await supabase.from('endpoints').select('*').order('created_at', { ascending: false }).limit(50)
  const hasEndpoints = (endpoints?.length ?? 0) > 0

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-5xl leading-none">your endpoints</h1>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="g-btn g-btn-ghost text-sm">
            sign out
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-ink-soft">
        Signed in as <span className="font-mono text-ink">{user.email}</span>
      </p>

      {!hasEndpoints ? (
        <div className="g-glass mt-10 rounded-2xl p-10 text-center">
          <p className="font-display text-2xl">no endpoints yet</p>
          <p className="mt-3 text-sm text-ink-soft">
            Add an MCP server URL to get weekly rescans + email on grade change.
          </p>
          <button
            type="button"
            disabled
            title="Coming in week-2 of hosted-v1 scaffolding"
            className="g-btn g-btn-o mt-6 opacity-50"
          >
            add endpoint (week-2)
          </button>
          <p className="mt-4 text-xs text-ink-mute">
            Until then, the free one-shot scanner at{' '}
            <Link href="/audit" className="underline underline-offset-2">
              /audit
            </Link>{' '}
            still works.
          </p>
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-3">
          {endpoints!.map((ep) => (
            <li key={ep.id} className="g-glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <code className="text-sm">{ep.url}</code>
                <span className="text-xs text-ink-mute">rescan {ep.scan_schedule}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
