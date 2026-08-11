import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess } from '@/lib/edu/access'

// 회차 추가 — 다회차(series) 과정만 가능. 개설자 본인 또는 super_admin만
export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (course.course_type !== 'series') {
    return NextResponse.json({ error: '단일 교육 과정은 회차를 추가할 수 없습니다.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const label: string = (body.label ?? '').trim()
  if (!label) return NextResponse.json({ error: '회차명을 입력해주세요.' }, { status: 400 })

  const checkpoint_start_enabled = !!body.checkpoint_start_enabled
  const checkpoint_mid_enabled = !!body.checkpoint_mid_enabled
  const checkpoint_end_enabled = !!body.checkpoint_end_enabled

  if (!checkpoint_start_enabled && !checkpoint_mid_enabled && !checkpoint_end_enabled) {
    return NextResponse.json({ error: '체크포인트를 최소 1개 이상 선택해야 합니다.' }, { status: 400 })
  }

  const { data, error } = await ctx.admin
    .from('edu_sessions')
    .insert({
      course_id: courseId,
      label,
      session_date: body.session_date || null,
      checkpoint_start_enabled,
      checkpoint_mid_enabled,
      checkpoint_end_enabled,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ session: data }, { status: 201 })
}
