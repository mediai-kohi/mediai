import type { KpiRow, ActivityRow, WeeklyContent } from '@/app/(app)/reports/report-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

export const TARGET_ORGS: string[] = []

export const KPI_LABELS = [
  '프로그램 운영(과정수)',
  '전문인력 양성(명)',
  '수료율(%)',
  '만족도 점수(점)',
  '지역확산(%)',
  '홍보(건)',
] as const

export const HEADLINE_KPI_CONFIG = [
  { kpiIndex: 0, label: '과정 운영 개시',  labelEn: 'PROGRAM OPERATIONS', unit: '과정', color: 'teal',   fixedTarget: null },
  { kpiIndex: 1, label: '누적 수료 인원',  labelEn: 'GRADUATES TOTAL',    unit: '명',   color: 'blue',   fixedTarget: null },
  { kpiIndex: 3, label: '교육 만족도',     labelEn: 'SATISFACTION',       unit: '점',   color: 'amber',  fixedTarget: 60 },
  { kpiIndex: 4, label: '지역기관 참여율', labelEn: 'REGIONAL EXPANSION', unit: '%',    color: 'purple', fixedTarget: 30 },
] as const

export type OrgBadge = 'HOT ISSUE' | 'REGIONAL LEADER' | 'ACTIVE' | 'RISING STAR' | '모니터링'
export type DisplayStatus = '미제출' | '제출' | '승인'

// ─── 입력 타입 ────────────────────────────────────────────────────────────────

export interface DbReport {
  id: string
  organization: string
  type: string
  status: string
  period_start: string
  period_end: string
  content: unknown
  submitted_at?: string | null
  approved_at?: string | null
  created_at?: string | null
}

// ─── 출력 타입 ────────────────────────────────────────────────────────────────

export interface OrgStatus {
  org: string
  report_id: string | null
  db_status: string | null
  display_status: DisplayStatus
  badge: OrgBadge
  tagline: string
  next_week: string
  kpi_rows: KpiRow[] | null
  activity_rows: ActivityRow[] | null
}

export interface KpiTotal {
  label: string
  target: number
  actual: number
  rate: string
}

export interface HeadlineKpi {
  label: string
  labelEn: string
  unit: string
  color: string
  actual: number
  target: number
  rate: number
  progress: number
  tagline: string
}

export interface BudgetInfo {
  total_budget: number
  total_executed: number
  execution_rate: string
  org_executions: { org: string; executed: number }[]
}

export interface WeeklySummaryData {
  period_label: string
  period_start: string
  period_end: string
  year: number
  week_number: number
  status: 'partial' | 'confirmed'
  confirmed_at: string | null
  all_approved: boolean
  submitted_count: number
  approved_count: number
  headline_kpis: HeadlineKpi[]
  kpi_totals: KpiTotal[]
  org_statuses: OrgStatus[]
  budget: BudgetInfo
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

export function parseNum(text: string | undefined | null): number {
  if (!text || text === '-' || text === '') return 0
  return parseFloat(text.replace(/[^0-9.]/g, '')) || 0
}

export function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

// 목요일 기준 표시 주 계산:
// 월~수 → 지난주 월요일, 목~일 → 이번주 월요일
export function getWeekStartForDisplay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const monday = getMonday(d)
  const day = d.getDay() // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  if (day >= 1 && day <= 3) {
    return addDays(monday, -7)
  }
  return monday
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getISOWeekInfo(monday: Date): { year: number; week_number: number } {
  const d = new Date(monday)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const week_number =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  return { year: monday.getFullYear(), week_number }
}

export function computePeriodLabel(monday: Date): string {
  const month = monday.getMonth() + 1
  const weekOfMonth = Math.ceil(monday.getDate() / 7)
  return `${monday.getFullYear()}년 ${month}월 ${weekOfMonth}주`
}

function taglineForRate(kpiIndex: number, rate: number): string {
  const over = rate >= 100
  switch (kpiIndex) {
    case 0: return over ? '목표 달성' : '달성률'
    case 1: return over ? '목표 달성' : '성장 가속화'
    case 3: return over ? '목표 초과달성' : '만족도 모니터링'
    case 4: return over ? '우수 지표 안착' : '지역 확산 진행'
    default: return ''
  }
}

function assignBadge(orgStatuses: Omit<OrgStatus, 'badge'>[]): OrgStatus[] {
  const submitted = orgStatuses.filter(
    (o) => o.db_status === 'approved' || o.db_status === 'submitted' || o.db_status === 'resubmitted'
  )

  let hotIssueOrg: string | null = null
  let regionalLeaderOrg: string | null = null
  let risingStarOrg: string | null = null

  // HOT ISSUE: 수료 인원(kpi[1]) 최대
  let maxEnroll = -1
  for (const o of submitted) {
    const v = parseNum(o.kpi_rows?.[1]?.actual)
    if (v > maxEnroll) { maxEnroll = v; hotIssueOrg = o.org }
  }

  // REGIONAL LEADER: 지역확산(kpi[4]) > 0 인 첫 번째
  for (const o of submitted) {
    if (parseNum(o.kpi_rows?.[4]?.actual) > 0) { regionalLeaderOrg = o.org; break }
  }

  // RISING STAR: 만족도(kpi[3]) 최대 (hotIssue가 아닌 기관 중)
  let maxSat = -1
  for (const o of submitted) {
    if (o.org === hotIssueOrg) continue
    const v = parseNum(o.kpi_rows?.[3]?.actual)
    if (v > maxSat) { maxSat = v; risingStarOrg = o.org }
  }

  return orgStatuses.map((o) => {
    let badge: OrgBadge
    if (o.db_status === 'revision_requested' || o.db_status === null) {
      badge = '모니터링'
    } else if (o.org === hotIssueOrg) {
      badge = 'HOT ISSUE'
    } else if (o.org === regionalLeaderOrg) {
      badge = 'REGIONAL LEADER'
    } else if (o.org === risingStarOrg) {
      badge = 'RISING STAR'
    } else {
      badge = 'ACTIVE'
    }
    return { ...o, badge }
  })
}

// ─── 핵심 집계 함수 ───────────────────────────────────────────────────────────

export function computeWeeklySummary(
  reports: DbReport[],
  weekStart: Date,
  existingStatus: 'partial' | 'confirmed' = 'partial',
  existingConfirmedAt: string | null = null,
  baseOrgs: string[] = []
): WeeklySummaryData {
  const weekEnd = addDays(weekStart, 6)

  // 기관당 최신 보고서 1개 선택
  const orgMap = new Map<string, DbReport>()
  for (const r of reports) {
    const prev = orgMap.get(r.organization)
    if (!prev) { orgMap.set(r.organization, r); continue }
    const tA = prev.submitted_at ?? prev.created_at ?? ''
    const tB = r.submitted_at ?? r.created_at ?? ''
    if (tB > tA) orgMap.set(r.organization, r)
  }

  // 등록 기관 목록(baseOrgs) + 미등록이지만 제출한 기관 자동 포함
  const baseOrgSet = new Set<string>(baseOrgs)
  const extraOrgs = Array.from(orgMap.keys()).filter(org => !baseOrgSet.has(org))
  const allOrgs: string[] = [...baseOrgs, ...extraOrgs]

  // 기관별 status 구성 (뱃지 제외 먼저)
  const preStatuses: Omit<OrgStatus, 'badge'>[] = allOrgs.map((org) => {
    const r = orgMap.get(org) ?? null
    const content = r?.content as WeeklyContent | null
    const display_status: DisplayStatus =
      r === null ? '미제출'
      : r.status === 'approved' ? '승인'
      : '제출'
    const tagline = content?.activity_rows?.[0]?.current_week?.slice(0, 50) ?? ''
    const next_week = content?.activity_rows?.[0]?.next_week?.slice(0, 80) ?? ''
    return {
      org,
      report_id: r?.id ?? null,
      db_status: r?.status ?? null,
      display_status,
      tagline,
      next_week,
      kpi_rows: content?.kpi_rows ?? null,
      activity_rows: content?.activity_rows ?? null,
    }
  })

  const org_statuses = assignBadge(preStatuses)

  // KPI 합산 (제출+승인 기관만)
  const activeOrgs = org_statuses.filter(
    (o) => o.db_status !== null && o.db_status !== 'revision_requested'
  )

  const kpi_totals: KpiTotal[] = KPI_LABELS.map((label, i) => {
    const isAvg = i === 2 || i === 3 || i === 4 // 수료율, 만족도, 지역확산은 평균
    const values = activeOrgs
      .map((o) => parseNum(o.kpi_rows?.[i]?.actual))
      .filter((v) => v > 0)
    const targets = activeOrgs
      .map((o) => parseNum(o.kpi_rows?.[i]?.target))
      .filter((v) => v > 0)

    const actual = isAvg
      ? values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
      : values.reduce((a, b) => a + b, 0)
    const target = isAvg
      ? targets.length > 0 ? targets.reduce((a, b) => a + b, 0) / targets.length : 0
      : targets.reduce((a, b) => a + b, 0)

    const rate = target > 0 ? `${((actual / target) * 100).toFixed(1)}%` : '—'
    return { label, target: Math.round(target * 10) / 10, actual: Math.round(actual * 10) / 10, rate }
  })

  // 4개 헤드라인 카드
  const headline_kpis: HeadlineKpi[] = HEADLINE_KPI_CONFIG.map((cfg) => {
    const tot = kpi_totals[cfg.kpiIndex]
    const target = cfg.fixedTarget !== null ? cfg.fixedTarget : tot.target
    const rateNum = target > 0 ? (tot.actual / target) * 100 : 0
    const progress = Math.min(rateNum, 100)
    return {
      label: cfg.label,
      labelEn: cfg.labelEn,
      unit: cfg.unit,
      color: cfg.color,
      actual: tot.actual,
      target,
      rate: Math.round(rateNum * 10) / 10,
      progress: Math.round(progress * 10) / 10,
      tagline: taglineForRate(cfg.kpiIndex, rateNum),
    }
  })

  // 예산 (주간 보고서 최신 1건에서 기관별 집계)
  const orgExecutions: { org: string; executed: number }[] = []
  let totalExecuted = 0
  for (const [org, r] of orgMap) {
    const content = r.content as WeeklyContent | null
    const gov = parseNum(content?.budget?.operator_gov?.executed)
    const self = parseNum(content?.budget?.operator_self?.executed)
    const sum = gov + self
    if (sum > 0) {
      orgExecutions.push({ org, executed: sum })
      totalExecuted += sum
    }
  }
  const TOTAL_BUDGET = 1_560_000_000
  const execRate = TOTAL_BUDGET > 0
    ? `${((totalExecuted / TOTAL_BUDGET) * 100).toFixed(2)}%`
    : '—'

  const submitted_count = org_statuses.filter((o) => o.display_status !== '미제출').length
  const approved_count = org_statuses.filter((o) => o.display_status === '승인').length
  const all_approved = approved_count === allOrgs.length

  const { year, week_number } = getISOWeekInfo(weekStart)

  return {
    period_label: computePeriodLabel(weekStart),
    period_start: formatDateOnly(weekStart),
    period_end: formatDateOnly(weekEnd),
    year,
    week_number,
    status: existingStatus,
    confirmed_at: existingConfirmedAt,
    all_approved,
    submitted_count,
    approved_count,
    headline_kpis,
    kpi_totals,
    org_statuses,
    budget: {
      total_budget: TOTAL_BUDGET,
      total_executed: totalExecuted,
      execution_rate: execRate,
      org_executions: orgExecutions,
    },
  }
}
