import { createAdminClient } from '@/lib/supabase/admin'

interface SessionCheckpoints {
  id: string
  checkpoint_start_enabled: boolean
  checkpoint_mid_enabled: boolean
  checkpoint_end_enabled: boolean
}

export function requiredCheckpointCount(sessions: SessionCheckpoints[]) {
  return sessions.reduce(
    (sum, s) => sum + [s.checkpoint_start_enabled, s.checkpoint_mid_enabled, s.checkpoint_end_enabled].filter(Boolean).length,
    0
  )
}

// 등록건이 모든 회차의 설정된 체크포인트를 전부 완료했는지 확인 (수료 여부 = 만족도 조사 활성화 조건)
export async function isRegistrationComplete(
  admin: ReturnType<typeof createAdminClient>,
  sessions: SessionCheckpoints[],
  registrationId: string
) {
  const required = requiredCheckpointCount(sessions)
  if (required === 0) return false

  const sessionIds = sessions.map((s) => s.id)
  if (sessionIds.length === 0) return false

  const { count } = await admin
    .from('edu_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('registration_id', registrationId)
    .in('session_id', sessionIds)

  return (count ?? 0) >= required
}
