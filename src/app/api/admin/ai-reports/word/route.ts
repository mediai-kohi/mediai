import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'  // for error responses
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx'

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface DashboardItem { category: string; content: string }
interface KeySummaryItem { no: number; keyword: string; content: string }
interface InstitutionProgress { organization: string; stage: string; current_week: string; next_week: string; status: string }
interface QuantitativeItem { indicator: string; organizations: string; content: string; management_point: string }
interface IssueItem { issue: string; organizations: string; assessment: string; action: string }
interface ChecklistItem { no: number; item: string; content: string; target: string }
interface InstitutionDetail { organization: string; kpi_status: string; current_week: string; next_week: string }

interface BudgetOrgRow { organization: string; total_budget: string; total_executed: string; execution_rate: string; assessment: string }
interface BudgetAnalysis { summary: string; org_rows: BudgetOrgRow[]; management_point: string }

interface SummaryResult {
  overall_assessment: string
  dashboard: DashboardItem[]
  key_summary: KeySummaryItem[]
  institution_progress: InstitutionProgress[]
  quantitative_summary: QuantitativeItem[]
  issues: IssueItem[]
  next_week_checklist: ChecklistItem[]
  key_message: string
  institution_details: InstitutionDetail[]
  budget_analysis?: BudgetAnalysis
}

// ── 셀 헬퍼 ──────────────────────────────────────────────────────────────────

const B = { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' }
const BORDER = { top: B, bottom: B, left: B, right: B }
const ISSUE_B = { style: BorderStyle.SINGLE, size: 4, color: 'FDE68A' }
const ISSUE_BORDER = { top: ISSUE_B, bottom: ISSUE_B, left: ISSUE_B, right: ISSUE_B }

function hCell(text: string, w?: number): TableCell {
  return new TableCell({
    width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
    shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
    borders: BORDER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 18, color: '374151' })],
    })],
  })
}

function dCell(text: string, opts?: { bold?: boolean; color?: string; align?: typeof AlignmentType[keyof typeof AlignmentType]; shade?: string; isIssue?: boolean }): TableCell {
  return new TableCell({
    shading: opts?.shade ? { type: ShadingType.SOLID, color: opts.shade } : undefined,
    borders: opts?.isIssue ? ISSUE_BORDER : BORDER,
    children: [new Paragraph({
      alignment: opts?.align ?? AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [new TextRun({ text, bold: opts?.bold, size: 18, color: opts?.color ?? '111827' })],
    })],
  })
}

function mCell(lines: { text: string; bold?: boolean; color?: string }[], shade?: string, isIssue?: boolean): TableCell {
  return new TableCell({
    shading: shade ? { type: ShadingType.SOLID, color: shade } : undefined,
    borders: isIssue ? ISSUE_BORDER : BORDER,
    children: lines.map(l => new Paragraph({
      spacing: { after: 50 },
      children: [new TextRun({ text: l.text, size: 16, bold: l.bold, color: l.color ?? '111827' })],
    })),
  })
}

function secHeading(num: number | string, title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 22, color: '1F2937' }),
      new TextRun({ text: title, bold: true, size: 22, color: '1F2937' }),
    ],
  })
}

// ── 인증 ──────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return true
}

// ── docx 생성 ─────────────────────────────────────────────────────────────────

async function buildSummaryDocx(result: SummaryResult, period: string): Promise<Buffer> {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  // 1. 주간 종합 대시보드
  const dashTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('구분', 22), hCell('주요 현황', 78)] }),
      ...result.dashboard.map((d, i) => new TableRow({
        children: [
          dCell(d.category, { bold: true, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(d.content, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
        ],
      })),
    ],
  })

  // 2. 이번 주 핵심 요약
  const keySummaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('No', 6), hCell('키워드', 14), hCell('핵심 내용', 80)] }),
      ...result.key_summary.map((k, i) => new TableRow({
        children: [
          dCell(String(k.no), { align: AlignmentType.CENTER, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(k.keyword, { bold: true, color: '2563EB', shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(k.content, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
        ],
      })),
    ],
  })

  // 3. 수행기관별 추진현황
  const progressTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('기관', 14), hCell('추진단계', 11), hCell('이번 주 핵심실적', 30), hCell('다음 주 핵심계획', 30), hCell('상태', 10)] }),
      ...result.institution_progress.map((p, i) => new TableRow({
        children: [
          dCell(p.organization, { bold: true, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(p.stage, { align: AlignmentType.CENTER, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(p.current_week, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(p.next_week, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(p.status, { align: AlignmentType.CENTER, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
        ],
      })),
    ],
  })

  // 4. 정량 성과 요약
  const quantTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('지표', 12), hCell('주요 실적 확인 기관', 18), hCell('이번 주 확인 내용', 40), hCell('관리 포인트', 30)] }),
      ...result.quantitative_summary.map((q, i) => new TableRow({
        children: [
          dCell(q.indicator, { bold: true, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(q.organizations, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(q.content, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(q.management_point, { color: '6B7280', shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
        ],
      })),
    ],
  })

  // 5. 예산 집행 현황 분석 (옵션)
  const budgetTable = result.budget_analysis ? new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('기관', 16), hCell('총예산', 18), hCell('집행액', 18), hCell('집행률', 10), hCell('평가', 38)] }),
      ...(result.budget_analysis.org_rows ?? []).map((r, i) => new TableRow({
        children: [
          dCell(r.organization, { bold: true, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(r.total_budget, { align: AlignmentType.RIGHT, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(r.total_executed, { align: AlignmentType.RIGHT, bold: true, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(r.execution_rate, { align: AlignmentType.CENTER, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(r.assessment, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
        ],
      })),
    ],
  }) : null

  // 6. 주요 이슈
  const issueTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('이슈', 16), hCell('관련기관', 14), hCell('판단', 35), hCell('인재원 조치방향', 35)] }),
      ...result.issues.map((iss, i) => {
        const shade = i % 2 === 0 ? 'FFFBEB' : 'FEF9C3'
        return new TableRow({
          children: [
            dCell(iss.issue, { bold: true, shade, isIssue: true }),
            dCell(iss.organizations, { shade, isIssue: true }),
            dCell(iss.assessment, { shade, isIssue: true }),
            dCell(iss.action, { color: '1D4ED8', shade, isIssue: true }),
          ],
        })
      }),
    ],
  })

  // 6. 차주 중점 점검 체크리스트
  const checkTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('순번', 6), hCell('점검항목', 14), hCell('확인내용', 58), hCell('확인대상', 22)] }),
      ...result.next_week_checklist.map((c, i) => new TableRow({
        children: [
          dCell(String(c.no), { align: AlignmentType.CENTER, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(c.item, { bold: true, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(c.content, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(c.target, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
        ],
      })),
    ],
  })

  // 붙임. 기관별 세부 요약
  const detailTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('기관', 14), hCell('성과지표 현황', 22), hCell('이번 주 실적', 32), hCell('차주 계획/비고', 32)] }),
      ...result.institution_details.map((d, i) => new TableRow({
        children: [
          dCell(d.organization, { bold: true, shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          mCell([{ text: d.kpi_status, color: '6B7280' }], i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'),
          dCell(d.current_week, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
          dCell(d.next_week, { shade: i % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }),
        ],
      })),
    ],
  })

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Malgun Gothic', size: 20, color: '111827' } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
        },
      },
      children: [
        // 제목
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 100 },
          children: [new TextRun({ text: '2026년 의료AI 보건의료인 직무교육사업 주간 실적보고', bold: true, size: 28, color: '111827' })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: period, size: 20, color: '6B7280' })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: `작성일: ${today}`, size: 18, color: '9CA3AF' })],
        }),

        // 종합 평가
        new Paragraph({
          spacing: { before: 100, after: 120 },
          shading: { type: ShadingType.SOLID, color: 'FFFBEB' },
          children: [new TextRun({ text: result.overall_assessment, size: 20, color: '374151' })],
        }),

        // 1. 주간 종합 대시보드
        secHeading(1, '주간 종합 대시보드'),
        dashTable,

        // 2. 이번 주 핵심 요약
        secHeading(2, '이번 주 핵심 요약'),
        keySummaryTable,

        // 3. 수행기관별 추진현황
        secHeading(3, '수행기관별 추진현황 비교'),
        progressTable,

        // 4. 정량 성과 요약
        secHeading(4, '정량 성과 요약'),
        quantTable,

        // 5. 예산 집행 현황 분석 (있을 때만)
        ...(budgetTable && result.budget_analysis ? [
          secHeading(5, '예산 집행 현황 분석'),
          new Paragraph({
            spacing: { after: 80 },
            shading: { type: ShadingType.SOLID, color: 'EFF6FF' },
            children: [new TextRun({ text: result.budget_analysis.summary, size: 18, color: '1E40AF' })],
          }),
          budgetTable,
          ...(result.budget_analysis.management_point ? [new Paragraph({
            spacing: { before: 80, after: 60 },
            shading: { type: ShadingType.SOLID, color: 'F0FDF4' },
            children: [new TextRun({ text: result.budget_analysis.management_point, size: 18, color: '166534' })],
          })] : []),
        ] : []),

        // 주요 이슈
        secHeading(budgetTable ? 6 : 5, '주요 이슈 및 조치 필요사항'),
        issueTable,

        // 차주 중점 점검 체크리스트
        secHeading(budgetTable ? 7 : 6, '차주 중점 점검 체크리스트'),
        checkTable,

        // 보고용 핵심 메시지
        secHeading(budgetTable ? 8 : 7, '보고용 핵심 메시지'),
        new Paragraph({
          spacing: { after: 100 },
          shading: { type: ShadingType.SOLID, color: 'FFFBEB' },
          children: [new TextRun({ text: result.key_message, size: 20, color: '374151' })],
        }),

        // 붙임. 기관별 세부 요약
        secHeading('붙임', '기관별 세부 요약'),
        detailTable,
      ],
    }],
  })

  const buf = await Packer.toBuffer(doc)
  return Buffer.from(buf)
}

// ── POST 핸들러 ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { result: SummaryResult; period: string } | null
  if (!body?.result) return NextResponse.json({ error: 'result required' }, { status: 400 })

  const { result, period } = body

  // 배열 크기 제한 — 과도한 항목으로 인한 OOM 방지
  const MAX_ROWS = 100
  if (
    (Array.isArray(result.institution_progress) && result.institution_progress.length > MAX_ROWS) ||
    (Array.isArray(result.institution_details) && result.institution_details.length > MAX_ROWS) ||
    (Array.isArray(result.dashboard) && result.dashboard.length > MAX_ROWS) ||
    (Array.isArray(result.key_summary) && result.key_summary.length > MAX_ROWS) ||
    (Array.isArray(result.issues) && result.issues.length > MAX_ROWS) ||
    (Array.isArray(result.next_week_checklist) && result.next_week_checklist.length > MAX_ROWS)
  ) {
    return NextResponse.json({ error: '데이터 항목이 너무 많습니다.' }, { status: 400 })
  }
  if (typeof period === 'string' && period.length > 200) {
    return NextResponse.json({ error: '잘못된 기간 값입니다.' }, { status: 400 })
  }

  const buf = await buildSummaryDocx(result, period ?? '')
  const filename = encodeURIComponent(`AI분석보고서_${(period ?? '').replace(/[,\s]+/g, '_') || '보고서'}.docx`)

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  })
}
