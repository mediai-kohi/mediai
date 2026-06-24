import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import type { WeeklySummaryData } from '@/lib/weeklySummary'
import {
  KPI_LABELS, ACTIVITY_LABELS,
  calcBudgetRow, calcBudgetSubtotal, fmtNum, calcRate,
} from '@/app/(app)/reports/report-types'
import type { WeeklyContent } from '@/app/(app)/reports/report-types'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

function buildOrgSheet(org: string, periodLabel: string, content: WeeklyContent): (string | number)[][] {
  const safeBudget = content.budget ?? {
    operator_gov: { budget: '', executed: '' },
    operator_self: { budget: '', executed: '' },
  }
  const opGov  = calcBudgetRow(safeBudget.operator_gov)
  const opSelf = calcBudgetRow(safeBudget.operator_self)
  const total  = calcBudgetSubtotal(safeBudget.operator_gov, safeBudget.operator_self)

  const rows: (string | number)[][] = []

  rows.push(['주간 실적보고서'])
  rows.push([periodLabel])
  rows.push(['기관명', org])
  rows.push([])

  rows.push(['1. 수행기관 정보'])
  rows.push(['기관명', content.org_info?.operator ?? org])
  rows.push([])

  rows.push(['2. 성과지표 달성 현황'])
  rows.push(['지표명', '연간목표(A)', '누적실적(B)', '달성률(B/A)', '비고'])
  KPI_LABELS.forEach((label, i) => {
    const row = content.kpi_rows?.[i] ?? { target: '', actual: '' }
    rows.push([
      label,
      fmtNum(row.target) || '—',
      fmtNum(row.actual) || '—',
      calcRate(row.target, row.actual),
      (row as { note?: string }).note || '',
    ])
  })
  rows.push([])

  rows.push(['3. 주간 실적 및 계획'])
  rows.push(['구분', '이번주 실적', '다음주 계획', '비고'])
  ACTIVITY_LABELS.forEach((label, i) => {
    const row = content.activity_rows?.[i] ?? { current_week: '', next_week: '', note: '' }
    rows.push([label, row.current_week || '—', row.next_week || '—', row.note || '—'])
  })
  rows.push([])

  rows.push(['4. 예산 집행현황'])
  rows.push(['구분', '예산', '집행액', '집행잔액', '집행률'])
  rows.push([
    '국고보조금',
    fmtNum(safeBudget.operator_gov.budget) || '—',
    fmtNum(safeBudget.operator_gov.executed) || '—',
    opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—',
    opGov.rate,
  ])
  rows.push([
    '자기부담금',
    fmtNum(safeBudget.operator_self.budget) || '—',
    fmtNum(safeBudget.operator_self.executed) || '—',
    opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—',
    opSelf.rate,
  ])
  rows.push([
    '합계',
    total.budget ? total.budget.toLocaleString('ko-KR') : '—',
    total.executed ? total.executed.toLocaleString('ko-KR') : '—',
    total.budget ? total.remaining.toLocaleString('ko-KR') : '—',
    total.rate,
  ])
  if (content.budget_plan) {
    rows.push([])
    rows.push(['향후예산 활용계획', content.budget_plan])
  }

  return rows
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
  const periodLabel = summary.period_label as string

  // 제출된 기관의 report_id 수집
  const reportIds = snapshot.org_statuses
    .filter((o) => o.report_id !== null)
    .map((o) => o.report_id as string)

  // 실제 보고서 전체 내용 조회 (예산 등 포함)
  const { data: reports } = reportIds.length > 0
    ? await admin
        .from('reports')
        .select('id, organization, content')
        .in('id', reportIds)
    : { data: [] }

  const reportMap = new Map<string, WeeklyContent>()
  for (const r of (reports ?? [])) {
    reportMap.set(r.id, r.content as WeeklyContent)
  }

  const wb = XLSX.utils.book_new()

  // ── 시트 1: 전체 요약 ──
  const summaryRows: (string | number)[][] = [
    [`${periodLabel} 기관별 실적 요약`],
    [],
    ['기관명', '제출상태', ...KPI_LABELS.map((l) => l)],
    ...snapshot.org_statuses.map((o) => [
      o.org,
      o.display_status,
      ...KPI_LABELS.map((_, i) => {
        const row = o.kpi_rows?.[i]
        return row ? `${fmtNum(row.actual) || '—'} / ${fmtNum(row.target) || '—'}` : '—'
      }),
    ]),
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet['!cols'] = [{ wch: 18 }, { wch: 8 }, ...KPI_LABELS.map(() => ({ wch: 22 }))]
  XLSX.utils.book_append_sheet(wb, summarySheet, '전체요약')

  // ── 기관별 시트 ──
  for (const o of snapshot.org_statuses) {
    if (!o.report_id) continue
    const content = reportMap.get(o.report_id)
    if (!content) continue

    const rows = buildOrgSheet(o.org, periodLabel, content)
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 14 }]

    // Excel 시트명: 최대 31자, 특수문자 제거
    const sheetName = o.org.replace(/[/\\?*[\]:]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const buf = Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
  const safeName = periodLabel.replace(/[/\\:*?"<>|]/g, '_')

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '_전체기관리포트')}.xlsx`,
    },
  })
}
