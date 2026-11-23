import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAttendancePercent } from '@/lib/edu/completion'

async function loadRegistration(admin: ReturnType<typeof createAdminClient>, code: string) {
  const { data: registration } = await admin
    .from('edu_registrations')
    .select('id, course_id')
    .eq('participant_code', code)
    .single()
  return registration
}

async function loadEligibility(admin: ReturnType<typeof createAdminClient>, registration: { id: string; course_id: string }) {
  const [{ data: course }, { data: sessions }] = await Promise.all([
    admin.from('edu_courses').select('completion_threshold_percent').eq('id', registration.course_id).single(),
    admin.from('edu_sessions').select('id, duration_minutes, checkpoint_start_enabled, checkpoint_mid_enabled, checkpoint_end_enabled').eq('course_id', registration.course_id),
  ])

  const threshold = course?.completion_threshold_percent ?? 80
  const attendancePercent = await getAttendancePercent(admin, sessions ?? [], registration.id)
  const attendanceOk = attendancePercent >= threshold

  const { data: surveyWindow } = await admin
    .from('edu_survey_windows')
    .select('id')
    .eq('course_id', registration.course_id)
    .is('closed_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  return {
    threshold,
    attendancePercent: Math.round(attendancePercent),
    attendanceOk,
    windowOpen: !!surveyWindow,
  }
}

// 만족도 문항 조회 — 참가자 화면용 (전역 활성 문항 + 제출 여부)
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const admin = createAdminClient()

  const registration = await loadRegistration(admin, code)
  if (!registration) return NextResponse.json({ error: '존재하지 않는 참가자 코드입니다.' }, { status: 404 })

  const { threshold, attendancePercent, attendanceOk, windowOpen } = await loadEligibility(admin, registration)

  const { data: existing } = await admin
    .from('edu_survey_response_sets')
    .select('id')
    .eq('registration_id', registration.id)
    .maybeSingle()

  const { data: questions } = await admin
    .from('edu_survey_questions')
    .select('id, label, type, required, sort_order, scale_min_label, scale_max_label')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return NextResponse.json({
    questions: questions ?? [],
    eligible: attendanceOk && windowOpen,
    attendanceOk,
    windowOpen,
    attendancePercent,
    threshold,
    alreadySubmitted: !!existing,
  })
}

// 만족도 조사 제출 — 참가자당 과정별 1회만. 출석률이 수료 기준 이상이고, 관리자가 설문을 오픈했을 때만 가능
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const admin = createAdminClient()

  const registration = await loadRegistration(admin, code)
  if (!registration) return NextResponse.json({ error: '존재하지 않는 참가자 코드입니다.' }, { status: 404 })

  const { threshold, attendancePercent, attendanceOk, windowOpen } = await loadEligibility(admin, registration)
  if (!attendanceOk) {
    return NextResponse.json({ error: `출석률(${attendancePercent}%)이 수료 기준(${threshold}%)에 미달하여 만족도 조사에 응답할 수 없습니다.` }, { status: 400 })
  }
  if (!windowOpen) {
    return NextResponse.json({ error: '담당자가 아직 만족도 조사를 열지 않았습니다.' }, { status: 400 })
  }

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
