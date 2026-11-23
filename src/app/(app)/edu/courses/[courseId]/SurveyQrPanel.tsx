'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

const DEFAULT_DURATION_MIN = 60

interface SurveyWindow {
  id?: string
  token: string
  opened_at: string
  expires_at: string
  duration_minutes: number
}

function useRemainingMs(expiresAt: string | null) {
  const [remainingMs, setRemainingMs] = useState(() => (expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0))

  useEffect(() => {
    if (!expiresAt) { setRemainingMs(0); return }
    setRemainingMs(new Date(expiresAt).getTime() - Date.now())
    const timer = setInterval(() => setRemainingMs(new Date(expiresAt).getTime() - Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  return remainingMs
}

export default function SurveyQrPanel({ courseId }: { courseId: string }) {
  const [duration, setDuration] = useState(String(DEFAULT_DURATION_MIN))
  const [surveyWindow, setSurveyWindow] = useState<SurveyWindow | null>(null)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const remainingMs = useRemainingMs(surveyWindow?.expires_at ?? null)
  const isActive = !!surveyWindow && remainingMs > 0

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  const loadCurrentWindow = useCallback(async () => {
    const res = await fetch(`/api/edu/courses/${courseId}/survey-window`)
    if (!res.ok) return
    const data = await res.json()
    setSurveyWindow(data.window ?? null)
    setSubmittedCount(data.submittedCount ?? 0)
  }, [courseId])

  useEffect(() => {
    loadCurrentWindow()
  }, [loadCurrentWindow])

  useEffect(() => {
    stopPolling()
    if (isActive) {
      pollRef.current = setInterval(loadCurrentWindow, 5000)
    }
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive])

  const handleIssue = async () => {
    const durationMinutes = Number(duration)
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080) {
      setError('유효시간은 1~10080분(최대 7일) 사이의 숫자로 입력해주세요.')
      return
    }
    setIssuing(true)
    setError('')
    const res = await fetch(`/api/edu/courses/${courseId}/survey-window`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_minutes: durationMinutes }),
    })
    const data = await res.json().catch(() => ({}))
    setIssuing(false)
    if (!res.ok) {
      setError(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    setSurveyWindow(data.window)
  }

  const handleClose = async () => {
    await fetch(`/api/edu/courses/${courseId}/survey-window`, { method: 'DELETE' })
    setSurveyWindow(null)
    stopPolling()
  }

  const surveyUrl = surveyWindow && typeof window !== 'undefined' ? `${window.location.origin}/edu/s/${surveyWindow.token}` : ''
  const remainingMin = Math.max(0, Math.floor(remainingMs / 60000))
  const remainingSec = Math.max(0, Math.floor((remainingMs % 60000) / 1000))

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        수료 기준을 충족한 참가자만 만족도 조사에 응답할 수 있습니다. 아래에서 설문을 오픈하면 QR로 안내하거나 링크를 공유할 수 있습니다.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {!isActive && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">유효시간(분)</label>
            <input
              type="number"
              min={1}
              max={10080}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        {isActive && surveyWindow ? (
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-white rounded-lg border border-gray-100">
              <QRCodeCanvas value={surveyUrl} size={200} />
            </div>
            <p className="text-sm font-medium text-amber-600">남은 시간 {remainingMin}:{String(remainingSec).padStart(2, '0')}</p>
            <p className="text-sm text-gray-600">제출 완료 {submittedCount}명</p>
            <button onClick={handleClose} className="w-full text-sm font-medium text-gray-600 bg-gray-100 py-2.5 rounded-lg">
              지금 닫기
            </button>
          </div>
        ) : (
          <button
            onClick={handleIssue}
            disabled={issuing}
            className="w-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2.5 rounded-lg"
          >
            {issuing ? '발급 중...' : '만족도 설문 QR 발급'}
          </button>
        )}
      </div>
    </div>
  )
}
