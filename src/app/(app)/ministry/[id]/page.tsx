import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import MohReportTable from '@/components/ministry/MohReportTable'

interface AttachmentRow {
  id: string
  filename: string
  size: number
  section: string | null
}

export default async function MinistryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'ministry_viewer'].includes(profile.role)) redirect('/')

  const { data: row } = await admin.from('moh_weekly_reports').select('*').eq('id', id).single()
  if (!row) notFound()

  const isMinistry = profile.role === 'ministry_viewer'
  if (isMinistry && row.bio_status !== 'submitted' && row.ai_status !== 'submitted') notFound()

  const { data: attachmentRows } = await admin
    .from('attachments')
    .select('id, filename, size, section')
    .eq('entity_type', 'moh_weekly_report')
    .eq('entity_id', id)

  const attachments = (attachmentRows ?? []) as AttachmentRow[]

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/ministry" className="text-xs text-gray-400 hover:text-gray-600">← 이번 주 보고로</Link>
          <h1 className="text-lg font-bold text-gray-900 mt-1">{row.period_label}</h1>
          <p className="text-xs text-gray-500">{row.period_start} ~ {row.period_end}</p>
        </div>
        <a
          href={`/moh-weekly-report/${row.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
        >
          PDF
        </a>
      </div>

      <MohReportTable row={row} attachments={attachments} maskUnsubmitted={isMinistry} />
    </div>
  )
}
