import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

interface SubscribeBody {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

interface UnsubscribeBody {
  endpoint: string
}

export async function POST(request: Request): Promise<NextResponse | Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(user.id, 'push-subscribe', 20)
  if (!rl.allowed) return rateLimitResponse(rl)

  const body = await request.json().catch(() => null) as SubscribeBody | null
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // endpoint는 브라우저가 발급하는 HTTPS URL
  if (!body.endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 동일 사용자의 기존 구독만 제거 후 재삽입 (다른 사용자 구독 침범 방지)
  await admin.from('push_subscriptions').delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id)

  const { error } = await admin.from('push_subscriptions').insert({
    user_id: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  })

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as UnsubscribeBody | null
  if (!body?.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
