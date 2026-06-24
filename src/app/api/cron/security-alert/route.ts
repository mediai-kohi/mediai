import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: failEvents, error } = await admin
    .from('audit_log')
    .select('ip_address')
    .eq('action', 'auth.login.fail')
    .gte('created_at', since)

  if (error) {
    console.error('[cron/security-alert]', error.message)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  const ipCounts: Record<string, number> = {}
  for (const event of failEvents ?? []) {
    if (event.ip_address) {
      ipCounts[event.ip_address] = (ipCounts[event.ip_address] ?? 0) + 1
    }
  }

  const suspicious = Object.entries(ipCounts)
    .filter(([, count]) => count >= 10)
    .map(([ip, count]) => ({ ip, count }))

  if (suspicious.length > 0) {
    const details = suspicious
      .sort((a, b) => b.count - a.count)
      .map(({ ip, count }) => `  - ${ip} (${count}회)`)
      .join('\n')

    const { error: notifyError } = await admin
      .from('admin_notifications')
      .insert({
        type: 'security_alert',
        title: '이상 로그인 시도 감지',
        body: `지난 1시간 동안 다음 IP에서 10회 이상 로그인 실패가 감지되었습니다:\n${details}`,
      })
    if (notifyError) {
      console.error('[cron/security-alert] notify insert failed:', notifyError.message)
    }
  }

  return NextResponse.json({
    suspicious_ips: suspicious.length,
    total_failures: failEvents?.length ?? 0,
  })
}
