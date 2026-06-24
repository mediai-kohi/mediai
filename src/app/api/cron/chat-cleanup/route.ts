import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { error, count } = await admin
    .from('chat_histories')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff.toISOString())

  if (error) {
    console.error('[cron/chat-cleanup] error:', error)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ deleted: count, cutoff: cutoff.toISOString() })
}
