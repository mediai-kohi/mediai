import { NextResponse } from 'next/server'
import { requireEduSuperAdmin } from '@/lib/edu/access'

// 문항 순서변경 — 전체 순서 배열을 받아 sort_order를 일괄 재기록. super_admin 전용
export async function POST(request: Request) {
  const ctx = await requireEduSuperAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []
  if (ids.length === 0) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

  for (let i = 0; i < ids.length; i++) {
    const { error } = await ctx.admin.from('edu_survey_questions').update({ sort_order: i }).eq('id', ids[i])
    if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
