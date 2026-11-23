'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { participantCodeStorageKey } from '@/lib/edu/participantStorage'

interface ValidContext {
  valid: true
  courseId: string
  courseTitle: string
  sessionLabel: string
  sessionDate: string | null
  checkpoint: string
  checkpointLabel: string
  expiresAt: string
}

interface InvalidContext {
  valid: false
  reason: 'not_found' | 'closed' | 'expired'
}

type ContextData = ValidContext | InvalidContext

const REASON_MESSAGE: Record<InvalidContext['reason'], string> = {
  not_found: '존재하지 않는 QR입니다.',
  closed: '체크인이 종료되었습니다. 담당자에게 문의해주세요.',
  expired: '체크인 가능 시간이 만료되었습니다. 담당자에게 새 QR을 요청해주세요.',
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export default function CheckinForm({ token }: { token: string }) {
  const [context, setContext] = useState<ContextData | null>(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [autoChecking, setAutoChecking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<'ok' | 'duplicate' | null>(null)
  const autoTriedRef = useRef(false)

  const submitCode = useCallback(async (courseId: string, rawCode: string) => {
    const trimmed = rawCode.trim().toUpperCase()
    if (!trimmed) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/edu/c/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? '처리 중 오류가 발생했습니다.')
        setAutoChecking(false)
        return
      }
      localStorage.setItem(participantCodeStorageKey(courseId), trimmed)
      setResult(data.alreadyChecked ? 'duplicate' : 'ok')
    } finally {
      setSubmitting(false)
    }
  }, [token])

  useEffect(() => {
    fetch(`/api/edu/c/${token}`)
      .then((r) => r.json())
      .then((data: ContextData) => {
        setContext(data)
        if (data.valid) {
          const saved = localStorage.getItem(participantCodeStorageKey(data.courseId))
          if (saved) {
            setCode(saved)
            if (!autoTriedRef.current) {
              autoTriedRef.current = true
              setAutoChecking(true)
              submitCode(data.courseId, saved)
            }
          }
        }
      })
      .catch(() => setContext({ valid: false, reason: 'not_found' }))
  }, [token, submitCode])

  const now = useNow(1000)
  const remainingMs = context?.valid ? new Date(context.expiresAt).getTime() - now : Infinity
  const expired = context?.valid && remainingMs <= 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!context?.valid) return
    if (!code.trim()) {
      setError('참가자 코드를 입력해주세요.')
      return
    }
    submitCode(context.courseId, code)
  }

  if (!context) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>
  }

  if (!context.valid || expired) {
    const reason = context.valid ? 'expired' : context.reason
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-700">{REASON_MESSAGE[reason]}</p>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-700">
            {result === 'duplicate' ? '이미 체크인 처리되었습니다.' : '출석 체크가 완료되었습니다.'}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {context.courseTitle}{context.sessionDate ? ` (${context.sessionDate})` : ''} · {context.sessionLabel} · {context.checkpointLabel}
          </p>
        </div>
      </div>
    )
  }

  if (autoChecking && submitting && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-700">체크인 처리 중입니다...</p>
        </div>
      </div>
    )
  }

  const remainingMin = Math.max(0, Math.floor(remainingMs / 60000))
  const remainingSec = Math.max(0, Math.floor((remainingMs % 60000) / 1000))

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <p className="text-xs text-gray-400 mb-1">출석 체크</p>
          <h1 className="text-lg font-bold text-gray-900 mb-1">{context.courseTitle}</h1>
          {context.sessionDate && <p className="text-xs text-gray-400 mb-1">{context.sessionDate}</p>}
          <p className="text-sm text-gray-500 mb-4">{context.sessionLabel} · {context.checkpointLabel}</p>
          <p className="text-xs text-amber-600 mb-6">남은 시간 {remainingMin}:{String(remainingSec).padStart(2, '0')}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">참가자 코드</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: A3F9K2"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase tracking-widest text-center font-mono"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {submitting ? '처리 중...' : '체크인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
