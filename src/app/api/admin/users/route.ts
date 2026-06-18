import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

function generateUserCode() {
  return randomBytes(4).toString('hex').toUpperCase()
}

function generateTempPassword() {
  return randomBytes(9).toString('base64url')
}

export async function GET(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') ?? 'all'

  let query = admin
    .from('profiles')
    .select('id, user_code, organization, role, status, created_at, memo')
    .order('created_at', { ascending: false })

  if (tab === 'pending') query = query.eq('status', 'pending')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const body = await request.json().catch(() => ({}))
  const organization: string = body.organization ?? '미지정'

  // 유니크 user_code 생성 (충돌 시 최대 5회 재시도)
  let user_code = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateUserCode()
    const { data } = await admin.from('profiles').select('id').eq('user_code', candidate).maybeSingle()
    if (!data) { user_code = candidate; break }
  }
  if (!user_code) {
    return NextResponse.json({ error: '사용자 코드 생성에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
  }

  const temp_password = generateTempPassword()
  const email = `${user_code}@eduops.internal`

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? '사용자 생성 실패' }, { status: 500 })
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    user_code,
    organization,
    role: 'user',
    status: 'approved',
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch(() => null)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ user_code, temp_password }, { status: 201 })
}
