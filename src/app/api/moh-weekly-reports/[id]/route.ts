import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/roles'

interface AttachmentRow {
  id: string
  filename: string
  size: number
  section: string | null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireRole(['super_admin', 'moh_editor', 'ministry_viewer'])
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin, profile } = ctx

  const { data: row, error } = await admin
    .from('moh_weekly_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: attachmentRows } = await admin
    .from('attachments')
    .select('id, filename, size, section')
    .eq('entity_type', 'moh_weekly_report')
    .eq('entity_id', id)

  const attachments = (attachmentRows ?? []) as AttachmentRow[]
  const attachmentsFor = (section: string) => attachments.filter((a) => a.section === section)

  const bioVisible = row.bio_status === 'submitted' || profile.role !== 'ministry_viewer'
  const aiVisible = row.ai_status === 'submitted' || profile.role !== 'ministry_viewer'

  if (profile.role === 'ministry_viewer' && !bioVisible && !aiVisible) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: row.id,
    period_label: row.period_label,
    period_start: row.period_start,
    period_end: row.period_end,
    bio: bioVisible
      ? {
          status: row.bio_status,
          prev_week: row.bio_prev_week,
          next_week: row.bio_next_week,
          submitted_at: row.bio_submitted_at,
          prev_attachments: attachmentsFor('bio_prev'),
          next_attachments: attachmentsFor('bio_next'),
        }
      : { status: row.bio_status, available: false },
    ai: aiVisible
      ? {
          status: row.ai_status,
          prev_week: row.ai_prev_week,
          next_week: row.ai_next_week,
          submitted_at: row.ai_submitted_at,
          prev_attachments: attachmentsFor('ai_prev'),
          next_attachments: attachmentsFor('ai_next'),
        }
      : { status: row.ai_status, available: false },
  })
}
