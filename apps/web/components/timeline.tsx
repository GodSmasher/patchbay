'use client'

import { useState } from 'react'
import type { StepId } from '@patchbay/agent'
import { STEPS, type RunState, type StepStatus } from '@/lib/use-run'

const LABELS: Record<StepId, { title: string; model: string }> = {
  plan: { title: 'Plan', model: 'Nemotron Lightning' },
  research: { title: 'Read the API docs', model: 'Tavily + Nemotron Super' },
  generate: { title: 'Write connector + tests', model: 'Nemotron Ultra' },
  verify: { title: 'Prove it in a sandbox', model: 'Nebius Sandboxes' },
  package: { title: 'Package', model: '' },
}

export function Timeline({ state }: { state: RunState }) {
  // Finished steps collapse by default; the currently running step stays expanded
  // so the user sees progress without having to scroll past old logs.
  const [overrides, setOverrides] = useState<Partial<Record<StepId, boolean>>>({})

  return (
    <ol className="space-y-1">
      {STEPS.map((id) => {
        const step = state.steps[id]
        const hasLogs = step.logs.length > 0
        const autoOpen = step.status === 'running' || step.status === 'error'
        const open = overrides[id] ?? autoOpen
        const toggle = () => hasLogs && setOverrides((prev) => ({ ...prev, [id]: !open }))
        return (
          <li key={id} className="rounded-lg px-3 py-2.5">
            <div className="flex items-start gap-3">
              <Dot status={step.status} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!hasLogs}
                  className={`flex w-full items-baseline justify-between gap-2 text-left ${hasLogs ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`text-sm font-medium ${step.status === 'idle' ? 'text-ink-mute' : 'text-ink'}`}>
                    {LABELS[id].title}
                    {hasLogs && !open && (
                      <span className="ml-2 text-[11px] font-normal text-ink-mute">
                        {step.logs.length} event{step.logs.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                  {LABELS[id].model && <span className="shrink-0 text-[11px] text-ink-mute">{LABELS[id].model}</span>}
                </button>
                {step.detail && (
                  <p className={`mt-0.5 text-xs ${step.status === 'error' ? 'text-warn' : 'text-ink-soft'}`}>{step.detail}</p>
                )}
                {hasLogs && open && (
                  <ul className="mt-1.5 space-y-0.5 border-l border-paper-line pl-2.5">
                    {step.logs.map((line, i) => (
                      <li key={i} className="text-[11.5px] leading-snug text-ink-mute">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Dot({ status }: { status: StepStatus }) {
  const cls: Record<StepStatus, string> = {
    idle: 'border border-paper-line bg-paper-card',
    running: 'bg-signal pulse-dot',
    done: 'bg-signal',
    error: 'bg-warn',
  }
  return <span aria-label={status} className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${cls[status]}`} />
}
