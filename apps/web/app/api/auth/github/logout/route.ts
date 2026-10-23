import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/github-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const res = NextResponse.redirect(new URL('/?gh=disconnected', url.origin), { status: 303 })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}

export async function GET(request: Request) {
  return POST(request)
}
