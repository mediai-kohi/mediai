import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/roles'
import { editableDepts, type MohDeptKey } from '@/lib/mohWeeklyReport'
import { notifyUser } from '@/lib/notifications/notify'
import { insertAuditLog } from '@/lib/audit'

interface MohRow {
  id: string
  period_label: string
  period_start: string
  period_end: string
  bio_prev_week: string
  bio_next_week: string
  bio_status: string
  bio_submitted_at: string | null
  ai_prev_week: string
  ai_next_week: string
  ai_status: string
  ai_submitted_at: string | null
}

// ministry_viewer에게는 제출된 부서만 노출, 미제출 부서는 텍스트를 감춤
function shapeForMinistry(row: MohRow) {
  const bioVisible = row.bio_status === 'submitted'
  const aiVisible = row.ai_status === 'submitted'
  if (!bioVisible && !aiVisible) return null
  return {
    id: row.id,
    period_label: row.period_label,
    period_start: row.period_start,
    period_end: row.period_end,
    bio: bioVisible
      ? { status: row.bio_status, prev_week: row.bio_prev_week, next_week: row.bio_next_week, submitted_at: row.bio_submitted_at }
      : { status: row.bio_status, available: false },
    ai: aiVisible
      ? { status: row.ai_status, prev_week: row.ai_prev_week, next_week: row.ai_next_week, submitted_at: row.ai_submitted_at }
      : { status: row.ai_status, available: false },
  }
}

function shapeForEditor(row: MohRow) {
  return {
    id: row.id,
    period_label: row.period_label,
    period_start: row.period_start,
    period_end: row.period_end,
    bio: { status: row.bio_status, prev_week: row.bio_prev_week, next_week: row.bio_next_week, submitted_at: row.bio_submitted_at },
    ai: { status: row.ai_status, prev_week: row.ai_prev_week, next_week: row.ai_next_week, submitted_at: row.ai_submitted_at },
  }
}

export async function GET() {
  const ctx = await requireRole(['super_admin', 'moh_editor', 'ministry_viewer'])
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin, profile } = ctx

  const { data, error } = await admin
    .from('moh_weekly_reports')
    .select('*')
    .order('period_start', { ascending: false })

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  const rows = (data ?? []) as MohRow[]

  if (profile.role === 'ministry_viewer') {
    const shaped = rows.map(shapeForMinistry).filter((r) => r !== null)
    return NextResponse.json(shaped)
  }

  return NextResponse.json(rows.map(shapeForEditor))
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ctx = await requireRole(['super_admin', 'moh_editor'])
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, admin, profile } = ctx

  const body = await request.json().catch(() => ({}))
  const {
    period_label,
    period_start,
    period_end,
    department,
    prev_week,
    next_week,
    status,
    addAttachments,
    removeAttachmentIds,
  } = body as {
    period_label?: string
    period_start?: string
    period_end?: string
    department?: MohDeptKey
    prev_week?: string
    next_week?: string
    status?: string
    addAttachments?: { path: string; filename: string; size: number; cell: 'prev' | 'next' }[]
    removeAttachmentIds?: string[]
  }

  if (!period_label || !period_start || !period_end || !department) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!['draft', 'submitted'].includes(status ?? '')) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (!editableDepts(profile.role, profile.department).includes(department)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: existing } = await admin
    .from('moh_weekly_reports')
    .select('id, bio_status, ai_status')
    .eq('period_start', period_start)
    .maybeSingle()

  const prevStatus = existing ? (department === 'bio' ? existing.bio_status : existing.ai_status) : 'draft'
  const now = new Date().toISOString()

  const upsertData: Record<string, unknown> = {
    period_label,
    period_start,
    period_end,
    [`${department}_prev_week`]: prev_week ?? '',
    [`${department}_next_week`]: next_week ?? '',
    [`${department}_status`]: status,
    [`${department}_submitted_at`]: status === 'submitted' ? now : null,
    [`${department}_updated_by`]: user.id,
    [`${department}_updated_at`]: now,
    updated_at: now,
  }

  const { data: row, error } = await admin
    .from('moh_weekly_reports')
    .upsert(upsertData, { onConflict: 'period_start' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  if (Array.isArray(addAttachments) && addAttachments.length > 0) {
    await admin.from('attachments').insert(
      addAttachments.map((a) => ({
        entity_type: 'moh_weekly_report',
        entity_id: row.id,
        filename: a.filename,
        storage_path: a.path,
        size: a.size,
        section: `${department}_${a.cell}`,
      }))
    )
  }

  if (Array.isArray(removeAttachmentIds) && removeAttachmentIds.length > 0) {
    const { data: targets } = await admin
      .from('attachments')
      .select('id, storage_path, section')
      .in('id', removeAttachmentIds)
      .eq('entity_id', row.id)
      .eq('entity_type', 'moh_weekly_report')
      .like('section', `${department}_%`)

    if (targets && targets.length > 0) {
      await admin.storage.from('attachments').remove(targets.map((t) => t.storage_path))
      await admin.from('attachments').delete().in('id', targets.map((t) => t.id))
    }
  }

  if (status === 'submitted' && prevStatus !== 'submitted') {
    const { data: viewers } = await admin.from('profiles').select('id').eq('role', 'ministry_viewer')
    if (viewers && viewers.length > 0) {
      const deptLabel = department === 'bio' ? '바이오헬스교육부' : '의료AI교육팀'
      await Promise.all(
        viewers.map((v) =>
          notifyUser(
            v.id,
            'moh_report_submitted',
            '주간업무보고 제출: ' + period_label,
            `[${deptLabel}] 주간업무보고가 제출되었습니다.`,
            row.id
          ).catch((err) => console.error('[notify moh_report_submitted]', err))
        )
      )
    }

    await insertAuditLog({
      action: 'moh_weekly_report.submit',
      userId: user.id,
      targetType: 'moh_weekly_report',
      targetId: row.id,
      ipAddress: ip,
      metadata: { department, period_label },
    })
  }

  return NextResponse.json({ id: row.id })
}
