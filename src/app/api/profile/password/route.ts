import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createRawClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const PW_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/
  if (!PW_PATTERN.test(newPassword)) {
    return NextResponse.json(
      { error: '비밀번호는 영문·숫자·특수문자를 포함한 8자 이상이어야 합니다.' },
      { status: 400 }
    )
  }

  // 현재 비밀번호 검증 — 브라우저 세션에 영향 없는 별도 클라이언트 사용
  const verifyClient = createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { error: signInError } = await verifyClient.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })

  if (signInError) {
    return NextResponse.json({ error: 'wrong_password' }, { status: 400 })
  }

  // admin 클라이언트로 비밀번호 변경
  const admin = createAdminClient()
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })

  if (updateError) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
