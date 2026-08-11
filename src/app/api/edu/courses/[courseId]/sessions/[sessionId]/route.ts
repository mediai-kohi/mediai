import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess, type EduContext } from '@/lib/edu/access'

async function loadSession(admin: EduContext['admin'], courseId: string, sessionId: string) {
  const { data } = await admin
    .from('edu_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('course_id', courseId)
    .single()
  return data
}

// 회차 수정 — 출석 기록이 이미 있는 회차는 체크포인트 구성을 바꿀 수 없음(라벨/날짜는 항상 가능)
export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { courseId, sessionId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const session = await loadSession(ctx.admin, courseId, sessionId)
  if (!session) return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  if (body.label !== undefined) {
    const label = String(body.label).trim()
    if (!label) return NextResponse.json({ error: '회차명을 입력해주세요.' }, { status: 400 })
    updates.label = label
  }
  if (body.session_date !== undefined) updates.session_date = body.session_date || null

  const checkpointKeys = ['checkpoint_start_enabled', 'checkpoint_mid_enabled', 'checkpoint_end_enabled'] as const
  const changingCheckpoints = checkpointKeys.some((k) => body[k] !== undefined)

  if (changingCheckpoints) {
    const { count } = await ctx.admin
      .from('edu_attendance')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: '이미 출석 기록이 있는 회차는 체크포인트 구성을 변경할 수 없습니다.' }, { status: 400 })
    }

    const next = {
      checkpoint_start_enabled: body.checkpoint_start_enabled ?? session.checkpoint_start_enabled,
      checkpoint_mid_enabled: body.checkpoint_mid_enabled ?? session.checkpoint_mid_enabled,
      checkpoint_end_enabled: body.checkpoint_end_enabled ?? session.checkpoint_end_enabled,
    }
    if (!next.checkpoint_start_enabled && !next.checkpoint_mid_enabled && !next.checkpoint_end_enabled) {
      return NextResponse.json({ error: '체크포인트를 최소 1개 이상 선택해야 합니다.' }, { status: 400 })
    }
    Object.assign(updates, next)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await ctx.admin
    .from('edu_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ session: data })
}

// 회차 삭제 — 출석 기록이 있거나, 과정의 마지막 남은 회차인 경우 삭제 불가
export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { courseId, sessionId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const session = await loadSession(ctx.admin, courseId, sessionId)
  if (!session) return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })

  const { count: attendanceCount } = await ctx.admin
    .from('edu_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
  if ((attendanceCount ?? 0) > 0) {
    return NextResponse.json({ error: '이미 출석 기록이 있는 회차는 삭제할 수 없습니다.' }, { status: 400 })
  }

  const { count: totalSessions } = await ctx.admin
    .from('edu_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
  if ((totalSessions ?? 0) <= 1) {
    return NextResponse.json({ error: '과정에는 회차가 최소 1개 있어야 합니다.' }, { status: 400 })
  }

  const { error } = await ctx.admin.from('edu_sessions').delete().eq('id', sessionId)
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
