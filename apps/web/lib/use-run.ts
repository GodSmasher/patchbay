'use client'

import { useCallback, useReducer, useRef } from 'react'
import type { ApiSpec, GeneratedFile, Plan, RunEvent, Source, StepId, TestReport, Usage } from '@patchbay/agent'

export type StepStatus = 'idle' | 'running' | 'done' | 'error'

export interface RunState {
  running: boolean
  mode: 'live' | 'replay' | null
  notice: string | null
  steps: Record<StepId, { status: StepStatus; detail?: string; logs: string[] }>
  plan: Plan | null
  sources: Source[]
  spec: ApiSpec | null
  drafts: { attempt: number; files: GeneratedFile[]; report: TestReport | null }[]
  usage: Usage[]
  result: { ok: boolean; attempts: number } | null
  error: string | null
}

export const STEPS: StepId[] = ['plan', 'research', 'generate', 'verify', 'package']

const emptySteps = () =>
  Object.fromEntries(STEPS.map((s) => [s, { status: 'idle' as StepStatus, logs: [] as string[] }])) as RunState['steps']

const initial: RunState = {
  running: false, mode: null, notice: null, steps: emptySteps(), plan: null, sources: [], spec: null,
  drafts: [], usage: [], result: null, error: null,
}

type Action = { type: 'reset' } | { type: 'finish' } | { type: 'event'; event: RunEvent | { type: 'notice'; message: string } }

function reducer(state: RunState, action: Action): RunState {
  if (action.type === 'reset') return { ...initial, steps: emptySteps(), running: true }
  if (action.type === 'finish') return { ...state, running: false }
  const e = action.event
  switch (e.type) {
    case 'notice':
      return { ...state, notice: e.message }
    case 'mode':
      return { ...state, mode: e.mode }
    case 'step': {
      const prev = state.steps[e.step]
      const status: StepStatus = e.status === 'start' ? 'running' : e.status
      return { ...state, steps: { ...state.steps, [e.step]: { ...prev, status, detail: e.detail ?? prev.detail } } }
    }
    case 'log': {
      const prev = state.steps[e.step]
      return { ...state, steps: { ...state.steps, [e.step]: { ...prev, logs: [...prev.logs, e.message] } } }
    }
    case 'plan':
      return { ...state, plan: e.plan }
    case 'sources':
      return { ...state, sources: e.sources }
    case 'spec':
      return { ...state, spec: e.spec }
    case 'files':
      return { ...state, drafts: [...state.drafts.filter((d) => d.attempt !== e.attempt), { attempt: e.attempt, files: e.files, report: null }] }
    case 'tests':
      return { ...state, drafts: state.drafts.map((d) => (d.attempt === e.attempt ? { ...d, report: e.report } : d)) }
    case 'usage':
      return { ...state, usage: e.usage }
    case 'result':
      return { ...state, result: { ok: e.ok, attempts: e.attempts } }
    case 'error':
      return { ...state, error: e.message }
    default:
      return state
  }
}

export function useRun() {
  const [state, dispatch] = useReducer(reducer, initial)
  const abort = useRef<AbortController | null>(null)

  const start = useCallback(async (prompt: string, replay = false) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    dispatch({ type: 'reset' })
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, replay }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        dispatch({ type: 'event', event: { type: 'error', message: data.error ?? `Request failed (${res.status})` } })
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const data = chunk.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('')
          if (data) dispatch({ type: 'event', event: JSON.parse(data) })
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({ type: 'event', event: { type: 'error', message: error instanceof Error ? error.message : String(error) } })
      }
    } finally {
      dispatch({ type: 'finish' })
    }
  }, [])

  return { state, start }
}
