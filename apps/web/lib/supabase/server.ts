// Server-side Supabase client factory. Separate helpers for:
// - serverClient(): request-scoped, uses cookies for session (anon-key, RLS applies)
// - serviceClient(): uses SUPABASE_SERVICE_ROLE_KEY, bypasses RLS. ONLY call in
//   server-only code paths (API routes, webhook handlers, cron jobs). NEVER ship
//   the service key to the browser.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createPlainClient } from '@supabase/supabase-js'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Supabase env var ${name} missing`)
  return v
}

export async function serverClient() {
  const cookieStore = await cookies()
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called from a Server Component where Set-Cookie can't be mutated
          // — handled by middleware; no action here.
        }
      },
    },
  })
}

export function serviceClient() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  return createPlainClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
