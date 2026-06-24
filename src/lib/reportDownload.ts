import ExcelJS from 'exceljs'
import {
  WeeklyContent,
  KPI_LABELS, ACTIVITY_LABELS,
  calcRate, calcBudgetRow, calcBudgetSubtotal, fmtNum,
} from '@/app/(app)/reports/report-types'

export interface ReportDownloadData {
  type: string
  period_label: string
  content: WeeklyContent
  organization: string
}

// ─────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────

export async function downloadReportExcel(report: ReportDownloadData) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('주간보고서')
  ;[22, 28, 28, 18, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  const rows = buildWeeklyRows(report)
  for (const row of rows) ws.addRow(row)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = report.period_label.replace(/[/\\:*?"<>|]/g, '_')
  a.download = `${report.organization}_${safe}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildWeeklyRows(report: ReportDownloadData): (string | number)[][] {
  const wc = report.content
  const safeBudget = wc.budget ?? {
    operator_gov: { budget: '', executed: '' },
    operator_self: { budget: '', executed: '' },
  }
  const opGov  = calcBudgetRow(safeBudget.operator_gov)
  const opSelf = calcBudgetRow(safeBudget.operator_self)
  const total  = calcBudgetSubtotal(safeBudget.operator_gov, safeBudget.operator_self)

  const rows: (string | number)[][] = []

  rows.push(['주간 실적보고서'])
  rows.push([report.period_label])
  rows.push(['기관명', report.organization])
  rows.push([])

  rows.push(['1. 수행기관 정보'])
  rows.push(['기관명', wc.org_info.operator])
  rows.push([])

  rows.push(['2. 성과지표 달성 현황'])
  rows.push(['지표명', '연간목표(A)', '누적실적(B)', '달성률(B/A)', '비고'])
  KPI_LABELS.forEach((label, i) => {
    const row = wc.kpi_rows[i] ?? { target: '', actual: '' }
    rows.push([label, fmtNum(row.target) || '—', fmtNum(row.actual) || '—', calcRate(row.target, row.actual), (row as { note?: string }).note || ''])
  })
  rows.push([])

  rows.push(['3. 주간 실적 및 계획'])
  rows.push(['구분', '이번주 실적', '다음주 계획', '비고'])
  ACTIVITY_LABELS.forEach((label, i) => {
    const row = wc.activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
    rows.push([label, row.current_week || '—', row.next_week || '—', row.note || '—'])
  })
  rows.push([])

  rows.push(['4. 예산 집행현황'])
  rows.push(['구분', '예산', '집행액', '집행잔액', '집행률'])
  rows.push(['국고보조금',
    fmtNum(safeBudget.operator_gov.budget) || '—',
    fmtNum(safeBudget.operator_gov.executed) || '—',
    opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—',
    opGov.rate,
  ])
  rows.push(['자기부담금',
    fmtNum(safeBudget.operator_self.budget) || '—',
    fmtNum(safeBudget.operator_self.executed) || '—',
    opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—',
    opSelf.rate,
  ])
  rows.push(['합계',
    total.budget ? total.budget.toLocaleString('ko-KR') : '—',
    total.executed ? total.executed.toLocaleString('ko-KR') : '—',
    total.budget ? total.remaining.toLocaleString('ko-KR') : '—',
    total.rate,
  ])
  if (wc.budget_plan) {
    rows.push([])
    rows.push(['향후예산 활용계획', wc.budget_plan])
  }

  return rows
}

// ─────────────────────────────────────────────────
// PDF (새 창 + 자동 인쇄 → 브라우저 PDF 저장)
// ─────────────────────────────────────────────────

export function printReportPdf(report: ReportDownloadData) {
  const html = buildWeeklyHtml(report)
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// ── 공통 CSS ──
const PRINT_CSS = `
  @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 10pt; color: #111; }
  h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 10pt; color: #444; margin-bottom: 12px; }
  .meta { font-size: 9pt; color: #555; margin-bottom: 10px; }
  h2 { font-size: 10pt; font-weight: bold; border-bottom: 1.5px solid #333; padding-bottom: 2px; margin: 14px 0 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
  th, td { border: 1px solid #555; padding: 4px 6px; }
  th { background: #e8e8e8; font-weight: bold; text-align: center; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .pre { white-space: pre-wrap; vertical-align: top; min-height: 40px; }
  .plan-box { border: 1px solid #555; padding: 6px 8px; font-size: 9pt; white-space: pre-wrap; margin-bottom: 6px; }
  .plan-label { font-size: 9pt; font-weight: bold; color: #333; margin-bottom: 3px; }
`

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style><script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></head><body>${body}</body></html>`
}

function buildWeeklyHtml(report: ReportDownloadData): string {
  const wc = report.content
  const safeBudget = wc.budget ?? {
    operator_gov: { budget: '', executed: '' },
    operator_self: { budget: '', executed: '' },
  }
  const opGov  = calcBudgetRow(safeBudget.operator_gov)
  const opSelf = calcBudgetRow(safeBudget.operator_self)
  const total  = calcBudgetSubtotal(safeBudget.operator_gov, safeBudget.operator_self)

  const kpiRows = KPI_LABELS.map((label, i) => {
    const row = wc.kpi_rows[i] ?? { target: '', actual: '' }
    const note = (row as { note?: string }).note || ''
    return `<tr>
      <td>${label}</td>
      <td class="text-center">${fmtNum(row.target) || '—'}</td>
      <td class="text-center">${fmtNum(row.actual) || '—'}</td>
      <td class="text-center">${calcRate(row.target, row.actual)}</td>
      <td>${esc(note)}</td>
    </tr>`
  }).join('')

  const actRows = ACTIVITY_LABELS.map((label, i) => {
    const row = wc.activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
    return `<tr>
      <th>${label}</th>
      <td class="pre">${esc(row.current_week) || '—'}</td>
      <td class="pre">${esc(row.next_week) || '—'}</td>
      <td class="pre">${esc(row.note) || '—'}</td>
    </tr>`
  }).join('')

  const body = `
    <h1>주간 실적보고서</h1>
    <p class="subtitle">${esc(report.period_label)}</p>
    <p class="meta">기관명: ${esc(report.organization)}</p>

    <h2>1. 수행기관 정보</h2>
    <table><tbody><tr><th style="width:120px">기관명</th><td>${esc(wc.org_info.operator)}</td></tr></tbody></table>

    <h2>2. 성과지표 달성 현황</h2>
    <table>
      <thead><tr><th style="width:130px">지표명</th><th>연간목표(A)</th><th>누적실적(B)</th><th>달성률(B/A)</th><th style="width:100px">비고</th></tr></thead>
      <tbody>${kpiRows}</tbody>
    </table>

    <h2>3. 주간 실적 및 계획</h2>
    <table>
      <thead><tr><th style="width:80px">구분</th><th>이번주 실적</th><th>다음주 계획</th><th style="width:90px">비고</th></tr></thead>
      <tbody>${actRows}</tbody>
    </table>

    <h2>4. 예산 집행현황</h2>
    <table>
      <thead><tr><th style="width:100px">구분</th><th>예산</th><th>집행액</th><th>집행잔액</th><th style="width:60px">집행률</th></tr></thead>
      <tbody>
        <tr>
          <th>국고보조금</th>
          <td class="text-right">${fmtNum(safeBudget.operator_gov.budget) || '—'}</td>
          <td class="text-right">${fmtNum(safeBudget.operator_gov.executed) || '—'}</td>
          <td class="text-right">${opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-center">${opGov.rate}</td>
        </tr>
        <tr>
          <th>자기부담금</th>
          <td class="text-right">${fmtNum(safeBudget.operator_self.budget) || '—'}</td>
          <td class="text-right">${fmtNum(safeBudget.operator_self.executed) || '—'}</td>
          <td class="text-right">${opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-center">${opSelf.rate}</td>
        </tr>
        <tr>
          <th>합계</th>
          <td class="text-right">${total.budget ? total.budget.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-right">${total.executed ? total.executed.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-right">${total.budget ? total.remaining.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-center">${total.rate}</td>
        </tr>
      </tbody>
    </table>
    ${wc.budget_plan ? `<div class="plan-label">향후예산 활용계획</div><div class="plan-box">${esc(wc.budget_plan)}</div>` : ''}
  `
  return wrapHtml('주간 실적보고서', body)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
