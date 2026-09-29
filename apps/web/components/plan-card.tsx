import type { ApiSpec, Plan, Source } from '@patchbay/agent'

export function PlanCard({ plan, spec, sources }: { plan: Plan; spec: ApiSpec | null; sources: Source[] }) {
  return (
    <section className="rounded-xl border border-paper-line bg-paper-card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Plan</h2>
      <p className="mt-2 text-sm leading-relaxed">{plan.summary}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Endpoint label="Source" app={plan.source.app} what={plan.source.trigger} />
        <Endpoint label="Target" app={plan.target.app} what={plan.target.action} />
      </div>

      {plan.fieldMapping.length > 0 && (
        <table className="mt-4 w-full text-left text-xs">
          <thead className="text-ink-mute">
            <tr>
              <th className="pb-1.5 font-medium">From</th>
              <th className="pb-1.5 font-medium">To</th>
            </tr>
          </thead>
          <tbody>
            {plan.fieldMapping.map((m, i) => (
              <tr key={i} className="border-t border-paper-line align-top">
                <td className="py-1.5 pr-3 text-ink-soft">{m.from}</td>
                <td className="code py-1.5 text-ink">{m.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {spec && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Endpoints found in the docs</h3>
          <ul className="mt-2 space-y-1">
            {spec.target.map((t, i) => (
              <li key={i} className="code flex flex-wrap gap-x-2 text-ink-soft">
                <span className="font-semibold text-ink">{t.method}</span>
                <span className="break-all">{t.url}</span>
                <span className="text-ink-mute">auth: {t.auth.name ?? t.auth.type}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Sources</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-signal underline-offset-2 hover:underline">
                  {s.title || s.url}
                </a>
                {s.official === false && <span className="ml-1.5 text-ink-mute">third-party</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.assumptions.length > 0 && (
        <details className="mt-4 text-xs text-ink-soft">
          <summary className="cursor-pointer text-ink-mute">Assumptions ({plan.assumptions.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {plan.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function Endpoint({ label, app, what }: { label: string; app: string; what: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-ink-mute">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{app}</div>
      <div className="text-xs text-ink-soft">{what}</div>
    </div>
  )
}
