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
  { kpiIndex: 1, label: '누적 수료 인원',  labelEn: 'GRADUATES TOTAL',    unit: '명',   color: 'blue',   fixedTarget: 1200 },
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
  total_budget_gov: number
  total_budget_self: number
  total_executed: number
  total_executed_gov: number
  total_executed_self: number
  execution_rate: string
  execution_rate_gov: string
  execution_rate_self: string
  org_executions: { org: string; executed: number; gov: number; self: number; gov_budget: number; self_budget: number }[]
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
  // 몇월 몇주인지는 그 주의 목요일이 속한 달 기준으로 판정
  const thursday = addDays(monday, 3)
  const month = thursday.getMonth() + 1
  const weekOfMonth = Math.ceil(thursday.getDate() / 7)
  return `${thursday.getFullYear()}년 ${month}월 ${weekOfMonth}주`
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

// ─── 총괄표 (운영기관별 세부 실적 + 합계/달성률) ─────────────────────────────

/** 총괄표 기관 컬럼 고정 순서 (organizations.name 기준). 목록에 없는 기관은 뒤에 원래 순서대로 붙는다 */
export const OVERVIEW_ORG_ORDER = [
  '삼성서울병원',
  '서울대학교병원',
  '순천향대학교 부속 천안병원',
  '연세의료원',
  '중앙대학교광명병원',
  'KMI한국의학연구소',
  '엔디에스',
  '차의과학대학교 분당차병원',
]

export interface OverviewRow {
  label: string
  isRate: boolean    // true면 달성률 행(기관별 값도 %로 표시)
  values: string[]   // 기관별 값 (orgs와 동일한 순서)
  total: string       // 합계(개수형 지표), 평균(비율형 지표) 또는 합계기준 달성률
}

export interface OverviewGroup {
  group: string
  rows: OverviewRow[]
}

export interface OverviewSection {
  section: string // '정량지표' | '예산집행'
  groups: OverviewGroup[]
}

export interface OverviewTable {
  orgs: string[]
  sections: OverviewSection[]
}

function fmtOverviewNum(n: number): string {
  if (!n) return '—'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('ko-KR')
    : rounded.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function overviewRate(target: number, actual: number): string {
  if (!target) return '—'
  return `${((actual / target) * 100).toFixed(1)}%`
}

function sumOf(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

function avgOfNonZero(nums: number[]): number {
  const nz = nums.filter((v) => v > 0)
  return nz.length > 0 ? sumOf(nz) / nz.length : 0
}

/** 총괄표 고정 기관 순서(OVERVIEW_ORG_ORDER) 기준 정렬. 목록에 없는 기관은 원래 순서 그대로 뒤에 붙는다 */
export function sortByOverviewOrgOrder<T extends { org: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = OVERVIEW_ORG_ORDER.indexOf(a.org)
    const bi = OVERVIEW_ORG_ORDER.indexOf(b.org)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

/** 관리자 주간실적요약 확정 시 다운로드되는 전체기관 총괄표 데이터 생성 */
export function buildOverviewTable(
  orgReportsInput: { org: string; content: WeeklyContent }[]
): OverviewTable {
  const orgReports = sortByOverviewOrgOrder(orgReportsInput)
  const orgs = orgReports.map((o) => o.org)

  const kpiVals = (i: number, field: 'target' | 'actual' | 'actual_sub'): number[] =>
    orgReports.map((o) => {
      const row = o.content.kpi_rows?.[i] as (KpiRow & { actual_sub?: string }) | undefined
      return parseNum(row?.[field])
    })

  // 개수/합산형 지표 값 행 (프로그램 운영 수, 인원, 건수 등)
  const countValueRow = (label: string, i: number, field: 'target' | 'actual' | 'actual_sub'): OverviewRow => {
    const vals = kpiVals(i, field)
    return { label, isRate: false, values: vals.map(fmtOverviewNum), total: fmtOverviewNum(sumOf(vals)) }
  }

  // 비율/점수형 지표 값 행 (수료율, 만족도, 지역확산 등) — 평균으로 집계
  const avgValueRow = (label: string, i: number, field: 'target' | 'actual'): OverviewRow => {
    const vals = kpiVals(i, field)
    return { label, isRate: false, values: vals.map(fmtOverviewNum), total: fmtOverviewNum(avgOfNonZero(vals)) }
  }

  // 달성률 행: 기관별로 각자의 목표(A) 대비 실적(B) 비율을 계산 + 합계 기준 달성률
  const rateRow = (
    i: number,
    targetField: 'target' | 'actual',
    actualField: 'target' | 'actual',
    isAvg: boolean
  ): OverviewRow => {
    const targets = kpiVals(i, targetField)
    const actuals = kpiVals(i, actualField)
    const values = orgReports.map((_, idx) => overviewRate(targets[idx], actuals[idx]))
    const targetTotal = isAvg ? avgOfNonZero(targets) : sumOf(targets)
    const actualTotal = isAvg ? avgOfNonZero(actuals) : sumOf(actuals)
    return { label: '달성률', isRate: true, values, total: overviewRate(targetTotal, actualTotal) }
  }

  // 지역확산(%) 합계: 전체기관 지역참여인원 합계 / 수료인원 합계 (기관별 값은 각자의 계산된 비중 유지)
  const regionalTotalRate = (() => {
    const participants = sumOf(kpiVals(4, 'actual_sub'))
    const graduates = sumOf(kpiVals(1, 'actual'))
    return graduates > 0 ? (participants / graduates) * 100 : 0
  })()
  const regionalValueRow = (): OverviewRow => {
    const vals = kpiVals(4, 'actual')
    return { label: '지역확산(%)', isRate: false, values: vals.map(fmtOverviewNum), total: fmtOverviewNum(regionalTotalRate) }
  }
  const regionalRateRow = (): OverviewRow => {
    const targets = kpiVals(4, 'target')
    const actuals = kpiVals(4, 'actual')
    const values = orgReports.map((_, idx) => overviewRate(targets[idx], actuals[idx]))
    const targetTotal = avgOfNonZero(targets)
    return { label: '달성률', isRate: true, values, total: overviewRate(targetTotal, regionalTotalRate) }
  }

  // 예산 (천원 단위)
  const budgetNums = (kind: 'operator_gov' | 'operator_self', field: 'budget' | 'executed'): number[] =>
    orgReports.map((o) => parseNum(o.content.budget?.[kind]?.[field]) / 1000)
  const budgetTotalNums = (field: 'budget' | 'executed'): number[] =>
    orgReports.map(
      (o) =>
        (parseNum(o.content.budget?.operator_gov?.[field]) + parseNum(o.content.budget?.operator_self?.[field])) /
        1000
    )

  const budgetValueRow = (label: string, vals: number[]): OverviewRow => ({
    label,
    isRate: false,
    values: vals.map(fmtOverviewNum),
    total: fmtOverviewNum(sumOf(vals)),
  })

  const budgetRateRow = (budgetVals: number[], executedVals: number[]): OverviewRow => ({
    label: '달성률',
    isRate: true,
    values: budgetVals.map((b, idx) => overviewRate(b, executedVals[idx])),
    total: overviewRate(sumOf(budgetVals), sumOf(executedVals)),
  })

  const govBudget = budgetNums('operator_gov', 'budget')
  const govExecuted = budgetNums('operator_gov', 'executed')
  const selfBudget = budgetNums('operator_self', 'budget')
  const selfExecuted = budgetNums('operator_self', 'executed')
  const totalBudget = budgetTotalNums('budget')
  const totalExecuted = budgetTotalNums('executed')

  const sections: OverviewSection[] = [
    {
      section: '정량지표',
      groups: [
        {
          group: '프로그램 개발·운영',
          rows: [
            countValueRow('개발(개)', 0, 'target'),
            countValueRow('운영(개)', 0, 'actual'),
            rateRow(0, 'target', 'actual', false),
          ],
        },
        {
          group: '전문인력 양성',
          rows: [
            countValueRow('목표(명)', 1, 'target'),
            countValueRow('수료(명)', 1, 'actual'),
            countValueRow('교육중(명)', 1, 'actual_sub'),
            rateRow(1, 'target', 'actual', false),
          ],
        },
        {
          group: '교육과정 수료율',
          rows: [avgValueRow('수료율(%)', 2, 'actual'), rateRow(2, 'target', 'actual', true)],
        },
        {
          group: '만족도조사',
          rows: [avgValueRow('만족도(점)', 3, 'actual'), rateRow(3, 'target', 'actual', true)],
        },
        {
          group: '지역확산',
          rows: [regionalValueRow(), regionalRateRow()],
        },
        {
          group: '홍보',
          rows: [countValueRow('홍보(건)', 5, 'actual'), rateRow(5, 'target', 'actual', false)],
        },
      ],
    },
    {
      section: '예산집행',
      groups: [
        {
          group: '국고보조금',
          rows: [
            budgetValueRow('예산(천원)', govBudget),
            budgetValueRow('집행(천원)', govExecuted),
            budgetRateRow(govBudget, govExecuted),
          ],
        },
        {
          group: '자기부담금',
          rows: [
            budgetValueRow('예산(천원)', selfBudget),
            budgetValueRow('집행(천원)', selfExecuted),
            budgetRateRow(selfBudget, selfExecuted),
          ],
        },
        {
          group: '합계',
          rows: [
            budgetValueRow('예산(천원)', totalBudget),
            budgetValueRow('집행(천원)', totalExecuted),
            budgetRateRow(totalBudget, totalExecuted),
          ],
        },
      ],
    },
  ]

  return { orgs, sections }
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

  // 지역기관 참여율(헤드라인 전용): 전체기관 지역참여인원 합계 / 수료인원 합계
  const regionalParticipants = activeOrgs.reduce((sum, o) => sum + parseNum(o.kpi_rows?.[4]?.actual_sub), 0)
  const regionalGraduates = activeOrgs.reduce((sum, o) => sum + parseNum(o.kpi_rows?.[1]?.actual), 0)
  const regionalParticipationRate = regionalGraduates > 0 ? (regionalParticipants / regionalGraduates) * 100 : 0

  // 4개 헤드라인 카드
  const headline_kpis: HeadlineKpi[] = HEADLINE_KPI_CONFIG.map((cfg) => {
    const tot = kpi_totals[cfg.kpiIndex]
    const actualValue = cfg.kpiIndex === 4
      ? Math.round(regionalParticipationRate * 10) / 10
      : tot.actual
    const target = cfg.fixedTarget !== null ? cfg.fixedTarget : tot.target
    const rateNum = target > 0 ? (actualValue / target) * 100 : 0
    const progress = Math.min(rateNum, 100)
    return {
      label: cfg.label,
      labelEn: cfg.labelEn,
      unit: cfg.unit,
      color: cfg.color,
      actual: actualValue,
      target,
      rate: Math.round(rateNum * 10) / 10,
      progress: Math.round(progress * 10) / 10,
      tagline: taglineForRate(cfg.kpiIndex, rateNum),
    }
  })

  // 예산 (주간 보고서 최신 1건에서 기관별 집계)
  const orgExecutions: { org: string; executed: number; gov: number; self: number; gov_budget: number; self_budget: number }[] = []
  let totalExecuted = 0
  let totalExecutedGov = 0
  let totalExecutedSelf = 0
  let totalBudgetGov = 0
  let totalBudgetSelf = 0
  for (const [org, r] of orgMap) {
    const content = r.content as WeeklyContent | null
    const govBudget = parseNum(content?.budget?.operator_gov?.budget)
    const selfBudget = parseNum(content?.budget?.operator_self?.budget)
    const gov = parseNum(content?.budget?.operator_gov?.executed)
    const self = parseNum(content?.budget?.operator_self?.executed)
    const sum = gov + self
    totalBudgetGov += govBudget
    totalBudgetSelf += selfBudget
    totalExecuted += sum
    totalExecutedGov += gov
    totalExecutedSelf += self
    if (govBudget > 0 || selfBudget > 0 || sum > 0) {
      orgExecutions.push({ org, executed: sum, gov, self, gov_budget: govBudget, self_budget: selfBudget })
    }
  }
  const totalBudget = totalBudgetGov + totalBudgetSelf
  const execRate = totalBudget > 0
    ? `${((totalExecuted / totalBudget) * 100).toFixed(2)}%`
    : '—'
  const execRateGov = totalBudgetGov > 0
    ? `${((totalExecutedGov / totalBudgetGov) * 100).toFixed(2)}%`
    : '—'
  const execRateSelf = totalBudgetSelf > 0
    ? `${((totalExecutedSelf / totalBudgetSelf) * 100).toFixed(2)}%`
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
      total_budget: totalBudget,
      total_budget_gov: totalBudgetGov,
      total_budget_self: totalBudgetSelf,
      total_executed: totalExecuted,
      total_executed_gov: totalExecutedGov,
      total_executed_self: totalExecutedSelf,
      execution_rate: execRate,
      execution_rate_gov: execRateGov,
      execution_rate_self: execRateSelf,
      org_executions: orgExecutions,
    },
  }
}
