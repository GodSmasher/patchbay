import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">That page isn&apos;t here.</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
        The link may be stale, or you landed on a shared run that was deleted. Everything else is still there.
      </p>
      <div className="mt-6 flex items-center gap-4 text-sm">
        <Link href="/" className="rounded-md bg-ink px-4 py-2 text-white">Back to patchbay</Link>
        <Link href="/bench" className="text-ink-soft hover:text-ink">See the benchmark →</Link>
      </div>
    </main>
  )
}
