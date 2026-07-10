'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Verify2FAPage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    // 로그인 직후 진입한 경우에만 통과시키고, 새로고침/새 창으로 직접 접근하면 로그인 화면으로 되돌린다.
    // 미완료 상태(aal1)의 세션이 남아있으면 /auth/login이 즉시 '/'로 되돌려보내
    // 다시 2FA로 리다이렉트되는 루프가 생기므로, 세션 자체를 로그아웃시켜야 한다.
    const fromLogin = sessionStorage.getItem('eduops_from_login')
    sessionStorage.removeItem('eduops_from_login')
    if (!fromLogin) {
      createClient().auth.signOut().finally(() => router.replace('/auth/login'))
      return
    }

    const init = async () => {
      const supabase = createClient()
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]
      if (!totpFactor) {
        router.replace('/auth/setup-2fa')
        return
      }
      setFactorId(totpFactor.id)

      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (challengeErr || !challenge) {
        setError('인증 초기화에 실패했습니다. 다시 로그인해주세요.')
        setLoading(false)
        return
      }
      setChallengeId(challenge.id)
      setLoading(false)
    }
    init()
  }, [router])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) { setError('6자리 코드를 입력하세요.'); return }
    setError('')
    setVerifying(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
    setVerifying(false)
    if (error) {
      setError('인증 코드가 올바르지 않습니다. 다시 시도하세요.')
      setCode('')
      return
    }
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3.75h3" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">2단계 인증</h1>
            <p className="mt-1 text-sm text-gray-500">Google Authenticator 앱의 6자리 코드를 입력하세요.</p>
          </div>

          {loading ? (
            <div className="text-center py-6 text-sm text-gray-400">초기화 중...</div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                disabled={verifying}
                className="w-full text-center font-mono text-2xl tracking-[0.4em] px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                autoFocus
                autoComplete="one-time-code"
              />
              {error && <p className="text-xs text-red-600 text-center">{error}</p>}
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition"
              >
                {verifying ? '확인 중...' : '인증'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
