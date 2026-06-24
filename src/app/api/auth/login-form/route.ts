import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkLoginRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await checkLoginRateLimit(ip)

  const formData = await request.formData()
  const user_code = formData.get('user_code')?.toString().trim().toUpperCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  const redirectUrl = new URL('/auth/login', request.url)
  redirectUrl.searchParams.set('error', '1')

  if (!rl.allowed) {
    redirectUrl.searchParams.set('error', 'rate_limit')
    return NextResponse.redirect(redirectUrl)
  }

  if (!user_code || !password) return NextResponse.redirect(redirectUrl)

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

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return NextResponse.redirect(redirectUrl)

  return successResponse
}
