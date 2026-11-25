'use client'

// PostHog client-side initializer. Autocaptures pageviews, click events,
// UTM parameters (utm_source/medium/campaign/content/term) and session
// identifiers with no further wiring. Previous Umami + custom UTM-capture
// component removed — PostHog's built-in $pageview event carries all
// five UTM fields as event properties automatically.
//
// Usage: render <PostHogProvider /> once in the root layout, right after
// the opening <body>. It mounts nothing visible.

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

let initialised = false

function ensureInit() {
  if (initialised || typeof window === 'undefined' || !PH_KEY) return
  posthog.init(PH_KEY, {
    api_host: PH_HOST,
    // App Router handles its own routing; we fire $pageview ourselves on
    // every pathname change, so autocapture would double-count.
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: true,
    disable_session_recording: true,
    // Respect Do Not Track; PostHog does this by default but spelling it
    // out keeps the config legible.
    respect_dnt: true,
  })
  initialised = true
}

export function PostHogProvider() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    ensureInit()
  }, [])

  useEffect(() => {
    if (!PH_KEY || !initialised) return
    try {
      const url = window.location.origin + pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
      posthog.capture('$pageview', { $current_url: url })
    } catch {
      // posthog must never break a navigation
    }
  }, [pathname, searchParams])

  return null
}
