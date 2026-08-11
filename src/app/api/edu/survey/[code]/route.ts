import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRegistrationComplete } from '@/lib/edu/completion'

async function loadRegistration(admin: ReturnType<typeof createAdminClient>, code: string) {
  const { data: registration } = await admin
    .from('edu_registrations')
    .select('id, course_id')
    .eq('participant_code', code)
    .single()
  return registration
}

// 만족도 문항 조회 — 참가자 화면용 (전역 활성 문항 + 제출 여부)
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const admin = createAdminClient()

  const registration = await loadRegistration(admin, code)
  if (!registration) return NextResponse.json({ error: '존재하지 않는 참가자 코드입니다.' }, { status: 404 })

  const { data: sessions } = await admin
    .from('edu_sessions')
    .select('id, checkpoint_start_enabled, checkpoint_mid_enabled, checkpoint_end_enabled')
    .eq('course_id', registration.course_id)
  const completed = await isRegistrationComplete(admin, sessions ?? [], registration.id)

  const { data: existing } = await admin
    .from('edu_survey_response_sets')
    .select('id')
    .eq('registration_id', registration.id)
    .maybeSingle()

  const { data: questions } = await admin
    .from('edu_survey_questions')
    .select('id, label, type, required, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return NextResponse.json({
    questions: questions ?? [],
    eligible: completed,
    alreadySubmitted: !!existing,
  })
}

// 만족도 조사 제출 — 참가자당 과정별 1회만, 수료(모든 체크포인트 완료) 후에만 가능
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const admin = createAdminClient()

  const registration = await loadRegistration(admin, code)
  if (!registration) return NextResponse.json({ error: '존재하지 않는 참가자 코드입니다.' }, { status: 404 })

  const { data: sessions } = await admin
    .from('edu_sessions')
    .select('id, checkpoint_start_enabled, checkpoint_mid_enabled, checkpoint_end_enabled')
    .eq('course_id', registration.course_id)
  const completed = await isRegistrationComplete(admin, sessions ?? [], registration.id)
  if (!completed) return NextResponse.json({ error: '모든 회차의 출석을 완료해야 만족도 조사에 응답할 수 있습니다.' }, { status: 400 })

  const { data: existing } = await admin
    .from('edu_survey_response_sets')
    .select('id')
    .eq('registration_id', registration.id)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: '이미 응답을 제출했습니다.' }, { status: 409 })

  const { data: activeQuestions } = await admin
    .from('edu_survey_questions')
    .select('id, type, required')
    .eq('is_active', true)

  const questionMap = new Map((activeQuestions ?? []).map((q) => [q.id, q]))

  const body = await request.json().catch(() => ({}))
  const answers: { question_id: string; rating_value?: number; text_value?: string }[] = Array.isArray(body.answers) ? body.answers : []

  const answeredIds = new Set(answers.map((a) => a.question_id))
  for (const q of activeQuestions ?? []) {
    if (q.required && !answeredIds.has(q.id)) {
      return NextResponse.json({ error: '필수 문항에 모두 응답해주세요.' }, { status: 400 })
    }
  }

  const rows: { question_id: string; rating_value: number | null; text_value: string | null }[] = []
  for (const a of answers) {
    const question = questionMap.get(a.question_id)
    if (!question) continue // 더 이상 활성화되지 않은 문항은 무시

    if (question.type === 'rating') {
      const rating = Number(a.rating_value)
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        if (question.required) return NextResponse.json({ error: '평점 문항은 1~5점 사이로 응답해주세요.' }, { status: 400 })
        continue
      }
      rows.push({ question_id: a.question_id, rating_value: rating, text_value: null })
    } else {
      const text = (a.text_value ?? '').trim()
      if (!text) {
        if (question.required) return NextResponse.json({ error: '필수 문항에 모두 응답해주세요.' }, { status: 400 })
        continue
      }
      rows.push({ question_id: a.question_id, rating_value: null, text_value: text })
    }
  }

  const { data: responseSet, error: setError } = await admin
    .from('edu_survey_response_sets')
    .insert({ course_id: registration.course_id, registration_id: registration.id })
    .select()
    .single()

  if (setError || !responseSet) {
    return NextResponse.json({ error: '이미 응답을 제출했거나 처리 중 오류가 발생했습니다.' }, { status: 409 })
  }

  if (rows.length > 0) {
    const { error: answersError } = await admin
      .from('edu_survey_answers')
      .insert(rows.map((r) => ({ ...r, response_set_id: responseSet.id })))
    if (answersError) {
      await admin.from('edu_survey_response_sets').delete().eq('id', responseSet.id)
      return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
