import { createAdminClient } from '@/lib/supabase/admin'

interface SessionAttendanceInput {
  id: string
  duration_minutes: number
  checkpoint_start_enabled: boolean
  checkpoint_mid_enabled: boolean
  checkpoint_end_enabled: boolean
}

interface AttendanceRow {
  session_id: string
  checkpoint: string
}

const CHECKPOINTS = ['start', 'mid', 'end'] as const
const ENABLED_FIELD = {
  start: 'checkpoint_start_enabled',
  mid: 'checkpoint_mid_enabled',
  end: 'checkpoint_end_enabled',
} as const

// 회차별 교육시간을 활성 체크포인트 수만큼 균등 분할해, 출석한 체크포인트만큼 비례 인정한다.
export function computeAttendanceRate(sessions: SessionAttendanceInput[], attendance: AttendanceRow[]) {
  let totalMinutes = 0
  let attendedMinutes = 0

  for (const session of sessions) {
    const checkpoints = CHECKPOINTS.filter((cp) => session[ENABLED_FIELD[cp]])
    if (checkpoints.length === 0) continue

    totalMinutes += session.duration_minutes
    const perCheckpointMinutes = session.duration_minutes / checkpoints.length

    for (const cp of checkpoints) {
      const attended = attendance.some((a) => a.session_id === session.id && a.checkpoint === cp)
      if (attended) attendedMinutes += perCheckpointMinutes
    }
  }

  const percent = totalMinutes > 0 ? (attendedMinutes / totalMinutes) * 100 : 0
  return { attendedMinutes, totalMinutes, percent }
}

export async function getAttendancePercent(
  admin: ReturnType<typeof createAdminClient>,
  sessions: SessionAttendanceInput[],
  registrationId: string
) {
  const sessionIds = sessions.map((s) => s.id)
  if (sessionIds.length === 0) return 0

  const { data: attendance } = await admin
    .from('edu_attendance')
    .select('session_id, checkpoint')
    .eq('registration_id', registrationId)
    .in('session_id', sessionIds)

  return computeAttendanceRate(sessions, attendance ?? []).percent
}

// 등록건의 출석률(%)이 과정별 수료 기준(%) 이상인지 확인
export async function isRegistrationComplete(
  admin: ReturnType<typeof createAdminClient>,
  sessions: SessionAttendanceInput[],
  registrationId: string,
  thresholdPercent: number
) {
  const percent = await getAttendancePercent(admin, sessions, registrationId)
  return percent >= thresholdPercent
}
