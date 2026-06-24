import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser } from '@/lib/notifications/notify'
import { NextResponse } from 'next/server'
import {
  computeWeeklySummary,
  getMonday,
  addDays,
  formatDateOnly,
  getISOWeekInfo,
} from '@/lib/weeklySummary'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { data, error } = await admin
    .from('reports')
    .select('id, type, period_label, content, organization, user_id')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: author } = await admin
    .from('profiles').select('id, user_code, organization').eq('id', (data as { user_id: string }).user_id).single()

  return NextResponse.json({ ...data, author: author ?? null })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  // 첨부파일 스토리지 + DB 삭제
  const { data: atts } = await admin
    .from('attachments').select('storage_path')
    .eq('entity_type', 'report').eq('entity_id', id)
  if (atts && atts.length > 0) {
    await admin.storage.from('attachments').remove(atts.map((a: { storage_path: string }) => a.storage_path))
    await admin.from('attachments').delete().eq('entity_type', 'report').eq('entity_id', id)
  }

  // 승인 시 생성된 캘린더 이벤트 삭제
  await admin.from('events').delete().eq('source', 'report').eq('source_id', id)

  const { error } = await admin.from('reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.revision_comment !== undefined) updates.revision_comment = body.revision_comment
  if (body.status === 'approved') updates.approved_at = new Date().toISOString()

  const { data, error } = await admin
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  // 승인 시 해당 주차 전 기관 완료 여부 확인 → 자동 확정
  if (body.status === 'approved' && (data as Record<string, unknown>).type === 'weekly') {
    try {
      const periodStart = (data as Record<string, unknown>).period_start as string
      const weekStart = getMonday(new Date(periodStart))
      const weekEnd = addDays(weekStart, 6)
      const startStr = formatDateOnly(weekStart)
      const endStr = formatDateOnly(weekEnd)

      const [{ data: weekReports }, { data: orgProfiles }] = await Promise.all([
        admin
          .from('reports')
          .select('id, organization, type, status, period_start, period_end, content, submitted_at, approved_at, created_at')
          .eq('type', 'weekly')
          .gte('period_start', startStr)
          .lte('period_start', endStr)
          .in('status', ['submitted', 'resubmitted', 'approved', 'revision_requested']),
        admin
          .from('profiles')
          .select('organization')
          .eq('status', 'approved')
          .neq('role', 'super_admin'),
      ])

      const registeredOrgs = [...new Set(
        (orgProfiles ?? []).map((p: { organization: string }) => p.organization).filter(Boolean)
      )]

      const approvedOrgs = new Set(
        (weekReports ?? []).filter((r) => r.status === 'approved').map((r) => r.organization)
      )
      const allApproved = registeredOrgs.every((org) => approvedOrgs.has(org))

      if (allApproved) {
        const { year, week_number } = getISOWeekInfo(weekStart)
        const { data: existing } = await admin
          .from('weekly_summaries')
          .select('status')
          .eq('year', year)
          .eq('week_number', week_number)
          .maybeSingle()

        if (!existing || existing.status !== 'confirmed') {
          const summary = computeWeeklySummary(weekReports ?? [], weekStart, 'confirmed', null, registeredOrgs)
          const confirmedAt = new Date().toISOString()
          await admin.from('weekly_summaries').upsert({
            year,
            week_number,
            period_label: summary.period_label,
            period_start: summary.period_start,
            period_end: summary.period_end,
            status: 'confirmed',
            confirmed_at: confirmedAt,
            snapshot: { ...summary, status: 'confirmed', confirmed_at: confirmedAt },
            updated_at: confirmedAt,
          }, { onConflict: 'year,week_number' })
        }
      }
    } catch (autoConfirmErr) {
      console.error('[auto-confirm weekly summary]', autoConfirmErr)
    }
  }

  const { data: author } = await admin
    .from('profiles').select('id, user_code, organization').eq('id', (data as { user_id: string }).user_id).single()

  const isRevision =
    body.status === 'revision_requested' ||
    (typeof body.revision_comment === 'string' && body.revision_comment.trim().length > 0)

  if (isRevision) {
    const authorId = (data as Record<string, unknown>).user_id as string | undefined
    const reportTypeStr =
      (data as Record<string, unknown>).type === 'weekly' ? '주간보고' : '월간보고'
    const label =
      ((data as Record<string, unknown>).period_label as string | undefined) ?? '보고'
    if (authorId) {
      await notifyUser(
        authorId,
        'report_revision',
        reportTypeStr + ' - ' + label,
        body.revision_comment ?? '관리자가 정정을 요청했습니다.',
        id
      ).catch((err) => console.error('[notify report_revision]', err))
    }
  }

  return NextResponse.json({ ...data, author: author ?? null })
}
