import { NextResponse } from 'next/server'
import { requireEduSuperAdmin } from '@/lib/edu/access'

// 만족도 문항 목록 (비활성 포함) — super_admin 전용, 전역 설정
export async function GET() {
  const ctx = await requireEduSuperAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await ctx.admin
    .from('edu_survey_questions')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ questions: data ?? [] })
}

// 문항 추가 — super_admin 전용
export async function POST(request: Request) {
  const ctx = await requireEduSuperAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const label: string = (body.label ?? '').trim()
  const type: string = body.type === 'text' ? 'text' : 'rating'
  const required = body.required !== false

  if (!label) return NextResponse.json({ error: '문항 내용을 입력해주세요.' }, { status: 400 })

  const { count } = await ctx.admin
    .from('edu_survey_questions')
    .select('id', { count: 'exact', head: true })

  const { data, error } = await ctx.admin
    .from('edu_survey_questions')
    .insert({ label, type, required, sort_order: count ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ question: data }, { status: 201 })
}
