import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildScheduleSummary } from '@/lib/edu/schedule'

type WindowRow = { course_id: string; expires_at: string; closed_at: string | null }

async function resolveWindow(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin
    .from('edu_survey_windows')
    .select('course_id, expires_at, closed_at')
    .eq('token', token)
    .maybeSingle()
  return data as WindowRow | null
}

function windowStatus(surveyWindow: WindowRow | null) {
  if (!surveyWindow) return 'not_found'
  if (surveyWindow.closed_at) return 'closed'
  if (new Date(surveyWindow.expires_at) <= new Date()) return 'expired'
  return 'valid'
}

// 만족도 설문 QR 유효성 + 컨텍스트 조회 — 로그인 불필요, 토큰으로만 검증 (참가자가 QR 스캔 직후 호출)
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const surveyWindow = await resolveWindow(admin, token)
  const status = windowStatus(surveyWindow)
  if (status !== 'valid' || !surveyWindow) {
    return NextResponse.json({ valid: false, reason: status })
  }

  const { data: course } = await admin
    .from('edu_courses')
    .select('title')
    .eq('id', surveyWindow.course_id)
    .single()
  if (!course) return NextResponse.json({ valid: false, reason: 'not_found' })

  const { data: courseSessions } = await admin
    .from('edu_sessions')
    .select('session_date, duration_minutes')
    .eq('course_id', surveyWindow.course_id)
  const scheduleSummary = buildScheduleSummary(courseSessions ?? [])

  return NextResponse.json({
    valid: true,
    courseId: surveyWindow.course_id,
    courseTitle: course.title,
    scheduleSummary,
    expiresAt: surveyWindow.expires_at,
  })
}
