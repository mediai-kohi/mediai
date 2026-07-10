import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkLoginRateLimit, recordLoginFailure } from '@/lib/rate-limit'
import { insertAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const formData = await request.formData()
  const user_code = formData.get('user_code')?.toString().trim().toUpperCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  const redirectUrl = new URL('/auth/login', request.url)
  redirectUrl.searchParams.set('error', '1')

  if (!user_code || !password) return NextResponse.redirect(redirectUrl)

  const rl = await checkLoginRateLimit(ip, user_code)
  if (!rl.allowed) {
    redirectUrl.searchParams.set('error', 'rate_limit')
    return NextResponse.redirect(redirectUrl)
  }

  const email = `${user_code}@eduops.internal`
  const successRedirect = new URL('/', request.url)
  const successResponse = NextResponse.redirect(successRedirect)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            successResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    await recordLoginFailure(ip, user_code)
    await insertAuditLog({ action: 'auth.login.fail', ipAddress: ip, metadata: { user_code } })
    return NextResponse.redirect(redirectUrl)
  }

  await insertAuditLog({ action: 'auth.login.success', userId: authData.user?.id, ipAddress: ip })
  return successResponse
}
