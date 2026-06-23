import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx'
import type { WeeklySummaryData } from '@/lib/weeklySummary'
import { KPI_LABELS } from '@/lib/weeklySummary'

// ── AI 보고서 타입 ─────────────────────────────────────────────────────────────

interface AiInstitutionDetail {
  organization: string
  kpi_status: string
  current_week: string
  next_week: string
}

interface AiIssue {
  issue: string
  organizations: string
  assessment: string
  action: string
}

interface AiReportData {
  key_message?: string
  overall_assessment?: string
  institution_details?: AiInstitutionDetail[]
  issues?: AiIssue[]
  next_week_checklist?: Array<{ no: number; item: string; content: string; target: string }>
}

// ── 인증 ──────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

// ── 셀 빌더 헬퍼 ──────────────────────────────────────────────────────────────

function headerCell(text: string, widthPct?: number): TableCell {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
    borders: cellBorder(),
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 18, color: '374151' })],
      }),
    ],
  })
}

function dataCell(text: string, opts?: { bold?: boolean; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType]; shade?: string; size?: number }): TableCell {
  return new TableCell({
    shading: opts?.shade ? { type: ShadingType.SOLID, color: opts.shade } : undefined,
    borders: cellBorder(),
    children: [
      new Paragraph({
        alignment: opts?.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            size: opts?.size ?? 18,
            color: opts?.color ?? '111827',
          }),
        ],
      }),
    ],
  })
}

function multiLineCell(lines: { text: string; color?: string; bold?: boolean }[], shade?: string): TableCell {
  return new TableCell({
    shading: shade ? { type: ShadingType.SOLID, color: shade } : undefined,
    borders: cellBorder(),
    children: lines.map(
      (l) =>
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: l.text, size: 16, color: l.color ?? '111827', bold: l.bold })],
        })
    ),
  })
}

function cellBorder() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }
  return { top: b, bottom: b, left: b, right: b }
}

function issueCellBorder() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' }
  return { top: b, bottom: b, left: b, right: b }
}

function sectionHeading(num: number | string, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 22, color: '1F2937' }),
      new TextRun({ text: title, bold: true, size: 22, color: '1F2937' }),
    ],
  })
}

// ── Excel 생성 ────────────────────────────────────────────────────────────────

function buildXlsx(
  snapshot: WeeklySummaryData,
  confirmedAt: string | null,
  periodLabel: string,
  aiReport: AiReportData | null
): Buffer {
  const wb = XLSX.utils.book_new()
  const confirmedStr = confirmedAt ? new Date(confirmedAt).toLocaleDateString('ko-KR') : '-'

  // ── 1. 핵심 성과 지표 (Headline KPI) ──
  const headlineHeader = ['지표명', '영문', '실적', '목표', '달성률(%)', '달성 상태']
  const headlineRows = (snapshot.headline_kpis ?? []).map((k) => [
    k.label, k.labelEn,
    k.actual % 1 === 0 ? k.actual : Number(k.actual.toFixed(1)),
    k.target,
    Number(k.rate.toFixed(1)),
    k.tagline,
  ])
  const headlineSheet = XLSX.utils.aoa_to_sheet([
    [`${periodLabel} 핵심 성과 지표`],
    [`확정일: ${confirmedStr}`],
    [],
    headlineHeader,
    ...headlineRows,
  ])
  headlineSheet['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, headlineSheet, '핵심 KPI')

  // ── 2. KPI 요약 ──
  const kpiHeader = ['지표명', '목표 합계', '누적 실적', '달성률']
  const kpiRows = (snapshot.kpi_totals ?? []).map((k) => [k.label, k.target, k.actual, k.rate])
  const kpiSheet = XLSX.utils.aoa_to_sheet([
    [`${periodLabel} 주간 실적 요약`],
    [`확정일: ${confirmedStr}`],
    [],
    kpiHeader,
    ...kpiRows,
  ])
  kpiSheet['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, kpiSheet, 'KPI 요약')

  // ── 3. 기관별 현황 ──
  const orgHeader = ['기관명', '제출 상태', ...KPI_LABELS, '이번 주 실적', '다음 주 계획']
  const orgRows = (snapshot.org_statuses ?? []).map((o) => [
    o.org,
    o.display_status,
    ...(KPI_LABELS.map((_, i) => {
      const row = o.kpi_rows?.[i]
      return row ? `목표: ${row.target} / 실적: ${row.actual}` : '-'
    })),
    o.tagline || '-',
    o.next_week || '-',
  ])
  const orgSheet = XLSX.utils.aoa_to_sheet([
    [`${periodLabel} 운영기관별 세부 현황`],
    [],
    orgHeader,
    ...orgRows,
  ])
  orgSheet['!cols'] = [
    { wch: 16 }, { wch: 8 },
    ...KPI_LABELS.map(() => ({ wch: 22 })),
    { wch: 30 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, orgSheet, '기관별 현황')

  // ── 4. 예산 집행 ──
  if (snapshot.budget?.total_budget > 0 || (snapshot.budget?.org_executions?.length ?? 0) > 0) {
    const budgetRows: (string | number)[][] = [
      [`${periodLabel} 예산 집행 현황`], [],
      ['구분', '금액(원)'],
      ['총 예산(보조금)', snapshot.budget.total_budget],
      ['총 집행액', snapshot.budget.total_executed],
      ['집행률', snapshot.budget.execution_rate],
      [], ['기관명', '집행액(원)'],
      ...(snapshot.budget.org_executions ?? []).map((e) => [e.org, e.executed]),
    ]
    const budgetSheet = XLSX.utils.aoa_to_sheet(budgetRows)
    budgetSheet['!cols'] = [{ wch: 20 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, budgetSheet, '예산 집행')
  }

  // ── 5. AI 분석 ──
  if (aiReport) {
    const aiRows: (string | number)[][] = [
      [`${periodLabel} AI 분석 보고서`], [],
    ]

    if (aiReport.key_message) {
      aiRows.push(['[ 핵심 메시지 ]'], [aiReport.key_message], [])
    }

    if (aiReport.institution_details && aiReport.institution_details.length > 0) {
      aiRows.push(['[ 기관별 핵심 동향 ]'], ['기관명', 'KPI 현황', '이번 주 주요 활동', '다음 주 계획'])
      for (const d of aiReport.institution_details) {
        aiRows.push([d.organization, d.kpi_status, d.current_week, d.next_week])
      }
      aiRows.push([])
    }

    if (aiReport.issues && aiReport.issues.length > 0) {
      aiRows.push(['[ 향후 운영 준비사항 ]'], ['이슈', '해당 기관', '평가', '조치 방안'])
      for (const issue of aiReport.issues) {
        aiRows.push([issue.issue, issue.organizations, issue.assessment, issue.action])
      }
      aiRows.push([])
    }

    if (aiReport.next_week_checklist && aiReport.next_week_checklist.length > 0) {
      aiRows.push(['[ 다음 주 체크리스트 ]'], ['No', '항목', '세부 내용', '담당/대상'])
      for (const c of aiReport.next_week_checklist) {
        aiRows.push([c.no, c.item, c.content, c.target])
      }
    }

    const aiSheet = XLSX.utils.aoa_to_sheet(aiRows)
    aiSheet['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 40 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, aiSheet, 'AI 분석')
  }

  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}

// ── Word 생성 ─────────────────────────────────────────────────────────────────

async function buildDocx(
  snapshot: WeeklySummaryData,
  confirmedAt: string | null,
  periodLabel: string,
  aiReport: AiReportData | null
): Promise<Buffer> {
  const confirmedStr = confirmedAt
    ? new Date(confirmedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── 핵심 성과 지표 (Headline KPI) 테이블 ──
  const headlineTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('지표', 30),
          headerCell('실적', 17),
          headerCell('목표', 17),
          headerCell('달성률', 18),
          headerCell('상태', 18),
        ],
      }),
      ...(snapshot.headline_kpis ?? []).map((k, i) => {
        const shade = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'
        const rateColor = k.rate >= 100 ? '059669' : '2563EB'
        const actualStr = k.actual % 1 === 0 ? k.actual.toLocaleString() : k.actual.toFixed(1)
        const targetStr = k.target % 1 === 0 ? k.target.toLocaleString() : k.target.toFixed(1)
        return new TableRow({
          children: [
            dataCell(k.label, { shade }),
            dataCell(`${actualStr}${k.unit}`, { align: AlignmentType.RIGHT, bold: true, shade }),
            dataCell(`${targetStr}${k.unit}`, { align: AlignmentType.RIGHT, shade }),
            dataCell(`${k.rate.toFixed(1)}%`, { align: AlignmentType.CENTER, bold: true, color: rateColor, shade }),
            dataCell(k.tagline, { shade }),
          ],
        })
      }),
    ],
  })

  // ── KPI 테이블 ──
  const kpiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('지표명', 32),
          headerCell('연간 목표', 20),
          headerCell('누적 실적', 20),
          headerCell('달성률', 14),
        ],
      }),
      ...(snapshot.kpi_totals ?? []).map((k, i) => {
        const rate = parseFloat(k.rate) || 0
        const rateColor = rate >= 100 ? '059669' : '2563EB'
        const shade = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'
        return new TableRow({
          children: [
            dataCell(k.label, { shade }),
            dataCell(k.target.toLocaleString(), { align: AlignmentType.RIGHT, shade }),
            dataCell(k.actual.toLocaleString(), { align: AlignmentType.RIGHT, bold: true, shade }),
            dataCell(k.rate, { align: AlignmentType.CENTER, bold: true, color: rateColor, shade }),
          ],
        })
      }),
    ],
  })

  // ── 기관별 현황 테이블 ──
  const kpiShorts = ['과정수', '수료(명)', '수료율', '만족도', '지역확산', '홍보(건)']
  const orgTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('기관명', 16),
          headerCell('상태', 7),
          ...kpiShorts.map((l) => headerCell(l)),
          headerCell('이번 주 실적 / 다음 주 계획'),
        ],
      }),
      ...(snapshot.org_statuses ?? []).map((o, i) => {
        const shade = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'
        const statusColor =
          o.display_status === '승인' ? '059669' :
          o.display_status === '제출' ? '2563EB' : '6B7280'
        const activityLines: { text: string; color?: string; bold?: boolean }[] = []
        if (o.tagline) activityLines.push({ text: o.tagline })
        if (o.next_week) activityLines.push({ text: `→ ${o.next_week}`, color: '2563EB' })
        if (activityLines.length === 0) activityLines.push({ text: '미제출', color: '9CA3AF' })
        return new TableRow({
          children: [
            dataCell(o.org, { shade }),
            dataCell(o.display_status, { align: AlignmentType.CENTER, color: statusColor, shade }),
            ...KPI_LABELS.map((_, ki) =>
              dataCell(o.kpi_rows?.[ki]?.actual || '—', { align: AlignmentType.CENTER, shade })
            ),
            multiLineCell(activityLines, shade),
          ],
        })
      }),
    ],
  })

  // ── 예산 테이블 ──
  const budgetChildren: (Paragraph | Table)[] = []
  if (snapshot.budget?.total_budget > 0) {
    budgetChildren.push(sectionHeading(3, '예산 집행 현황'))
    const budgetRows = [
      ['총 사업 예산(보조금)', snapshot.budget.total_budget.toLocaleString() + '원'],
      ['누적 집행액', snapshot.budget.total_executed.toLocaleString() + '원'],
      ['집행률', snapshot.budget.execution_rate],
    ]
    budgetChildren.push(
      new Table({
        width: { size: 50, type: WidthType.PERCENTAGE },
        rows: budgetRows.map(([label, val]) =>
          new TableRow({
            children: [
              dataCell(label, { shade: 'F1F5F9', bold: true }),
              dataCell(val, { align: AlignmentType.RIGHT }),
            ],
          })
        ),
      })
    )

    if ((snapshot.budget.org_executions?.length ?? 0) > 0) {
      budgetChildren.push(
        new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: '기관별 집행 내역', bold: true, size: 18, color: '374151' })] }),
        new Table({
          width: { size: 60, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [headerCell('기관명', 50), headerCell('집행액(원)', 50)],
            }),
            ...(snapshot.budget.org_executions ?? []).map((e, i) =>
              new TableRow({
                children: [
                  dataCell(e.org, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
                  dataCell(e.executed.toLocaleString() + '원', {
                    align: AlignmentType.RIGHT,
                    shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC',
                  }),
                ],
              })
            ),
          ],
        })
      )
    }
  }

  // ── AI 분석 섹션 ──
  const aiChildren: (Paragraph | Table)[] = []

  if (aiReport) {
    if (aiReport.key_message) {
      aiChildren.push(
        sectionHeading(4, 'AI 분석 핵심 메시지'),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: aiReport.key_message.split(/\n\n|\n(?=[A-Z가-힣])/)[0].trim(),
              size: 18,
              color: '065F46',
            }),
          ],
        })
      )
    }

    if (aiReport.institution_details && aiReport.institution_details.length > 0) {
      aiChildren.push(sectionHeading('4-1', '기관별 핵심 동향'))
      aiChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('기관명', 16),
                headerCell('KPI 현황', 22),
                headerCell('이번 주 주요 활동', 32),
                headerCell('다음 주 계획', 30),
              ],
            }),
            ...aiReport.institution_details.map((d, i) => {
              const shade = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'
              return new TableRow({
                children: [
                  dataCell(d.organization, { shade, bold: true, size: 16 }),
                  dataCell(d.kpi_status, { shade, size: 16 }),
                  dataCell(d.current_week, { shade, size: 16 }),
                  dataCell(d.next_week, { shade, size: 16, color: '2563EB' }),
                ],
              })
            }),
          ],
        })
      )
    }

    if (aiReport.issues && aiReport.issues.length > 0) {
      aiChildren.push(sectionHeading('4-2', '향후 운영 준비사항'))
      const issueBorder = { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' }
      const issueBorderObj = { top: issueBorder, bottom: issueBorder, left: issueBorder, right: issueBorder }
      aiChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({
                  width: { size: 22, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.SOLID, color: 'FEF3C7' },
                  borders: issueCellBorder(),
                  children: [new Paragraph({ children: [new TextRun({ text: '이슈', bold: true, size: 18, color: 'B45309' })] })],
                }),
                new TableCell({
                  width: { size: 15, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.SOLID, color: 'FEF3C7' },
                  borders: issueCellBorder(),
                  children: [new Paragraph({ children: [new TextRun({ text: '해당 기관', bold: true, size: 18, color: 'B45309' })] })],
                }),
                new TableCell({
                  shading: { type: ShadingType.SOLID, color: 'FEF3C7' },
                  borders: issueCellBorder(),
                  children: [new Paragraph({ children: [new TextRun({ text: '평가 및 조치 방안', bold: true, size: 18, color: 'B45309' })] })],
                }),
              ],
            }),
            ...aiReport.issues.map((issue, i) => {
              const shade = i % 2 === 0 ? 'FFFFFF' : 'FFFBEB'
              return new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.SOLID, color: shade },
                    borders: issueCellBorder(),
                    children: [new Paragraph({ children: [new TextRun({ text: issue.issue, bold: true, size: 18, color: '111827' })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.SOLID, color: shade },
                    borders: issueCellBorder(),
                    children: [new Paragraph({ children: [new TextRun({ text: issue.organizations, size: 18, color: '374151' })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.SOLID, color: shade },
                    borders: issueCellBorder(),
                    children: [
                      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: issue.assessment, size: 18, color: '374151' })] }),
                      new Paragraph({ children: [new TextRun({ text: `→ ${issue.action}`, size: 18, color: '2563EB' })] }),
                    ],
                  }),
                ],
              })
            }),
          ],
        })
      )
    }

    if (aiReport.next_week_checklist && aiReport.next_week_checklist.length > 0) {
      aiChildren.push(sectionHeading('4-3', '다음 주 체크리스트'))
      aiChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('No', 6),
                headerCell('항목', 18),
                headerCell('세부 내용', 52),
                headerCell('담당/대상', 24),
              ],
            }),
            ...aiReport.next_week_checklist.map((c, i) => {
              const shade = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'
              return new TableRow({
                children: [
                  dataCell(String(c.no), { align: AlignmentType.CENTER, shade }),
                  dataCell(c.item, { shade, bold: true }),
                  dataCell(c.content, { shade }),
                  dataCell(c.target, { shade }),
                ],
              })
            }),
          ],
        })
      )
    }
  }

  // ── 문서 조립 ──
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: '맑은 고딕' } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children: [
          // 제목
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `${periodLabel} 주간 실적 요약`, bold: true, size: 32, color: '111827' }),
            ],
          }),
          // 메타
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `기간: ${snapshot.period_start} ~ ${snapshot.period_end}   `, size: 18, color: '6B7280' }),
              new TextRun({ text: `확정일: ${confirmedStr}   `, size: 18, color: '6B7280' }),
              new TextRun({ text: `출력일: ${today}`, size: 18, color: '6B7280' }),
            ],
          }),
          // 제출 현황
          new Paragraph({
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: `제출 현황: 전체 ${snapshot.org_statuses.length}개 기관 중 ${snapshot.submitted_count}개 제출 · ${snapshot.approved_count}개 승인`,
                size: 18, color: '374151',
              }),
            ],
          }),

          // ● 핵심 성과 지표
          sectionHeading('●', '핵심 성과 지표'),
          headlineTable,

          // 1. KPI
          sectionHeading(1, '핵심 성과 지표(KPI) 달성 현황'),
          kpiTable,

          // 2. 기관별
          sectionHeading(2, '운영기관별 제출 현황'),
          orgTable,

          // 3. 예산
          ...budgetChildren,

          // 4. AI
          ...aiChildren,

          // 하단 구분
          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({ text: '의료AI 사업관리시스템 — 내부 자료', size: 16, color: '9CA3AF' }),
            ],
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}

// ── 라우트 핸들러 ─────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
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
  const safeName = periodLabel.replace(/[/\\:*?"<>|]/g, '_')

  // AI 보고서 조회
  const { data: aiRow } = await admin
    .from('ai_analysis_reports')
    .select('result')
    .eq('start_date', snapshot.period_start)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const aiReport = (aiRow?.result as AiReportData) ?? null

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'xlsx'

  if (format === 'docx') {
    const docxBuf = await buildDocx(snapshot, summary.confirmed_at, periodLabel, aiReport)
    return new Response(new Uint8Array(docxBuf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '_주간실적요약')}.docx`,
      },
    })
  }

  // 기본: Excel
  const xlsxBuf = buildXlsx(snapshot, summary.confirmed_at, periodLabel, aiReport)
  return new Response(new Uint8Array(xlsxBuf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '_주간실적요약')}.xlsx`,
    },
  })
}
