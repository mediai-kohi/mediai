import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function GET() {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await ctx.admin
    .from('ai_analysis_reports')
    .select('id, start_date, end_date, organization, period_label, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { start_date, end_date, period_label: periodLabelParam, organization, result } = await request.json()
  if (!result) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const period_label = periodLabelParam ?? (start_date && end_date ? `${start_date} ~ ${end_date}` : '')

  const { data, error } = await ctx.admin
    .from('ai_analysis_reports')
    .insert({
      user_id: ctx.user.id,
      start_date,
      end_date,
      organization: organization ?? 'all',
      period_label,
      result,
    })
    .select('id, period_label, created_at')
    .single()

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json(data)
}
