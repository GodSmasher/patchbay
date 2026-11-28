// Magic-link callback. Supabase sends the user here after they click
// the link in the email. Exchange the code for a session cookie, then
// redirect to the ?next= URL (defaults to /app).
import { NextResponse, type NextRequest } from 'next/server'
import { serverClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/app'

  if (!code) {
    const err = new URL('/signin', origin)
    err.searchParams.set('error', 'missing_code')
    return NextResponse.redirect(err)
  }

  const supabase = await serverClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const err = new URL('/signin', origin)
    err.searchParams.set('error', error.message)
    return NextResponse.redirect(err)
  }

  // Normalize the next path to our own origin only (avoid open-redirect).
  const safeNext = next.startsWith('/') ? next : '/app'
  return NextResponse.redirect(new URL(safeNext, origin))
}
