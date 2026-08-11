import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess } from '@/lib/edu/access'
import { isRegistrationComplete } from '@/lib/edu/completion'

// 참가자 목록 — 코드/신청시각/회차별 체크포인트 현황/수료 여부/만족도 점수. 개설자 본인 또는 super_admin만
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: sessions }, { data: registrations }] = await Promise.all([
    ctx.admin.from('edu_sessions').select('*').eq('course_id', courseId).order('created_at', { ascending: true }),
    ctx.admin.from('edu_registrations').select('*').eq('course_id', courseId).order('registered_at', { ascending: false }),
  ])

  const sessionList = sessions ?? []
  const regList = registrations ?? []
  const regIds = regList.map((r) => r.id)

  const [{ data: attendance }, { data: responseSets }] = await Promise.all([
    regIds.length > 0
      ? ctx.admin.from('edu_attendance').select('registration_id, session_id, checkpoint').in('registration_id', regIds)
      : Promise.resolve({ data: [] }),
    regIds.length > 0
      ? ctx.admin.from('edu_survey_response_sets').select('id, registration_id').in('registration_id', regIds)
      : Promise.resolve({ data: [] }),
  ])

  const responseSetByReg = new Map((responseSets ?? []).map((r) => [r.registration_id, r.id]))
  const responseSetIds = (responseSets ?? []).map((r) => r.id)

  const { data: ratingAnswers } = responseSetIds.length > 0
    ? await ctx.admin.from('edu_survey_answers').select('response_set_id, rating_value').in('response_set_id', responseSetIds).not('rating_value', 'is', null)
    : { data: [] }

  const avgByResponseSet = new Map<string, number>()
  const groups = new Map<string, number[]>()
  for (const a of ratingAnswers ?? []) {
    if (a.rating_value == null) continue
    const arr = groups.get(a.response_set_id) ?? []
    arr.push(a.rating_value)
    groups.set(a.response_set_id, arr)
  }
  for (const [setId, values] of groups) {
    avgByResponseSet.set(setId, values.reduce((s, v) => s + v, 0) / values.length)
  }

  const attendanceByReg = new Map<string, { session_id: string; checkpoint: string }[]>()
  for (const a of attendance ?? []) {
    const arr = attendanceByReg.get(a.registration_id) ?? []
    arr.push({ session_id: a.session_id, checkpoint: a.checkpoint })
    attendanceByReg.set(a.registration_id, arr)
  }

  const participants = await Promise.all(regList.map(async (reg) => {
    const completed = await isRegistrationComplete(ctx.admin, sessionList, reg.id)
    const responseSetId = responseSetByReg.get(reg.id)
    return {
      id: reg.id,
      participant_code: reg.participant_code,
      registered_at: reg.registered_at,
      completed,
      surveySubmitted: !!responseSetId,
      averageRating: responseSetId ? avgByResponseSet.get(responseSetId) ?? null : null,
      attendance: attendanceByReg.get(reg.id) ?? [],
    }
  }))

  return NextResponse.json({ sessions: sessionList, participants })
}
