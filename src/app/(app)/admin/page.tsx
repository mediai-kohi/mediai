import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import WeeklySummarySection from '@/components/admin/WeeklySummarySection'
import {
  computeWeeklySummary,
  getMonday,
  addDays,
  formatDateOnly,
  getISOWeekInfo,
} from '@/lib/weeklySummary'
import type { WeeklySummaryData } from '@/lib/weeklySummary'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const now = new Date()
  const monday = getMonday(now)
  const sunday = addDays(monday, 6)
  sunday.setHours(23, 59, 59, 999)
  const startStr = formatDateOnly(monday)
  const endStr = formatDateOnly(addDays(monday, 6))

  const [
    { count: openInquiries },
    { count: weeklyReports },
    { count: revisionRequests },
    { data: weeklyReportsRaw },
    { data: monthlyReportsRaw },
    { data: orgProfiles },
    { data: latestAiReportRaw },
  ] = await Promise.all([
    admin.from('inquiries').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    admin.from('reports').select('id', { count: 'exact', head: true })
      .gte('submitted_at', monday.toISOString()).lte('submitted_at', sunday.toISOString()),
    admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'revision_requested'),
    admin.from('reports')
      .select('id, organization, type, status, period_start, period_end, content, submitted_at, approved_at, created_at')
      .eq('type', 'weekly')
      .gte('period_start', startStr)
      .lte('period_start', endStr)
      .in('status', ['submitted', 'resubmitted', 'approved', 'revision_requested']),
    admin.from('reports')
      .select('id, organization, type, status, period_start, period_end, content, submitted_at, created_at')
      .eq('type', 'monthly')
      .eq('status', 'approved')
      .order('period_start', { ascending: false })
      .limit(24),
    admin.from('profiles')
      .select('organization')
      .eq('status', 'approved')
      .neq('role', 'super_admin'),
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
    monthlyReportsRaw ?? [],
    registeredOrgs
  )

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-5">관리자 대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <Link
          href="/admin/inquiries?status=open"
          className="border rounded-xl p-4 hover:opacity-80 transition-opacity bg-yellow-50 border-yellow-200"
        >
          <p className="text-xs font-medium text-gray-500 mb-2">미답변 문의</p>
          <p className="text-3xl font-bold text-yellow-700">{openInquiries ?? 0}</p>
        </Link>
        <Link
          href="/admin/reports"
          className="border rounded-xl p-4 hover:opacity-80 transition-opacity bg-blue-50 border-blue-200"
        >
          <p className="text-xs font-medium text-gray-500 mb-2">이번 주 보고서</p>
          <p className="text-3xl font-bold text-blue-700">{weeklyReports ?? 0}</p>
        </Link>
        <Link
          href="/admin/reports?tab=revision"
          className="border rounded-xl p-4 hover:opacity-80 transition-opacity bg-red-50 border-red-200"
        >
          <p className="text-xs font-medium text-gray-500 mb-2">수정 요청 대기</p>
          <p className="text-3xl font-bold text-red-700">{revisionRequests ?? 0}</p>
        </Link>
      </div>

      {/* 주간 실적 요약 */}
      <WeeklySummarySection initialData={summaryData} aiReport={latestAiReportRaw?.result ?? null} />
    </div>
  )
}
