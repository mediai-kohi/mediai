import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MohReportTable from '@/components/ministry/MohReportTable'
import PastReportsList from '@/components/ministry/PastReportsList'

interface Row {
  id: string
  period_label: string
  period_start: string
  period_end: string
  bio_status: string
  bio_prev_week: string
  bio_next_week: string
  ai_status: string
  ai_prev_week: string
  ai_next_week: string
}

interface AttachmentRow {
  id: string
  filename: string
  size: number
  section: string | null
}

export default async function MinistryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'ministry_viewer'].includes(profile.role)) redirect('/')

  const { data } = await admin
    .from('moh_weekly_reports')
    .select('*')
    .or('bio_status.eq.submitted,ai_status.eq.submitted')
    .order('period_start', { ascending: false })

  const rows = (data ?? []) as Row[]
  const [latest, ...past] = rows

  const attachments = latest
    ? ((
        await admin
          .from('attachments')
          .select('id, filename, size, section')
          .eq('entity_type', 'moh_weekly_report')
          .eq('entity_id', latest.id)
      ).data ?? []) as AttachmentRow[]
    : []

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">주간업무보고</h1>
        <p className="text-xs text-gray-500 mt-1">한국보건복지인재원이 제출한 주간업무보고입니다.</p>
      </div>

      {!latest ? (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center text-sm text-gray-400">
          아직 제출된 주간업무보고가 없습니다.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{latest.period_label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{latest.period_start} ~ {latest.period_end}</p>
            </div>
            <a
              href={`/moh-weekly-report/${latest.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
            >
              PDF
            </a>
          </div>

          <MohReportTable row={latest} attachments={attachments} maskUnsubmitted={profile.role === 'ministry_viewer'} />
        </>
      )}

      <PastReportsList rows={past} />
    </div>
  )
}
