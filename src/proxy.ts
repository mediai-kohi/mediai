import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'

  // In production: nonce + strict-dynamic (no unsafe-inline, no unsafe-eval)
  // In development: also add unsafe-eval (React uses eval for enhanced error stacks)
  const scriptSrc = isDev
    ? `'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'nonce-${nonce}' 'strict-dynamic'`

  return [
    "default-src 'self'",
    `script-src 'self' ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
  ].join('; ')
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  // Pass nonce + CSP in request headers so:
  //   1. Next.js extracts the nonce and applies it to its own framework scripts
  //   2. Server components can read x-nonce via headers() if needed
  const response = await updateSession(request, {
    'x-nonce': nonce,
    'Content-Security-Policy': csp,
  })

  // Also set CSP on response so the browser enforces it
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)

  return response
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
