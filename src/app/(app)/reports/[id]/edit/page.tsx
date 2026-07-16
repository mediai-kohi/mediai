import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import ReportForm from '../../ReportForm'
import { defaultWeekly, type WeeklyContent } from '../../report-types'

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default async function EditReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ resubmit?: string }>
}) {
  const { id } = await params
  const { resubmit } = await searchParams
  const isResubmit = resubmit === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const [{ data: report }, { data: profile }, { data: attachments }] = await Promise.all([
    admin.from('reports').select('*').eq('id', id).single(),
    admin.from('profiles').select('organization, role').eq('id', user.id).single(),
    admin.from('attachments').select('id, filename, size').eq('entity_type', 'report').eq('entity_id', id),
  ])

  if (!report || !profile) notFound()

  const isAdmin = profile.role === 'super_admin'
  const isSameOrg = !!profile.organization && profile.organization === report.organization

  if (!isAdmin) {
    if (report.user_id !== user.id && !isSameOrg) notFound()
    const allowedStatuses = isResubmit ? ['revision_requested', 'revision_approved'] : ['draft', 'submitted']
    if (!allowedStatuses.includes(report.status)) redirect(`/reports/${id}`)
  }

  const initialWeeklyDate = toDateStr(getMondayOfWeek(new Date(report.period_start + 'T00:00:00')))
  const raw = report.content as Partial<WeeklyContent>
  const def = defaultWeekly(profile.organization ?? '')
  const content: WeeklyContent = {
    ...def,
    ...raw,
    budget:        raw.budget        ?? def.budget,
    kpi_rows:      raw.kpi_rows      ?? def.kpi_rows,
    activity_rows: raw.activity_rows ?? def.activity_rows,
  }

  return (
    <ReportForm
      mode={isResubmit ? 'resubmit' : 'edit'}
      reportId={id}
      initialWeeklyDate={initialWeeklyDate}
      initialWeeklyContent={content}
      initialStatus={report.status}
      forceAllowSubmit={isResubmit}
      userProfile={{ organization: profile.organization }}
      initialAttachments={(attachments ?? []) as { id: string; filename: string; size: number }[]}
    />
  )
}
