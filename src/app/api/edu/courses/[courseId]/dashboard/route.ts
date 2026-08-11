import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess } from '@/lib/edu/access'
import { isRegistrationComplete } from '@/lib/edu/completion'

// 대시보드 — 신청/수료 인원, 문항별 만족도 집계. 개설자 본인 또는 super_admin만
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: sessions }, { data: registrations }] = await Promise.all([
    ctx.admin.from('edu_sessions').select('*').eq('course_id', courseId),
    ctx.admin.from('edu_registrations').select('id').eq('course_id', courseId),
  ])

  const sessionList = sessions ?? []
  const regIds = (registrations ?? []).map((r) => r.id)

  let completedCount = 0
  for (const id of regIds) {
    if (await isRegistrationComplete(ctx.admin, sessionList, id)) completedCount++
  }

  const { data: responseSets } = regIds.length > 0
    ? await ctx.admin.from('edu_survey_response_sets').select('id').eq('course_id', courseId)
    : { data: [] }
  const responseSetIds = (responseSets ?? []).map((r) => r.id)

  const { data: questions } = await ctx.admin
    .from('edu_survey_questions')
    .select('id, label, type, sort_order')
    .order('sort_order', { ascending: true })

  const { data: answers } = responseSetIds.length > 0
    ? await ctx.admin.from('edu_survey_answers').select('question_id, rating_value, text_value').in('response_set_id', responseSetIds)
    : { data: [] }

  const answersByQuestion = new Map<string, { rating_value: number | null; text_value: string | null }[]>()
  for (const a of answers ?? []) {
    const arr = answersByQuestion.get(a.question_id) ?? []
    arr.push({ rating_value: a.rating_value, text_value: a.text_value })
    answersByQuestion.set(a.question_id, arr)
  }

  let overallRatingSum = 0
  let overallRatingCount = 0

  const questionStats = (questions ?? []).map((q) => {
    const qAnswers = answersByQuestion.get(q.id) ?? []
    if (q.type === 'rating') {
      const values = qAnswers.map((a) => a.rating_value).filter((v): v is number => v != null)
      const distribution = [1, 2, 3, 4, 5].map((score) => values.filter((v) => v === score).length)
      const average = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null
      overallRatingSum += values.reduce((s, v) => s + v, 0)
      overallRatingCount += values.length
      return { id: q.id, label: q.label, type: q.type, average, distribution, responseCount: values.length }
    }
    const responses = qAnswers.map((a) => a.text_value).filter((v): v is string => !!v)
    return { id: q.id, label: q.label, type: q.type, responses }
  })

  return NextResponse.json({
    registrationCount: regIds.length,
    completedCount,
    surveyResponseCount: responseSetIds.length,
    averageRating: overallRatingCount > 0 ? overallRatingSum / overallRatingCount : null,
    questionStats,
  })
}
