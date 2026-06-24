import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdmins } from '@/lib/notifications/notify'
import { NextResponse } from 'next/server'
import { insertAuditLog } from '@/lib/audit'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const [{ data: myReports }, { data: orgReports }] = await Promise.all([
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('period_start', { ascending: false }),
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, author:profiles!user_id(id, user_code, organization)')
      .eq('organization', profile.organization)
      .or(`user_id.is.null,user_id.neq.${user.id}`)
      .neq('status', 'draft')
      .order('period_start', { ascending: false }),
  ])

  return NextResponse.json({
    myReports: myReports ?? [],
    orgReports: orgReports ?? [],
  })
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Not approved' }, { status: 403 })
  }

  const body = await request.json()
  const { type, period_label, period_start, period_end, content, status, attachments } = body

  if (!type || !period_label || !period_start || !period_end || !content || !status) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (type !== 'weekly') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  if (!['draft', 'submitted'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // 기관+유형+기간 중복 확인
  const { data: existing } = await admin
    .from('reports')
    .select('id')
    .eq('organization', profile.organization)
    .eq('type', type)
    .eq('period_start', period_start)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: '해당 기간에 이미 작성된 보고서가 있습니다. 기존 보고서를 수정해 주세요.' },
      { status: 409 }
    )
  }

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    organization: profile.organization,
    type,
    period_label,
    period_start,
    period_end,
    content,
    status,
  }

  if (status === 'submitted') {
    insertData.submitted_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from('reports')
    .insert(insertData)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  if (Array.isArray(attachments) && attachments.length > 0) {
    await admin.from('attachments').insert(
      attachments.map((a: { path: string; filename: string; size: number }) => ({
        entity_type: 'report',
        entity_id: data.id,
        filename: a.filename,
        storage_path: a.path,
        size: a.size,
      }))
    )
  }

  if (status === 'submitted') {
    notifyAdmins(
      'new_report',
      '새 주간보고 제출: ' + period_label,
      '[' + (profile.organization ?? '') + '] 주간보고 제출 (' + period_start + ' ~ ' + period_end + ')',
      data.id
    ).catch((err) => console.error('[notify new_report]', err))

    await insertAuditLog({
      action: 'report.submit',
      userId: user.id,
      targetType: 'report',
      targetId: data.id,
      ipAddress: ip,
      metadata: { type, period_label, organization: profile.organization },
    })
  }

  return NextResponse.json({ id: data.id })
}
