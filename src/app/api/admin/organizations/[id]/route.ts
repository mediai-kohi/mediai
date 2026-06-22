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
  return { admin }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: '기관명을 입력하세요.' }, { status: 400 })

  // 변경 전 기관명 조회
  const { data: current, error: fetchError } = await ctx.admin
    .from('organizations')
    .select('name')
    .eq('id', id)
    .single()

  if (fetchError || !current) return NextResponse.json({ error: '기관을 찾을 수 없습니다.' }, { status: 404 })

  const oldName = current.name

  // organizations 테이블 업데이트
  const { data, error } = await ctx.admin
    .from('organizations')
    .update({ name })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 존재하는 기관명입니다.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 기관명이 실제로 변경된 경우 연관 테이블 일괄 업데이트
  if (oldName !== name) {
    await Promise.all([
      ctx.admin.from('profiles').update({ organization: name }).eq('organization', oldName),
      ctx.admin.from('reports').update({ organization: name }).eq('organization', oldName),
      ctx.admin.from('events').update({ organization: name }).eq('organization', oldName),
    ])
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await ctx.admin
    .from('organizations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
