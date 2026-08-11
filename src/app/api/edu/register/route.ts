import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateParticipantCode } from '@/lib/edu/codes'

// 참가 신청 — 로그인 불필요, 개인정보 없음. slug로 과정을 찾아 참가자 코드를 발급한다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const slug: string = body.slug ?? ''
  if (!slug) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: course } = await admin
    .from('edu_courses')
    .select('id, capacity')
    .eq('slug', slug)
    .single()

  if (!course) return NextResponse.json({ error: '존재하지 않는 과정입니다.' }, { status: 404 })

  if (course.capacity > 0) {
    const { count } = await admin
      .from('edu_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', course.id)
    if ((count ?? 0) >= course.capacity) {
      return NextResponse.json({ error: '정원이 마감되었습니다.' }, { status: 409 })
    }
  }

  let participant_code = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateParticipantCode()
    const { data } = await admin.from('edu_registrations').select('id').eq('participant_code', candidate).maybeSingle()
    if (!data) { participant_code = candidate; break }
  }
  if (!participant_code) {
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 })
  }

  const { error } = await admin
    .from('edu_registrations')
    .insert({ course_id: course.id, participant_code })

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  return NextResponse.json({ code: participant_code }, { status: 201 })
}
