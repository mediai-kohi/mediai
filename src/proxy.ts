import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function buildCsp(): string {
  const isDev = process.env.NODE_ENV === 'development'

  // nonce + strict-dynamic requires every page to be dynamically rendered
  // (see node_modules/next/dist/docs/.../content-security-policy.md).
  // This app has statically prerendered pages (/, /auth/login, /auth/signup),
  // so script tags ship without a nonce and strict-dynamic blocks all JS —
  // falling back to unsafe-inline until pages are forced dynamic.
  const scriptSrc = isDev
    ? "'unsafe-inline' 'unsafe-eval'"
    : "'unsafe-inline'"

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
  const csp = buildCsp()

  const response = await updateSession(request, {
    'Content-Security-Policy': csp,
  })

  // Also set CSP on response so the browser enforces it
  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
