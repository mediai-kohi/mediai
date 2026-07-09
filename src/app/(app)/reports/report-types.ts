// ─────────────────────────────────────────────────
// 보고서 양식 v2 공유 타입
// ─────────────────────────────────────────────────

export type ReportType = 'weekly'
export type ReportMode = 'create' | 'edit' | 'resubmit'
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'revision_requested' | 'resubmitted' | 'revision_approved'

// 수행기관 정보
export interface OrgInfo {
  operator: string            // 기관명 (자동입력)
}

// ── 주간 보고서 ──

export const KPI_LABELS = [
  '프로그램 개발·운영(과정수)',
  '전문인력 양성(명)',
  '수료율(%)',
  '만족도 점수(점)',
  '지역확산(%)',
  '홍보(건)',
] as const

export const ACTIVITY_LABELS = ['직무교육', '대외협력 및 홍보', '기타'] as const

export interface KpiRow {
  target: string      // 목표(A) — 숫자 문자열 (콤마 없는 raw digits)
  actual: string      // 실적(B) — 전문인력 양성 행에서는 수료 인원, 지역확산 행에서는 자동계산된 비중(%)
  actual_sub?: string // 전문인력 양성 행: 교육중 인원 / 지역확산 행: 지역참여인원
  note?: string       // 참고사항 (주간보고용)
}

export interface ActivityRow {
  current_week: string // 이번주 실적
  next_week: string    // 다음주 계획
  note: string         // 비고
}

export interface BudgetEntry {
  budget: string   // 예산
  executed: string // 집행액
}

export interface MonthlyBudget {
  operator_gov:  BudgetEntry // 국고보조금
  operator_self: BudgetEntry // 자기부담금
}

export interface WeeklyContent {
  version: 2
  org_info: OrgInfo
  kpi_rows: KpiRow[]           // KPI_LABELS 순서와 동일, 길이 6
  activity_rows: ActivityRow[] // ACTIVITY_LABELS 순서와 동일, 길이 3
  budget: MonthlyBudget        // 예산 집행현황
  budget_plan: string          // 향후예산 활용계획
}

// ── 유틸 함수 ──

/** 숫자 문자열(raw digits)을 천단위 콤마 포맷으로 변환 (소수점 1자리 지원) */
export function fmtNum(raw: string): string {
  const n = parseFloat(raw.replace(/,/g, ''))
  if (isNaN(n)) return ''
  if (Number.isInteger(n)) return n.toLocaleString('ko-KR')
  return n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** 달성률 계산 (소수점 1자리) */
export function calcRate(target: string, actual: string): string {
  const t = parseFloat(target.replace(/,/g, ''))
  const a = parseFloat(actual.replace(/,/g, ''))
  if (!t || isNaN(t) || isNaN(a)) return '—'
  return `${((a / t) * 100).toFixed(1)}%`
}

/** 지역확산 비중(%) 계산: 지역참여인원 / 전문인력 양성 수료인원 * 100 */
export function calcRegionalShare(manpowerActual: string, regionalCount: string): string {
  const m = parseFloat((manpowerActual ?? '').replace(/,/g, ''))
  const r = parseFloat((regionalCount ?? '').replace(/,/g, ''))
  if (!m || isNaN(m) || isNaN(r)) return ''
  return (Math.round((r / m) * 1000) / 10).toString()
}

/** 예산 row 계산 결과 */
export function calcBudgetRow(entry: BudgetEntry) {
  const b = parseFloat(entry.budget) || 0
  const e = parseFloat(entry.executed) || 0
  const remaining = b - e
  const rate = b > 0 ? `${((e / b) * 100).toFixed(1)}%` : '—'
  return { budget: b, executed: e, remaining, rate }
}

/** 예산 소계 계산 */
export function calcBudgetSubtotal(a: BudgetEntry, b: BudgetEntry) {
  const ab = (parseFloat(a.budget) || 0) + (parseFloat(b.budget) || 0)
  const ae = (parseFloat(a.executed) || 0) + (parseFloat(b.executed) || 0)
  const remaining = ab - ae
  const rate = ab > 0 ? `${((ae / ab) * 100).toFixed(1)}%` : '—'
  return { budget: ab, executed: ae, remaining, rate }
}

const emptyBudget: BudgetEntry = { budget: '', executed: '' }

/** 기본 WeeklyContent 생성 */
export function defaultWeekly(org: string): WeeklyContent {
  return {
    version: 2,
    org_info: { operator: org },
    kpi_rows: KPI_LABELS.map(() => ({ target: '', actual: '' })),
    activity_rows: ACTIVITY_LABELS.map(() => ({ current_week: '', next_week: '', note: '' })),
    budget: {
      operator_gov:  { ...emptyBudget },
      operator_self: { ...emptyBudget },
    },
    budget_plan: '',
  }
}
