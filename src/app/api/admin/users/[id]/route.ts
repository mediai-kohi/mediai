import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notifications/notify'
import { NextResponse } from 'next/server'
import { insertAuditLog } from '@/lib/audit'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, admin } = ctx

  if (id === user.id) return NextResponse.json({ error: '자기 자신은 삭제할 수 없습니다.' }, { status: 400 })

  const { data: profile } = await admin.from('profiles').select('id, user_code').eq('id', id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 에피메럴 데이터만 제거 (디바이스 토큰, AI 대화 이력)
  // 보고서·문의·답변은 FK가 ON DELETE SET NULL 이므로 profile 삭제 시 자동으로 user_id = NULL 처리됨
  await admin.from('push_subscriptions').delete().eq('user_id', id)
  await admin.from('chat_histories').delete().eq('user_id', id)
  await admin.from('profiles').delete().eq('id', id)

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  await insertAuditLog({
    action: 'admin.user.delete',
    userId: user.id,
    targetType: 'user',
    targetId: id,
    ipAddress: ip,
    metadata: { user_code: (profile as { user_code: string }).user_code },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, admin } = ctx

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.status !== undefined) updates.status = body.status
  if (body.role !== undefined) updates.role = body.role
  if (body.memo !== undefined) updates.memo = body.memo
  if (body.organization !== undefined) {
    if (!body.organization?.trim()) return NextResponse.json({ error: 'organization은 비울 수 없습니다.' }, { status: 400 })
    updates.organization = body.organization.trim()
  }

  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  if (body.status === 'approved') {
    await notifyUser(
      id,
      'signup_approved',
      '가입이 승인되었습니다',
      '의료AI 사업관리시스템 가입이 승인되었습니다. 로그인하여 이용해 주세요.'
    ).catch((err) => console.error('[notify signup_approved]', err))
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  await insertAuditLog({
    action: 'admin.user.status_change',
    userId: user.id,
    targetType: 'user',
    targetId: id,
    ipAddress: ip,
    metadata: updates,
  })

  return NextResponse.json(data)
}
