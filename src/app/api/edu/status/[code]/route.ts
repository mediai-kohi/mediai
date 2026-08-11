import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRegistrationComplete } from '@/lib/edu/completion'

// 참가자 확인증 화면용 상태 조회 — 로그인 불필요, participant_code로만 검증
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const admin = createAdminClient()

  const { data: registration } = await admin
    .from('edu_registrations')
    .select('id, course_id, registered_at')
    .eq('participant_code', code)
    .single()

  if (!registration) return NextResponse.json({ error: '존재하지 않는 참가자 코드입니다.' }, { status: 404 })

  const [{ data: course }, { data: sessions }, { data: attendance }] = await Promise.all([
    admin.from('edu_courses').select('id, title, location').eq('id', registration.course_id).single(),
    admin.from('edu_sessions').select('*').eq('course_id', registration.course_id).order('created_at', { ascending: true }),
    admin.from('edu_attendance').select('session_id, checkpoint, checked_at').eq('registration_id', registration.id),
  ])

  const sessionList = sessions ?? []
  const completed = await isRegistrationComplete(admin, sessionList, registration.id)

  const { data: surveySubmitted } = await admin
    .from('edu_survey_response_sets')
    .select('id')
    .eq('registration_id', registration.id)
    .maybeSingle()

  return NextResponse.json({
    course,
    registeredAt: registration.registered_at,
    sessions: sessionList.map((s) => ({
      id: s.id,
      label: s.label,
      session_date: s.session_date,
      checkpoints: {
        start: s.checkpoint_start_enabled,
        mid: s.checkpoint_mid_enabled,
        end: s.checkpoint_end_enabled,
      },
    })),
    attendance: attendance ?? [],
    completed,
    surveySubmitted: !!surveySubmitted,
  })
}
