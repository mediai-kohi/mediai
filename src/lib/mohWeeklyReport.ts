// 보건복지부 주간업무보고 공용 상수/유틸 (작성/열람/인쇄 화면이 공유)

export type MohDeptKey = 'bio' | 'ai'

export const MOH_DEPARTMENTS: {
  key: MohDeptKey
  majorCategory: string
  department: string
}[] = [
  { key: 'bio', majorCategory: '보건산업전문인력양성관리운영', department: '바이오헬스교육부' },
  { key: 'ai', majorCategory: '의료AI 보건의료인 직무교육', department: '의료AI교육팀' },
]

export function departmentToKey(department: string | null | undefined): MohDeptKey | null {
  if (department === '바이오헬스교육부') return 'bio'
  if (department === '의료AI교육팀') return 'ai'
  return null
}

// 편집 가능한 부서 목록. 계정에 department가 지정돼 있으면 role에 관계없이 그 부서만 편집 가능
// (의료AI교육팀 super_admin도 바이오헬스교육부 내용은 수정 불가). department 미지정 super_admin은
// 예외적으로 양쪽 모두 편집 가능(부서 미할당 관리자 계정 대비 안전장치).
export function editableDepts(role: string, department: string | null): MohDeptKey[] {
  const key = departmentToKey(department)
  if (key) return [key]
  if (role === 'super_admin') return ['bio', 'ai']
  return []
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7)
}

function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()}.`
}

export interface MohWeeklyPeriod {
  period_label: string
  period_start: string
  period_end: string
  period_short_label: string
  next_period_start: string
  next_period_end: string
  next_period_label: string
}

// weeklyDate로 선택한 주 = "이번주"(실적 대상 주, 이 보고서 레코드의 식별 기간, 기본값은 오늘이 속한 주).
// "다음주"(계획 대상 주)는 그보다 7일 뒤 주로 자동 계산된다.
export function calcMohWeeklyPeriod(weeklyDate: string): MohWeeklyPeriod {
  const monday = getMondayOfWeek(new Date(weeklyDate + 'T00:00:00'))
  const friday = new Date(monday)
  friday.setDate(friday.getDate() + 4)
  const thursday = new Date(monday)
  thursday.setDate(thursday.getDate() + 3)
  const week = getWeekOfMonth(thursday)

  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)
  const nextFriday = new Date(nextMonday)
  nextFriday.setDate(nextFriday.getDate() + 4)

  return {
    period_label: `${thursday.getFullYear()}년 ${thursday.getMonth() + 1}월 ${week}주 (${fmtShort(monday)}~${fmtShort(friday)})`,
    period_start: toDateStr(monday),
    period_end: toDateStr(friday),
    period_short_label: `${fmtShort(monday)}~${fmtShort(friday)}`,
    next_period_start: toDateStr(nextMonday),
    next_period_end: toDateStr(nextFriday),
    next_period_label: `${fmtShort(nextMonday)}~${fmtShort(nextFriday)}`,
  }
}

// row에 저장된 period_start/period_end("이번주" 실적 기간)로부터 "이번주"(그대로)/"다음주"(+7일) 표기용 짧은 라벨을 계산
export function deriveMohWeekLabels(periodStart: string, periodEnd: string): { thisWeekLabel: string; nextWeekLabel: string } {
  const start = new Date(periodStart + 'T00:00:00')
  const end = new Date(periodEnd + 'T00:00:00')
  const nextStart = new Date(start)
  nextStart.setDate(nextStart.getDate() + 7)
  const nextEnd = new Date(end)
  nextEnd.setDate(nextEnd.getDate() + 7)

  return {
    thisWeekLabel: `${fmtShort(start)}~${fmtShort(end)}`,
    nextWeekLabel: `${fmtShort(nextStart)}~${fmtShort(nextEnd)}`,
  }
}
