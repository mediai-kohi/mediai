import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// 경로 prefix별 접근 허용 role. 매칭되는 prefix인데 role이 목록에 없으면 '/'로 리다이렉트.
const ROUTE_ACCESS: { prefix: string; roles: string[] }[] = [
  { prefix: '/admin', roles: ['super_admin'] },
  { prefix: '/moh-report', roles: ['super_admin', 'moh_editor'] },
  { prefix: '/ministry', roles: ['super_admin', 'ministry_viewer'] },
]

// moh_editor/ministry_viewer는 아래 prefix 밖으로 나갈 수 없도록 가둠(그 외 role은 제한 없음)
// '/'는 prefix가 아니라 정확히 홈 경로일 때만 매치(그렇지 않으면 모든 경로가 '/'로 시작하므로 가둠이 무력화됨)
const CONFINED_ALLOWED: Record<string, string[]> = {
  moh_editor: ['/moh-report', '/moh-weekly-report', '/mypage'],
  ministry_viewer: ['/', '/ministry', '/moh-weekly-report', '/weekly-summary', '/calendar', '/inquiries', '/ai-qa', '/mypage'],
}

const CONFINED_HOME: Record<string, string> = {
  moh_editor: '/moh-report',
  ministry_viewer: '/ministry',
}

export async function updateSession(request: NextRequest, extraHeaders?: Record<string, string>) {
  // Build request headers — include extra headers (e.g. nonce, CSP) so downstream
  // server components can read them via headers()
  const buildReqHeaders = () => {
    const h = new Headers(request.headers)
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) h.set(k, v)
    }
    return h
  }

  let supabaseResponse = NextResponse.next({ request: { headers: buildReqHeaders() } })

  // 세션 관리용 (anon key + cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request: { headers: buildReqHeaders() } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 프로필 조회용 (service role key — RLS 우회)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 비로그인 사용자가 /auth/* 또는 /api/* 외 경로 접근 시 로그인으로 리다이렉트
  // (API 라우트는 자체적으로 인증을 처리)
  if (!user && !pathname.startsWith('/auth') && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // 로그인 사용자에 대한 처리
  if (user) {
    const getProfile = async () => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('status, role')
        .eq('id', user.id)
        .single()
      return data
    }

    // /auth/login, /auth/signup, /auth/pending 접근 시 상태에 따라 리다이렉트
    if (pathname === '/auth/login' || pathname === '/auth/signup' || pathname === '/auth/pending') {
      const profile = await getProfile()

      if (profile) {
        if (profile.status === 'pending') {
          return NextResponse.redirect(new URL('/auth/pending', request.url))
        } else if (profile.status === 'rejected') {
          return NextResponse.redirect(new URL('/auth/rejected', request.url))
        } else if (profile.status === 'approved') {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    }

    // pending/rejected 사용자 접근 제한
    if (!pathname.startsWith('/auth')) {
      const profile = await getProfile()

      if (profile) {
        if (profile.status === 'pending') {
          return NextResponse.redirect(new URL('/auth/pending', request.url))
        }
        if (profile.status === 'rejected') {
          return NextResponse.redirect(new URL('/auth/rejected', request.url))
        }

        if (!pathname.startsWith('/api')) {
          const matchedRoute = ROUTE_ACCESS.find((r) => pathname.startsWith(r.prefix))
          if (matchedRoute && !matchedRoute.roles.includes(profile.role)) {
            return NextResponse.redirect(new URL('/', request.url))
          }

          const confinedPrefixes = CONFINED_ALLOWED[profile.role]
          if (confinedPrefixes && !confinedPrefixes.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)))) {
            return NextResponse.redirect(new URL(CONFINED_HOME[profile.role] ?? '/', request.url))
          }
        }
      }

      // 2FA 확인 (/api/* 제외)
      if (!pathname.startsWith('/api')) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal) {
          if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
            // TOTP 등록했으나 이번 세션에서 미인증 → 인증 페이지로
            return NextResponse.redirect(new URL('/auth/verify-2fa', request.url))
          }
          if (aal.nextLevel === 'aal1' && aal.currentLevel === 'aal1') {
            // TOTP 미등록 → 강제 설정 페이지로
            return NextResponse.redirect(new URL('/auth/setup-2fa', request.url))
          }
        }
      }
    }
  }

  return supabaseResponse
}
