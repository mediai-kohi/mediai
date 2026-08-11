import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess } from '@/lib/edu/access'

const VALID_CHECKPOINTS = ['start', 'mid', 'end'] as const
type Checkpoint = (typeof VALID_CHECKPOINTS)[number]

const ENABLED_FIELD: Record<Checkpoint, 'checkpoint_start_enabled' | 'checkpoint_mid_enabled' | 'checkpoint_end_enabled'> = {
  start: 'checkpoint_start_enabled',
  mid: 'checkpoint_mid_enabled',
  end: 'checkpoint_end_enabled',
}

// 연속 스캔(또는 수동 입력) 출석체크 — 개설자 본인 또는 super_admin만
export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const sessionId: string = body.session_id ?? ''
  const checkpoint: string = body.checkpoint ?? ''
  const participantCode: string = (body.participant_code ?? '').trim().toUpperCase()

  if (!sessionId || !VALID_CHECKPOINTS.includes(checkpoint as Checkpoint) || !participantCode) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { data: session } = await ctx.admin
    .from('edu_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('course_id', courseId)
    .single()

  if (!session) return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })
  if (!session[ENABLED_FIELD[checkpoint as Checkpoint]]) {
    return NextResponse.json({ error: '이 회차에는 설정되지 않은 체크포인트입니다.' }, { status: 400 })
  }

  const { data: registration } = await ctx.admin
    .from('edu_registrations')
    .select('id')
    .eq('participant_code', participantCode)
    .eq('course_id', courseId)
    .maybeSingle()

  if (!registration) {
    return NextResponse.json({ error: '이 과정에 신청하지 않은 참가자 코드입니다.' }, { status: 404 })
  }

  const { error, data: existing } = await ctx.admin
    .from('edu_attendance')
    .upsert(
      { session_id: sessionId, registration_id: registration.id, checkpoint },
      { onConflict: 'session_id,registration_id,checkpoint', ignoreDuplicates: true }
    )
    .select()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  return NextResponse.json({
    success: true,
    participantCode,
    alreadyChecked: !existing || existing.length === 0,
  })
}
