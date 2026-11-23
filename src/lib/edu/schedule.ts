// 회차 날짜 목록으로 "교육일정" 문자열을 만든다.
// 날짜가 1개뿐이면 그 날짜를, 여러 개면 최소~최대 범위를, 하나도 없으면 null을 반환한다.
function formatScheduleLabel(dates: (string | null | undefined)[]) {
  const unique = [...new Set(dates.filter((d): d is string => !!d))].sort()
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return `${unique[0]} ~ ${unique[unique.length - 1]}`
}

function formatDurationLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}분`
  if (minutes === 0) return `${hours}시간`
  return `${hours}시간 ${minutes}분`
}

// 과정 목록/QR 화면 등에 표시할 요약 — "일정 · N회 · 총 X시간" (일정이 없으면 일정 부분은 생략)
export function buildScheduleSummary(sessions: { session_date: string | null; duration_minutes: number }[]) {
  if (sessions.length === 0) return null
  const dateLabel = formatScheduleLabel(sessions.map((s) => s.session_date))
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  const parts = [dateLabel, `${sessions.length}회`, `총 ${formatDurationLabel(totalMinutes)}`].filter((p): p is string => !!p)
  return parts.join(' · ')
}
