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

function dataCell(text: string, opts?: { bold?: boolean; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType]; shade?: string }): TableCell {
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
            size: 18,
            color: opts?.color ?? '111827',
          }),
        ],
      }),
    ],
  })
}

function cellBorder() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }
  return { top: b, bottom: b, left: b, right: b }
}

function sectionHeading(num: number, title: string): Paragraph {
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

function buildXlsx(snapshot: WeeklySummaryData, confirmedAt: string | null, periodLabel: string): Buffer {
  const wb = XLSX.utils.book_new()

  const kpiHeader = ['지표명', '목표 합계', '누적 실적', '달성률']
  const kpiRows = (snapshot.kpi_totals ?? []).map((k) => [k.label, k.target, k.actual, k.rate])
  const kpiSheet = XLSX.utils.aoa_to_sheet([
    [`${periodLabel} 주간 실적 요약`],
    [`확정일: ${confirmedAt ? new Date(confirmedAt).toLocaleDateString('ko-KR') : '-'}`],
    [],
    kpiHeader,
    ...kpiRows,
  ])
  kpiSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, kpiSheet, 'KPI 요약')

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
    [`${periodLabel} 운영기관별 세부 현황`],
    [],
    orgHeader,
    ...orgRows,
  ])
  orgSheet['!cols'] = [{ wch: 16 }, { wch: 8 }, ...KPI_LABELS.map(() => ({ wch: 22 }))]
  XLSX.utils.book_append_sheet(wb, orgSheet, '기관별 현황')

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

  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}

// ── Word 생성 ─────────────────────────────────────────────────────────────────

async function buildDocx(snapshot: WeeklySummaryData, confirmedAt: string | null, periodLabel: string): Promise<Buffer> {
  const confirmedStr = confirmedAt
    ? new Date(confirmedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── KPI 테이블 ──
  const kpiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('지표명', 30),
          headerCell('연간 목표', 20),
          headerCell('누적 실적', 20),
          headerCell('달성률', 15),
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
          headerCell('기관명', 18),
          headerCell('상태', 8),
          ...kpiShorts.map((l) => headerCell(l)),
          headerCell('주요 활동'),
        ],
      }),
      ...(snapshot.org_statuses ?? []).map((o, i) => {
        const shade = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'
        const statusColor =
          o.display_status === '승인' ? '059669' :
          o.display_status === '제출' ? '2563EB' : '6B7280'
        return new TableRow({
          children: [
            dataCell(o.org, { shade }),
            dataCell(o.display_status, { align: AlignmentType.CENTER, color: statusColor, shade }),
            ...KPI_LABELS.map((_, ki) =>
              dataCell(o.kpi_rows?.[ki]?.actual || '—', { align: AlignmentType.CENTER, shade })
            ),
            dataCell(o.tagline || '미제출', { color: o.tagline ? '111827' : '9CA3AF', shade }),
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

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: '맑은 고딕' },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // 20mm
          },
        },
        children: [
          // 제목
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `${periodLabel} 주간 실적 요약`,
                bold: true,
                size: 32,
                color: '111827',
              }),
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
          // 제출 현황 요약
          new Paragraph({
            spacing: { after: 280 },
            children: [
              new TextRun({
                text: `제출 현황: 전체 ${snapshot.org_statuses.length}개 기관 중 ${snapshot.submitted_count}개 제출 · ${snapshot.approved_count}개 승인`,
                size: 18, color: '374151',
              }),
            ],
          }),

          // 1. KPI
          sectionHeading(1, '핵심 성과 지표(KPI) 달성 현황'),
          kpiTable,

          // 2. 기관별
          sectionHeading(2, '운영기관별 제출 현황'),
          orgTable,

          // 3. 예산
          ...budgetChildren,

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

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'xlsx'

  if (format === 'docx') {
    const docxBuf = await buildDocx(snapshot, summary.confirmed_at, periodLabel)
    return new Response(new Uint8Array(docxBuf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '_주간실적요약')}.docx`,
      },
    })
  }

  // 기본: Excel
  const xlsxBuf = buildXlsx(snapshot, summary.confirmed_at, periodLabel)
  return new Response(new Uint8Array(xlsxBuf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '_주간실적요약')}.xlsx`,
    },
  })
}
