import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { user_code, password } = await request.json()

  if (!user_code || !password) {
    return NextResponse.json({ error: '사용자 ID와 비밀번호를 입력하세요.' }, { status: 400 })
  }

  const email = `${user_code.trim().toUpperCase()}@eduops.internal`
  const response = NextResponse.json({ ok: true })

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
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: '사용자 ID 또는 비밀번호가 올바르지 않습니다.' }, { status: 400 })
  }

  return response
}
