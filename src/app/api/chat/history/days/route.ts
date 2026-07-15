import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { kstDateKey, CHAT_HISTORY_RETENTION_MS } from '@/lib/kst'
import { NextResponse } from 'next/server'

function labelFor(dateKey: string, todayKey: string): string {
  const yesterdayKey = kstDateKey(new Date(new Date(`${todayKey}T00:00:00+09:00`).getTime() - 24 * 60 * 60 * 1000))
  if (dateKey === todayKey) return '오늘'
  if (dateKey === yesterdayKey) return '어제'
  return new Date(`${dateKey}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const retentionCutoff = new Date(Date.now() - CHAT_HISTORY_RETENTION_MS)

  const { data, error } = await admin
    .from('chat_histories')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', retentionCutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  const todayKey = kstDateKey(new Date())
  const seen = new Set<string>()
  const days: { date: string; label: string; isToday: boolean }[] = []

  for (const row of data ?? []) {
    const key = kstDateKey(row.created_at as string)
    if (seen.has(key)) continue
    seen.add(key)
    days.push({ date: key, label: labelFor(key, todayKey), isToday: key === todayKey })
  }

  if (!seen.has(todayKey)) {
    days.unshift({ date: todayKey, label: '오늘', isToday: true })
  }

  return NextResponse.json(days)
}
