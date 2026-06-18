import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import type { WeeklySummaryData } from '@/lib/weeklySummary'
import { KPI_LABELS } from '@/lib/weeklySummary'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { data: summary, error } = await admin
    .from('weekly_summaries')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !summary) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const snapshot = summary.snapshot as WeeklySummaryData
  const wb = XLSX.utils.book_new()

  // Sheet 1: 주간 KPI 요약
  const kpiHeader = ['지표명', '목표 합계', '누적 실적', '달성률']
  const kpiRows = (snapshot.kpi_totals ?? []).map((k) => [
    k.label,
    k.target,
    k.actual,
    k.rate,
  ])
  const kpiSheet = XLSX.utils.aoa_to_sheet([
    [`${snapshot.period_label} 주간 실적 요약`],
    [`확정일: ${summary.confirmed_at ? new Date(summary.confirmed_at).toLocaleDateString('ko-KR') : '-'}`],
    [],
    kpiHeader,
    ...kpiRows,
  ])
  kpiSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, kpiSheet, 'KPI 요약')

  // Sheet 2: 기관별 현황
  const orgHeader = ['기관명', '제출 상태', ...KPI_LABELS]
  const orgRows = (snapshot.org_statuses ?? []).map((o) => [
    o.org,
    o.display_status,
    ...(KPI_LABELS.map((_, i) => {
      const row = o.kpi_rows?.[i]
      return row ? `목표: ${row.target} / 실적: ${row.actual}` : '-'
    })),
  ])
  const orgSheet = XLSX.utils.aoa_to_sheet([
    [`${snapshot.period_label} 운영기관별 세부 현황`],
    [],
    orgHeader,
    ...orgRows,
  ])
  orgSheet['!cols'] = [
    { wch: 16 },
    { wch: 8 },
    ...KPI_LABELS.map(() => ({ wch: 22 })),
  ]
  XLSX.utils.book_append_sheet(wb, orgSheet, '기관별 현황')

  // Sheet 3: 예산 집행
  if (snapshot.budget?.total_budget > 0 || (snapshot.budget?.org_executions?.length ?? 0) > 0) {
    const budgetRows: (string | number)[][] = [
      [`${snapshot.period_label} 예산 집행 현황`],
      [],
      ['구분', '금액(원)'],
      ['총 예산(보조금)', snapshot.budget.total_budget],
      ['총 집행액', snapshot.budget.total_executed],
      ['집행률', snapshot.budget.execution_rate],
      [],
      ['기관명', '집행액(원)'],
      ...(snapshot.budget.org_executions ?? []).map((e) => [e.org, e.executed]),
    ]
    const budgetSheet = XLSX.utils.aoa_to_sheet(budgetRows)
    budgetSheet['!cols'] = [{ wch: 20 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, budgetSheet, '예산 집행')
  }

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const safeName = (summary.period_label as string).replace(/[/\\:*?"<>|]/g, '_')

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '_주간실적요약')}.xlsx`,
    },
  })
}
