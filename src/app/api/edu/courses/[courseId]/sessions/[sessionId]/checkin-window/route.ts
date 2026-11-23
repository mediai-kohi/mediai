import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess, type EduContext } from '@/lib/edu/access'
import { generateCheckinToken } from '@/lib/edu/codes'

const VALID_CHECKPOINTS = ['start', 'mid', 'end'] as const
type Checkpoint = (typeof VALID_CHECKPOINTS)[number]

const ENABLED_FIELD: Record<Checkpoint, 'checkpoint_start_enabled' | 'checkpoint_mid_enabled' | 'checkpoint_end_enabled'> = {
  start: 'checkpoint_start_enabled',
  mid: 'checkpoint_mid_enabled',
  end: 'checkpoint_end_enabled',
}

async function loadSession(admin: EduContext['admin'], courseId: string, sessionId: string) {
  const { data } = await admin
    .from('edu_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('course_id', courseId)
    .single()
  return data
}

// 특정 회차/체크포인트의 현재 활성 체크인 창 조회 — 관리자 화면 복원 + 실시간 체크인 인원 표시용
export async function GET(request: Request, { params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { courseId, sessionId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const checkpoint = searchParams.get('checkpoint') ?? ''
  if (!VALID_CHECKPOINTS.includes(checkpoint as Checkpoint)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { data: checkinWindow } = await ctx.admin
    .from('edu_checkin_windows')
    .select('id, token, opened_at, expires_at, duration_minutes')
    .eq('session_id', sessionId)
    .eq('checkpoint', checkpoint)
    .is('closed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let checkedInCount = 0
  if (checkinWindow) {
    const { count } = await ctx.admin
      .from('edu_attendance')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('checkpoint', checkpoint)
      .gte('checked_at', checkinWindow.opened_at)
    checkedInCount = count ?? 0
  }

  return NextResponse.json({ window: checkinWindow, checkedInCount })
}

// 체크인 QR 창 발급 — 개설자 본인 또는 super_admin만. 같은 회차/체크포인트의 기존 활성 창은 즉시 무효화(재사용 방지).
export async function POST(request: Request, { params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { courseId, sessionId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const session = await loadSession(ctx.admin, courseId, sessionId)
  if (!session) return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const checkpoint: string = body.checkpoint ?? ''
  const durationMinutes = Number(body.duration_minutes)

  if (!VALID_CHECKPOINTS.includes(checkpoint as Checkpoint)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!session[ENABLED_FIELD[checkpoint as Checkpoint]]) {
    return NextResponse.json({ error: '이 회차에는 설정되지 않은 체크포인트입니다.' }, { status: 400 })
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
    return NextResponse.json({ error: '유효시간은 1~720분 사이로 설정해주세요.' }, { status: 400 })
  }

  await ctx.admin
    .from('edu_checkin_windows')
    .update({ closed_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('checkpoint', checkpoint)
    .is('closed_at', null)

  const openedAt = new Date()
  const expiresAt = new Date(openedAt.getTime() + durationMinutes * 60_000)

  const { data, error } = await ctx.admin
    .from('edu_checkin_windows')
    .insert({
      session_id: sessionId,
      checkpoint,
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

// 체크인 창 즉시 닫기 — 유효시간이 남아있어도 관리자가 수동으로 조기 종료
export async function DELETE(request: Request, { params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { courseId, sessionId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const checkpoint = searchParams.get('checkpoint') ?? ''
  if (!VALID_CHECKPOINTS.includes(checkpoint as Checkpoint)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  await ctx.admin
    .from('edu_checkin_windows')
    .update({ closed_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('checkpoint', checkpoint)
    .is('closed_at', null)

  return NextResponse.json({ success: true })
}
