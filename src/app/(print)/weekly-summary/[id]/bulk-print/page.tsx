import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { buildOverviewTable, sortByOverviewOrgOrder, type WeeklySummaryData } from '@/lib/weeklySummary'
import PrintTrigger from '../print/PrintTrigger'
import PrintButtons from '../print/PrintButtons'
import {
  KPI_LABELS, ACTIVITY_LABELS,
  calcBudgetRow, calcBudgetSubtotal, fmtNum, calcRate,
} from '@/app/(app)/reports/report-types'
import type { WeeklyContent } from '@/app/(app)/reports/report-types'

export default async function BulkPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') redirect('/admin')

  const { data: summary, error } = await admin
    .from('weekly_summaries')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !summary) notFound()

  const snapshot = summary.snapshot as WeeklySummaryData
  const periodLabel = summary.period_label as string

  const reportIds = snapshot.org_statuses
    .filter((o) => o.report_id !== null)
    .map((o) => o.report_id as string)

  const { data: reports } = reportIds.length > 0
    ? await admin.from('reports').select('id, organization, content').in('id', reportIds)
    : { data: [] }

  const reportMap = new Map<string, WeeklyContent>()
  for (const r of (reports ?? [])) {
    reportMap.set(r.id, r.content as WeeklyContent)
  }

  const orgReports = sortByOverviewOrgOrder(
    snapshot.org_statuses
      .filter((o) => o.report_id && reportMap.has(o.report_id))
      .map((o) => ({ org: o.org, content: reportMap.get(o.report_id!)! }))
  )

  if (orgReports.length === 0) notFound()

  const overview = buildOverviewTable(orgReports)

  const TH: React.CSSProperties = {
    background: '#e8e8e8', fontWeight: 700, textAlign: 'center',
    border: '1px solid #555', padding: '4px 6px', fontSize: 9,
  }
  const TD: React.CSSProperties = {
    border: '1px solid #555', padding: '4px 6px', fontSize: 9, verticalAlign: 'top',
  }
  const H2: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, borderBottom: '1.5px solid #333',
    paddingBottom: 2, margin: '14px 0 5px',
  }

  return (
    <>
      <PrintTrigger />
      <style>{`
        @page { size: A4 portrait; margin: 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0;
            font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', Arial, sans-serif !important; }
        body { background: white !important; color: #111 !important; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-after: always; }
          .no-break { page-break-inside: avoid; }
          .no-print { display: none !important; }
          .pre-cell { white-space: pre-wrap; }
        }
        @media screen {
          body { padding: 24px; }
          .page-break { border-bottom: 3px dashed #e5e7eb; margin-bottom: 40px; padding-bottom: 40px; }
        }
      `}</style>

      <PrintButtons />

      {/* 총괄표: 전체 운영기관 합산 */}
      {(() => {
        const overviewTH: React.CSSProperties = { ...TH, fontSize: 8, padding: '3px 4px' }
        const overviewTD: React.CSSProperties = { ...TD, fontSize: 8, padding: '3px 4px' }
        return (
          <div className="page-break">
            <div className="no-break" style={{ textAlign: 'center', marginBottom: 16 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>운영기관별 세부 실적 총괄표</h1>
              <p style={{ fontSize: 10, color: '#444' }}>{periodLabel}</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...overviewTH, width: 44 }}>구분</th>
                  <th style={{ ...overviewTH, width: 62 }}>세부그룹</th>
                  <th style={{ ...overviewTH, width: 78 }}>세부항목</th>
                  <th style={{ ...overviewTH, width: 44 }}>합계</th>
                  {overview.orgs.map((org) => (
                    <th key={org} style={overviewTH}>{org}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.sections.map((sec) => {
                  const sectionRowCount = sec.groups.reduce((sum, g) => sum + g.rows.length, 0)
                  let sectionRowIdx = 0
                  return sec.groups.map((g) =>
                    g.rows.map((r, ri) => {
                      const isFirstOfSection = sectionRowIdx === 0
                      sectionRowIdx++
                      return (
                        <tr key={`${sec.section}-${g.group}-${r.label}`}>
                          {isFirstOfSection && (
                            <th rowSpan={sectionRowCount} style={{ ...overviewTH, textAlign: 'left' }}>{sec.section}</th>
                          )}
                          {ri === 0 && (
                            <th rowSpan={g.rows.length} style={{ ...overviewTH, textAlign: 'left' }}>{g.group}</th>
                          )}
                          <td style={{ ...overviewTD, fontWeight: r.isRate ? 700 : 400, color: r.isRate ? '#1d4ed8' : undefined }}>{r.label}</td>
                          <td style={{ ...overviewTD, textAlign: r.isRate ? 'center' : 'right', fontWeight: 700, color: r.isRate ? '#1d4ed8' : undefined }}>{r.total}</td>
                          {r.values.map((v, vi) => (
                            <td key={vi} style={{ ...overviewTD, textAlign: r.isRate ? 'center' : 'right', color: r.isRate ? '#1d4ed8' : undefined, fontWeight: r.isRate ? 700 : 400 }}>{v}</td>
                          ))}
                        </tr>
                      )
                    })
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {orgReports.map(({ org, content }, idx) => {
        const safeBudget = content.budget ?? {
          operator_gov: { budget: '', executed: '' },
          operator_self: { budget: '', executed: '' },
        }
        const opGov  = calcBudgetRow(safeBudget.operator_gov)
        const opSelf = calcBudgetRow(safeBudget.operator_self)
        const total  = calcBudgetSubtotal(safeBudget.operator_gov, safeBudget.operator_self)

        return (
          <div
            key={idx}
            className={idx < orgReports.length - 1 ? 'page-break' : undefined}
          >
            {/* 제목 */}
            <div className="no-break" style={{ textAlign: 'center', marginBottom: 16 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>주간 실적보고서</h1>
              <p style={{ fontSize: 10, color: '#444' }}>{periodLabel}</p>
            </div>

            {/* 1. 수행기관 정보 */}
            <div className="no-break">
              <h2 style={H2}>1. 수행기관 정보</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
                <tbody>
                  <tr>
                    <th style={{ ...TH, width: 120 }}>기관명</th>
                    <td style={TD}>{content.org_info?.operator ?? org}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. 성과지표 달성 현황 */}
            <div className="no-break">
              <h2 style={H2}>2. 성과지표 달성 현황</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 140 }}>지표명</th>
                    <th style={TH}>연간목표(A)</th>
                    <th style={TH}>누적실적(B)</th>
                    <th style={TH}>달성률(B/A)</th>
                    <th style={{ ...TH, width: 100 }}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI_LABELS.map((label, i) => {
                    const row = content.kpi_rows?.[i] ?? { target: '', actual: '' }
                    const actualSub = (row as { actual_sub?: string }).actual_sub
                    const isManpower = label === '전문인력 양성(명)'
                    const isRegional = label === '지역확산(%)'
                    return (
                      <tr key={label}>
                        <td style={TD}>{label}</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(row.target) || '—'}</td>
                        <td style={{ ...TD, textAlign: isManpower || isRegional ? 'left' : 'right' }}>
                          {isManpower ? (
                            <>
                              <div>수료: {fmtNum(row.actual) || '—'}</div>
                              <div>교육중: {fmtNum(actualSub ?? '') || '—'}</div>
                            </>
                          ) : isRegional ? (
                            <>
                              <div>비중: {row.actual ? `${fmtNum(row.actual)}%` : '—'}</div>
                              <div>지역참여인원: {fmtNum(actualSub ?? '') || '—'}</div>
                            </>
                          ) : (
                            fmtNum(row.actual) || '—'
                          )}
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}>{calcRate(row.target, row.actual)}</td>
                        <td style={TD}>{(row as { note?: string }).note || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 3. 주간 실적 및 계획 */}
            <div className="no-break">
              <h2 style={H2}>3. 주간 실적 및 계획</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 80 }}>구분</th>
                    <th style={TH}>이번주 실적</th>
                    <th style={TH}>다음주 계획</th>
                    <th style={{ ...TH, width: 90 }}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {ACTIVITY_LABELS.map((label, i) => {
                    const row = content.activity_rows?.[i] ?? { current_week: '', next_week: '', note: '' }
                    return (
                      <tr key={label}>
                        <th style={{ ...TH, textAlign: 'left' }}>{label}</th>
                        <td style={{ ...TD, whiteSpace: 'pre-wrap', minHeight: 40 }} className="pre-cell">{row.current_week || '—'}</td>
                        <td style={{ ...TD, whiteSpace: 'pre-wrap', minHeight: 40 }} className="pre-cell">{row.next_week || '—'}</td>
                        <td style={{ ...TD, whiteSpace: 'pre-wrap', minHeight: 40 }} className="pre-cell">{row.note || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 4. 예산 집행현황 */}
            <div className="no-break">
              <h2 style={H2}>4. 예산 집행현황</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 100 }}>구분</th>
                    <th style={TH}>예산</th>
                    <th style={TH}>집행액</th>
                    <th style={TH}>집행잔액</th>
                    <th style={{ ...TH, width: 60 }}>집행률</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th style={TH}>국고보조금</th>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(safeBudget.operator_gov.budget) || '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(safeBudget.operator_gov.executed) || '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—'}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>{opGov.rate}</td>
                  </tr>
                  <tr>
                    <th style={TH}>자기부담금</th>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(safeBudget.operator_self.budget) || '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{fmtNum(safeBudget.operator_self.executed) || '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—'}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>{opSelf.rate}</td>
                  </tr>
                  <tr>
                    <th style={TH}>합계</th>
                    <td style={{ ...TD, textAlign: 'right' }}>{total.budget ? total.budget.toLocaleString('ko-KR') : '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{total.executed ? total.executed.toLocaleString('ko-KR') : '—'}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{total.budget ? total.remaining.toLocaleString('ko-KR') : '—'}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>{total.rate}</td>
                  </tr>
                </tbody>
              </table>

              {content.budget_plan && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#333', marginBottom: 3 }}>향후예산 활용계획</p>
                  <div style={{ border: '1px solid #555', padding: '6px 8px', fontSize: 9, whiteSpace: 'pre-wrap' }}>
                    {content.budget_plan}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
