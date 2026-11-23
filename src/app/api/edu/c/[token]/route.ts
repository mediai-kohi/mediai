import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type WindowRow = { session_id: string; checkpoint: string; expires_at: string; closed_at: string | null }

async function resolveWindow(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin
    .from('edu_checkin_windows')
    .select('session_id, checkpoint, expires_at, closed_at')
    .eq('token', token)
    .maybeSingle()
  return data as WindowRow | null
}

function windowStatus(checkinWindow: WindowRow | null) {
  if (!checkinWindow) return 'not_found'
  if (checkinWindow.closed_at) return 'closed'
  if (new Date(checkinWindow.expires_at) <= new Date()) return 'expired'
  return 'valid'
}

const CHECKPOINT_LABEL: Record<string, string> = { start: '시작', mid: '중간', end: '종료' }

// 체크인 QR 유효성 + 컨텍스트 조회 — 로그인 불필요, 토큰으로만 검증 (참가자가 QR 스캔 직후 호출)
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const checkinWindow = await resolveWindow(admin, token)
  const status = windowStatus(checkinWindow)
  if (status !== 'valid' || !checkinWindow) {
    return NextResponse.json({ valid: false, reason: status })
  }

  const { data: session } = await admin
    .from('edu_sessions')
    .select('id, course_id, label, session_date')
    .eq('id', checkinWindow.session_id)
    .single()
  if (!session) return NextResponse.json({ valid: false, reason: 'not_found' })

  const { data: course } = await admin
    .from('edu_courses')
    .select('title')
    .eq('id', session.course_id)
    .single()

  return NextResponse.json({
    valid: true,
    courseId: session.course_id,
    courseTitle: course?.title ?? '',
    sessionLabel: session.label,
    sessionDate: session.session_date,
    checkpoint: checkinWindow.checkpoint,
    checkpointLabel: CHECKPOINT_LABEL[checkinWindow.checkpoint] ?? checkinWindow.checkpoint,
    expiresAt: checkinWindow.expires_at,
  })
}

// 셀프 체크인 제출 — 참가자 본인 코드로 출석 기록 (로그인 불필요, 토큰+코드로만 검증)
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const checkinWindow = await resolveWindow(admin, token)
  const status = windowStatus(checkinWindow)
  if (status !== 'valid' || !checkinWindow) {
    return NextResponse.json(
      { error: status === 'expired' ? '체크인 가능 시간이 만료되었습니다. 담당자에게 새 QR을 요청해주세요.' : '유효하지 않은 QR입니다.' },
      { status: 410 }
    )
  }

  const { data: session } = await admin
    .from('edu_sessions')
    .select('id, course_id')
    .eq('id', checkinWindow.session_id)
    .single()
  if (!session) return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const participantCode: string = (body.participant_code ?? '').trim().toUpperCase()
  if (!participantCode) return NextResponse.json({ error: '참가자 코드를 입력해주세요.' }, { status: 400 })

  const { data: registration } = await admin
    .from('edu_registrations')
    .select('id')
    .eq('participant_code', participantCode)
    .eq('course_id', session.course_id)
    .maybeSingle()

  if (!registration) {
    return NextResponse.json({ error: '이 과정에 신청하지 않은 참가자 코드입니다.' }, { status: 404 })
  }

  const { error, data: existing } = await admin
    .from('edu_attendance')
    .upsert(
      { session_id: session.id, registration_id: registration.id, checkpoint: checkinWindow.checkpoint },
      { onConflict: 'session_id,registration_id,checkpoint', ignoreDuplicates: true }
    )
    .select()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  return NextResponse.json({
    success: true,
    courseId: session.course_id,
    alreadyChecked: !existing || existing.length === 0,
  })
}
