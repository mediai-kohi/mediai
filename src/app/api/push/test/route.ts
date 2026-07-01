import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/notifications/push'

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await sendPushNotification(user.id, {
      title: '테스트 알림',
      body: '푸시 알림이 정상적으로 수신되었습니다.',
      url: '/',
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
