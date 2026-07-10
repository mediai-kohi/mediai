import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: Date
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number = 60 * 60 * 1000
): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - windowMs).toISOString()
  const resetAt = new Date(Date.now() + windowMs)

  const { count, error: countError } = await admin
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', since)

  if (countError) {
    console.error('[rate-limit] count error:', countError)
    return { allowed: true, remaining: limit, limit, resetAt }
  }

  const used = count ?? 0
  if (used >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt }
  }

  const { error: insertError } = await admin
    .from('rate_limit_log')
    .insert({ user_id: userId, endpoint })

  if (insertError) {
    console.error('[rate-limit] insert error:', insertError)
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - used - 1),
    limit,
    resetAt,
  }
}

// IP + 계정 기반 로그인 실패 제한 (로그인 라우트용)
// 성공한 로그인은 카운트하지 않으며, 같은 IP라도 계정이 다르면 서로 영향을 주지 않는다.
export async function checkLoginRateLimit(
  ip: string,
  userCode: string,
  limit = 5,
  windowMs = 5 * 60 * 1000
): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - windowMs).toISOString()

  const { data: attempts, error: countError } = await admin
    .from('login_attempt_log')
    .select('created_at')
    .eq('ip_address', ip)
    .eq('user_code', userCode)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (countError) {
    console.error('[rate-limit] login count error:', countError)
    return { allowed: true, remaining: limit, limit, resetAt: new Date(Date.now() + windowMs) }
  }

  const used = attempts?.length ?? 0
  if (used >= limit) {
    // 가장 오래된 시도가 창을 벗어나는 시점이 곧 해제 시점이다.
    const oldest = new Date(attempts[0].created_at)
    return { allowed: false, remaining: 0, limit, resetAt: new Date(oldest.getTime() + windowMs) }
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - used),
    limit,
    resetAt: new Date(Date.now() + windowMs),
  }
}

// 로그인 실패 시에만 호출하여 실패 횟수를 기록한다.
export async function recordLoginFailure(ip: string, userCode: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('login_attempt_log').insert({ ip_address: ip, user_code: userCode })

  if (error) {
    console.error('[rate-limit] login failure insert error:', error)
  }
}

export function rateLimitResponse(result: RateLimitResult): Response {
  const secondsLeft = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))
  const minutesLeft = Math.max(1, Math.ceil(secondsLeft / 60))

  return new Response(
    JSON.stringify({
      error: `요청 한도를 초과했습니다. ${minutesLeft}분 후 다시 시도해주세요.`,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
        'Retry-After': String(secondsLeft),
      },
    }
  )
}
