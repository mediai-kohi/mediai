import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeeklySummarySection from '@/components/admin/WeeklySummarySection'
import {
  computeWeeklySummary,
  getWeekStartForDisplay,
  addDays,
  formatDateOnly,
  getISOWeekInfo,
} from '@/lib/weeklySummary'
import type { WeeklySummaryData } from '@/lib/weeklySummary'

export default async function MinistryWeeklySummaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'ministry_viewer'].includes(profile.role)) redirect('/')

  const now = new Date()
  const monday = getWeekStartForDisplay(now)
  const startStr = formatDateOnly(monday)
  const endStr = formatDateOnly(addDays(monday, 6))

  const [{ data: weeklyReportsRaw }, { data: orgProfiles }, { data: latestAiReportRaw }] = await Promise.all([
    admin.from('reports')
      .select('id, organization, type, status, period_start, period_end, content, submitted_at, approved_at, created_at')
      .eq('type', 'weekly')
      .gte('period_start', startStr)
      .lte('period_start', endStr)
      .in('status', ['submitted', 'resubmitted', 'approved', 'revision_requested']),
    admin.from('profiles')
      .select('organization')
      .eq('status', 'approved')
      .eq('role', 'user'),
    admin.from('ai_analysis_reports')
      .select('id, period_label, result, created_at')
      .eq('start_date', startStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const registeredOrgs = [...new Set(
    (orgProfiles ?? []).map((p: { organization: string }) => p.organization).filter(Boolean)
  )].sort()

  const { year, week_number } = getISOWeekInfo(monday)
  const { data: existingSummary } = await admin
    .from('weekly_summaries')
    .select('status, confirmed_at')
    .eq('year', year)
    .eq('week_number', week_number)
    .maybeSingle()

  const summaryData: WeeklySummaryData = computeWeeklySummary(
    weeklyReportsRaw ?? [],
    monday,
    (existingSummary?.status as 'partial' | 'confirmed') ?? 'partial',
    existingSummary?.confirmed_at ?? null,
    registeredOrgs
  )

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-5">의료AI 교육현황</h1>
      <WeeklySummarySection initialData={summaryData} aiReport={latestAiReportRaw?.result ?? null} readOnly />
    </div>
  )
}
