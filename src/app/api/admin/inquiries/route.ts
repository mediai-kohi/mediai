import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function GET(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { searchParams } = new URL(request.url)
  const search       = searchParams.get('search') ?? ''
  const status       = searchParams.get('status') ?? 'all'
  const category     = searchParams.get('category') ?? 'all'
  const organization = searchParams.get('organization') ?? 'all'
  const sort         = searchParams.get('sort') ?? 'date'
  const page         = parseInt(searchParams.get('page') ?? '0')
  const pageSize     = 20

  let query = admin
    .from('inquiries')
    .select('id, title, category, is_public, status, organization, created_at, user_id', { count: 'exact' })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (sort === 'open') {
    query = query.order('status', { ascending: true }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (search)              query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  if (status === 'open')   query = query.in('status', ['open', 'in_progress'])
  else if (status === 'closed') query = query.eq('status', 'closed')
  if (category !== 'all')      query = query.eq('category', category)
  if (organization !== 'all')  query = query.eq('organization', organization)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  // 작성자 프로필을 별도 쿼리로 조회 (FK join 방식 대신 명시적 lookup)
  const userIds = [...new Set((data ?? []).map((row: Record<string, unknown>) => row.user_id as string).filter(Boolean))]
  const { data: authorProfiles } = userIds.length > 0
    ? await admin.from('profiles').select('id, email, organization').in('id', userIds)
    : { data: [] as { id: string; email: string; organization: string }[] }

  const inquiries = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    author: authorProfiles?.find(p => p.id === row.user_id) ?? null,
  }))

  return NextResponse.json({ inquiries, total: count ?? 0 })
}
