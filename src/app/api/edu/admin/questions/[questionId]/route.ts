import { NextResponse } from 'next/server'
import { requireEduSuperAdmin } from '@/lib/edu/access'

// 문항 수정 / 비활성화(물리 삭제 대신 is_active=false) — super_admin 전용
export async function PATCH(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params
  const ctx = await requireEduSuperAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}

  if (body.label !== undefined) {
    const label = String(body.label).trim()
    if (!label) return NextResponse.json({ error: '문항 내용을 입력해주세요.' }, { status: 400 })
    updates.label = label
  }
  if (body.type !== undefined) updates.type = body.type === 'text' ? 'text' : 'rating'
  if (body.required !== undefined) updates.required = !!body.required
  if (body.is_active !== undefined) updates.is_active = !!body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await ctx.admin
    .from('edu_survey_questions')
    .update(updates)
    .eq('id', questionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ question: data })
}
