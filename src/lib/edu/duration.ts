// 회차 참여시간은 DB에는 분(minutes) 단위로 저장하되, 관리자는 00시~24시 중
// 시작/종료 시각을 선택해서 입력한다. duration_minutes는 그 선택으로부터 계산된다.
export function minutesToHours(minutes: number) {
  return Number((minutes / 60).toFixed(2))
}

export function formatHours(minutes: number) {
  return `${minutesToHours(minutes)}시간`
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function formatHourRange(startHour: number | null | undefined, endHour: number | null | undefined) {
  if (startHour == null || endHour == null) return null
  return `${pad2(startHour)}시 ~ ${pad2(endHour)}시`
}

// 시작/종료 시각(0~24, 정수)을 검증하고 duration_minutes를 계산한다.
export function validateHourRange(startHourRaw: unknown, endHourRaw: unknown):
  | { error: string }
  | { value: { start_hour: number; end_hour: number; duration_minutes: number } } {
  const start = Number(startHourRaw)
  const end = Number(endHourRaw)
  if (!Number.isInteger(start) || start < 0 || start > 24) {
    return { error: '시작 시각을 00~24시 중에서 선택해주세요.' }
  }
  if (!Number.isInteger(end) || end < 0 || end > 24) {
    return { error: '종료 시각을 00~24시 중에서 선택해주세요.' }
  }
  if (end <= start) {
    return { error: '종료 시각은 시작 시각보다 늦어야 합니다.' }
  }
  return { value: { start_hour: start, end_hour: end, duration_minutes: (end - start) * 60 } }
}
