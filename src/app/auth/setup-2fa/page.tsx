'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'

type Step = 'loading' | 'qr' | 'verify' | 'done' | 'error'

export default function Setup2FAPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [factorId, setFactorId] = useState('')
  const [qrUri, setQrUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const enroll = async () => {
      const supabase = createClient()

      // 이전에 QR만 스캔하고 인증을 완료하지 않은 미인증 팩터가 남아있으면
      // 같은 friendly name("")으로 재등록을 시도할 때 충돌이 나므로 먼저 정리한다.
      const { data: existing } = await supabase.auth.mfa.listFactors()
      const unverified = existing?.all?.filter((f) => f.factor_type === 'totp' && f.status === 'unverified') ?? []
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error || !data) {
        setError(error?.message ?? 'OTP 설정 초기화에 실패했습니다.')
        setStep('error')
        return
      }
      setFactorId(data.id)
      setQrUri(data.totp.uri)
      setSecret(data.totp.secret)
      setStep('qr')
    }
    enroll()
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) { setError('6자리 코드를 입력하세요.'); return }
    setError('')
    setVerifying(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setVerifying(false)
    if (error) {
      setError('인증 코드가 올바르지 않습니다. 다시 시도하세요.')
      setCode('')
      return
    }
    setStep('done')
    setTimeout(() => router.replace('/'), 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">2단계 인증 설정</h1>
            <p className="mt-1 text-sm text-gray-500">보안을 위해 Google Authenticator 설정이 필요합니다.</p>
          </div>

          {step === 'loading' && (
            <div className="text-center py-8 text-sm text-gray-400">초기화 중...</div>
          )}

          {step === 'error' && (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button onClick={() => router.replace('/')} className="text-sm text-blue-600 hover:underline">
                홈으로 이동
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">2단계 인증이 활성화되었습니다.</p>
              <p className="text-xs text-gray-400 mt-1">잠시 후 이동합니다...</p>
            </div>
          )}

          {(step === 'qr' || step === 'verify') && (
            <div className="space-y-6">
              {/* Step 1: QR 스캔 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
                  <p className="text-sm font-medium text-gray-800">Google Authenticator 앱으로 QR 코드를 스캔하세요.</p>
                </div>
                <div className="flex justify-center bg-gray-50 rounded-xl p-5 border border-gray-100">
                  {qrUri && <QRCodeSVG value={qrUri} size={180} />}
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">QR 코드 스캔이 안 되나요? (수동 입력)</summary>
                  <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500 mb-1">앱에서 &quot;키 수동 입력&quot;을 선택 후 아래 코드를 입력하세요:</p>
                    <p className="font-mono text-xs text-gray-800 break-all">{secret}</p>
                  </div>
                </details>
              </div>

              {/* Step 2: 코드 확인 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
                  <p className="text-sm font-medium text-gray-800">앱에 표시된 6자리 코드를 입력하세요.</p>
                </div>
                <form onSubmit={handleVerify} className="space-y-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center font-mono text-2xl tracking-[0.4em] px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                  {error && <p className="text-xs text-red-600 text-center">{error}</p>}
                  <button
                    type="submit"
                    disabled={verifying || code.length !== 6}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition"
                  >
                    {verifying ? '확인 중...' : '인증 완료'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
