import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess } from '@/lib/edu/access'
import { generateCheckinToken } from '@/lib/edu/codes'

// 만족도 설문 오픈 창(현재 활성 창) 조회 — 관리자 화면 복원 + 제출 인원 표시용
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: surveyWindow } = await ctx.admin
    .from('edu_survey_windows')
    .select('id, token, opened_at, expires_at, duration_minutes')
    .eq('course_id', courseId)
    .is('closed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: submittedCount } = await ctx.admin
    .from('edu_survey_response_sets')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)

  return NextResponse.json({ window: surveyWindow, submittedCount: submittedCount ?? 0 })
}

// 만족도 설문 오픈 창 발급 — 개설자 본인 또는 super_admin만. 기존 활성 창은 즉시 무효화(재사용 방지).
export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const durationMinutes = Number(body.duration_minutes)
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080) {
    return NextResponse.json({ error: '유효시간은 1~10080분(최대 7일) 사이로 설정해주세요.' }, { status: 400 })
  }

  await ctx.admin
    .from('edu_survey_windows')
    .update({ closed_at: new Date().toISOString() })
    .eq('course_id', courseId)
    .is('closed_at', null)

  const openedAt = new Date()
  const expiresAt = new Date(openedAt.getTime() + durationMinutes * 60_000)

  const { data, error } = await ctx.admin
    .from('edu_survey_windows')
    .insert({
      course_id: courseId,
      token: generateCheckinToken(),
      duration_minutes: durationMinutes,
      opened_at: openedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select('id, token, opened_at, expires_at, duration_minutes')
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ window: data }, { status: 201 })
}

// 만족도 설문 오픈 창 즉시 닫기 — 유효시간이 남아있어도 관리자가 수동으로 조기 종료
export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await ctx.admin
    .from('edu_survey_windows')
    .update({ closed_at: new Date().toISOString() })
    .eq('course_id', courseId)
    .is('closed_at', null)

  return NextResponse.json({ success: true })
}
