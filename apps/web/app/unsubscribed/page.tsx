import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function UnsubscribedPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string }
}) {
  const ok = searchParams.ok === '1'
  const error = searchParams.error

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-20">
      <div className="mx-auto max-w-xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/" className="hover:text-ink">patchbay</Link>
        </nav>

        {ok && (
          <>
            <h1 className="text-3xl font-semibold text-ink mb-4">Unsubscribed.</h1>
            <p className="text-ink-soft mb-2">
              You will not receive any further emails from patchbay. Your email address stays flagged
              in our list so we never accidentally re-add you.
            </p>
            <p className="text-ink-soft mb-8">
              If you want your data deleted completely instead of just marked unsubscribed,
              email <a href="mailto:hello@patchbay-mcp.dev" className="text-ink underline underline-offset-4">hello@patchbay-mcp.dev</a> and
              we will purge the record within 7 days.
            </p>
          </>
        )}

        {error === 'invalid' && (
          <>
            <h1 className="text-3xl font-semibold text-ink mb-4">Invalid unsubscribe link.</h1>
            <p className="text-ink-soft mb-8">
              The token in this link does not match. Open the latest email we sent you and click the
              unsubscribe link at the bottom there.
            </p>
          </>
        )}

        {error === 'missing' && (
          <>
            <h1 className="text-3xl font-semibold text-ink mb-4">Unsubscribe link is incomplete.</h1>
            <p className="text-ink-soft mb-8">
              The link needs both <code>email</code> and <code>token</code> query parameters. Open the latest
              email we sent and click the full unsubscribe link at the bottom.
            </p>
          </>
        )}

        <Link href="/" className="text-sm text-ink underline underline-offset-4 hover:text-ink">
          ← Back to patchbay
        </Link>
      </div>
    </main>
  )
}
