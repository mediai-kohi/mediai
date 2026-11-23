'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { participantCodeStorageKey } from '@/lib/edu/participantStorage'

interface ValidContext {
  valid: true
  courseId: string
  courseTitle: string
  scheduleSummary: string | null
  expiresAt: string
}

interface InvalidContext {
  valid: false
  reason: 'not_found' | 'closed' | 'expired'
}

type ContextData = ValidContext | InvalidContext

const REASON_MESSAGE: Record<InvalidContext['reason'], string> = {
  not_found: '존재하지 않는 QR입니다.',
  closed: '만족도 조사가 종료되었습니다. 담당자에게 문의해주세요.',
  expired: '만족도 조사 가능 시간이 만료되었습니다. 담당자에게 새 QR을 요청해주세요.',
}

export default function SurveyEntry({ token }: { token: string }) {
  const router = useRouter()
  const [context, setContext] = useState<ContextData | null>(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    fetch(`/api/edu/s/${token}`)
      .then((r) => r.json())
      .then((data: ContextData) => {
        setContext(data)
        if (data.valid) {
          const saved = localStorage.getItem(participantCodeStorageKey(data.courseId))
          if (saved) setCode(saved)
        }
      })
      .catch(() => setContext({ valid: false, reason: 'not_found' }))
  }, [token])

  if (!context) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>
  }

  if (!context.valid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-700">{REASON_MESSAGE[context.reason]}</p>
        </div>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    router.push(`/edu/t/${trimmed}/survey`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <p className="text-xs text-gray-400 mb-1">만족도 조사</p>
          <h1 className="text-lg font-bold text-gray-900 mb-1">{context.courseTitle}</h1>
          {context.scheduleSummary && <p className="text-xs text-gray-400 mb-1">{context.scheduleSummary}</p>}

          <form onSubmit={handleSubmit} className="space-y-3 mt-4">
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
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              만족도 조사 응답하기
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
