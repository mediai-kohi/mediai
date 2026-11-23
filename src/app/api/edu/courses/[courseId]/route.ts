import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess } from '@/lib/edu/access'

// 과정 상세 (회차 목록 포함) — 개설자 본인 또는 super_admin만
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sessions } = await ctx.admin
    .from('edu_sessions')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true })

  const { count: registrationCount } = await ctx.admin
    .from('edu_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)

  return NextResponse.json({
    course,
    sessions: sessions ?? [],
    registrationCount: registrationCount ?? 0,
  })
}

// 과정 기본정보 수정 (장소/정원/설명/과정명) — 개설자 본인 또는 super_admin만
export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) return NextResponse.json({ error: '과정명을 입력해주세요.' }, { status: 400 })
    updates.title = title
  }
  if (body.location !== undefined) updates.location = String(body.location).trim()
  if (body.description !== undefined) updates.description = String(body.description).trim()
  if (body.capacity !== undefined) {
    const capacity = Number(body.capacity)
    updates.capacity = Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 0
  }
  if (body.completion_threshold_percent !== undefined) {
    const threshold = Number(body.completion_threshold_percent)
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
      return NextResponse.json({ error: '수료 기준은 1~100 사이의 숫자로 입력해주세요.' }, { status: 400 })
    }
    updates.completion_threshold_percent = threshold
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await ctx.admin
    .from('edu_courses')
    .update(updates)
    .eq('id', courseId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ course: data })
}

// 과정 삭제 — 회차/신청자/출석/만족도 응답/체크인·설문 창까지 모두 연쇄삭제(ON DELETE CASCADE)된다. 개설자 본인 또는 super_admin만
export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await ctx.admin.from('edu_courses').delete().eq('id', courseId)
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
