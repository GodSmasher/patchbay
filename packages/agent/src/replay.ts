import recorded from './fixtures/typeform-pipedrive/run.json'
import type { RunEvent } from './types'

export interface RecordedRun {
  prompt: string
  /** `fixture` for the bundled example, `live` for runs captured with `npm run agent -- --record`. */
  origin: 'fixture' | 'live'
  events: RunEvent[]
}

export const REPLAY_RUN = recorded as RecordedRun

/** Streams a recorded run with short pauses so the UI shows the same progression as a live run. */
export async function* replayRun(run: RecordedRun = REPLAY_RUN, pace = 1): AsyncGenerator<RunEvent> {
  yield { type: 'mode', mode: 'replay' }
  for (const event of run.events) {
    if (event.type === 'mode') continue
    await sleep(delayFor(event) * pace)
    yield event
  }
}

function delayFor(event: RunEvent): number {
  switch (event.type) {
    case 'step':
      return event.status === 'start' ? 250 : 700
    case 'files':
      return 1200
    case 'tests':
      return 1500
    default:
      return 180
  }
}

const sleep = (ms: number) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve())
