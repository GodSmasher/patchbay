'use client'

import { useEffect } from 'react'

// UTM-tagging helper for Umami. On first page load with a utm_source /
// utm_medium / utm_campaign in the URL, fires a custom Umami event
// ("campaign-landing") carrying those three plus utm_content/term, and
// remembers them in sessionStorage so later navigation events on the
// same tab can be filtered by campaign in the Umami dashboard.
//
// Why a component rather than a script snippet: this way it participates
// in the Next.js render tree, runs client-side after hydration, and the
// code lives next to the rest of the analytics wiring.

interface UmamiApi {
  track: (event: string, data?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    umami?: UmamiApi
  }
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

type UtmPayload = Partial<Record<(typeof UTM_KEYS)[number], string>>

function readFromUrl(): UtmPayload | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const out: UtmPayload = {}
  let seen = false
  for (const key of UTM_KEYS) {
    const value = params.get(key)
    if (value) {
      out[key] = value.slice(0, 200) // bound length to protect analytics backend
      seen = true
    }
  }
  return seen ? out : null
}

function sendWhenReady(event: string, data: Record<string, unknown>) {
  // Umami loads via <Script strategy="afterInteractive">, so window.umami
  // may still be undefined on first paint. Poll up to ~3 s, then give up
  // silently rather than spam retries.
  let attempt = 0
  const timer = window.setInterval(() => {
    attempt += 1
    if (window.umami && typeof window.umami.track === 'function') {
      window.clearInterval(timer)
      try {
        window.umami.track(event, data)
      } catch {
        // ignore — analytics must never crash a page
      }
      return
    }
    if (attempt > 30) window.clearInterval(timer)
  }, 100)
}

export function UmamiUtmCapture() {
  useEffect(() => {
    const payload = readFromUrl()
    if (!payload) return
    try {
      sessionStorage.setItem('patchbay-utm', JSON.stringify(payload))
    } catch {
      // storage may be disabled in private mode
    }
    sendWhenReady('campaign-landing', payload)
  }, [])

  return null
}
