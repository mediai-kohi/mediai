import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { kstDateKey, kstDayRangeUtc, isValidDateKey, CHAT_HISTORY_RETENTION_MS } from '@/lib/kst'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // 1년 초과 대화 자동 삭제
  const retentionCutoff = new Date(Date.now() - CHAT_HISTORY_RETENTION_MS)
  await admin
    .from('chat_histories')
    .delete()
    .eq('user_id', user.id)
    .lt('created_at', retentionCutoff.toISOString())

  const { searchParams } = new URL(request.url)
  const requestedDate = searchParams.get('date')
  const todayKey = kstDateKey(new Date())
  const dateKey = requestedDate && isValidDateKey(requestedDate) ? requestedDate : todayKey
  const { start, end } = kstDayRangeUtc(dateKey)

  const { data, error } = await admin
    .from('chat_histories')
    .select('id, role, content, sources, created_at')
    .eq('user_id', user.id)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ date: dateKey, isToday: dateKey === todayKey, messages: data ?? [] })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { start, end } = kstDayRangeUtc(kstDateKey(new Date()))

  const { error } = await admin
    .from('chat_histories')
    .delete()
    .eq('user_id', user.id)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
