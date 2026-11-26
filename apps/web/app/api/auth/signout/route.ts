// Sign-out endpoint — called by POST from the dashboard. Clears the
// Supabase session cookie, then redirects to the homepage.
import { NextResponse, type NextRequest } from 'next/server'
import { serverClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await serverClient()
  await supabase.auth.signOut()
  const origin = new URL(request.url).origin
  return NextResponse.redirect(new URL('/', origin), { status: 303 })
}
