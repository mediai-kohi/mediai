import { NextResponse } from 'next/server'
import { requireEduUser, assertCourseAccess } from '@/lib/edu/access'

// 참가자 삭제 — 등록건과 연결된 출석/만족도 응답도 함께 삭제된다(ON DELETE CASCADE). 개설자 본인 또는 super_admin만
export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string; registrationId: string }> }) {
  const { courseId, registrationId } = await params
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await assertCourseAccess(ctx, courseId)
  if (!course) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: registration } = await ctx.admin
    .from('edu_registrations')
    .select('id')
    .eq('id', registrationId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (!registration) return NextResponse.json({ error: '참가자를 찾을 수 없습니다.' }, { status: 404 })

  const { error } = await ctx.admin.from('edu_registrations').delete().eq('id', registrationId)
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
