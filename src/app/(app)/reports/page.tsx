import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ReportList from './ReportList'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  const [{ data: myReports }, { data: orgReportsRaw }] = await Promise.all([
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('period_start', { ascending: false }),
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, user_id')
      .eq('organization', profile.organization)
      .or(`user_id.is.null,user_id.neq.${user.id}`)
      .neq('status', 'draft')
      .order('period_start', { ascending: false }),
  ])

  // FK join 대신 명시적 별도 쿼리로 author 프로필 조회
  const orgReportsList = orgReportsRaw ?? []
  const authorIds = [...new Set(orgReportsList.map((r: { user_id: string }) => r.user_id).filter(Boolean))]
  const { data: authorProfiles } = authorIds.length > 0
    ? await admin.from('profiles').select('id, user_code, organization').in('id', authorIds)
    : { data: [] as { id: string; user_code: string; organization: string }[] }

  const orgReports = orgReportsList.map((r: { user_id: string | null }) => ({
    ...r,
    author: r.user_id ? (authorProfiles?.find((p) => p.id === r.user_id) ?? null) : null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <ReportList
      myReports={(myReports ?? []) as any[]}
      orgReports={orgReports as any[]}
    />
  )
}
