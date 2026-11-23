'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import type { EduSession } from './CourseDetail'

type Checkpoint = 'start' | 'mid' | 'end'
const CHECKPOINT_LABEL: Record<Checkpoint, string> = { start: '시작', mid: '중간', end: '종료' }
const DEFAULT_DURATION_MIN = 10

interface CheckinWindow {
  id?: string
  token: string
  opened_at: string
  expires_at: string
  duration_minutes: number
}

interface ManualResult {
  code: string
  status: 'ok' | 'duplicate' | 'error'
  message: string
  at: number
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

export default function CheckinQrPanel({ courseId, sessions }: { courseId: string; sessions: EduSession[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 선택한 회차/체크포인트를 URL 쿼리(?session=&cp=)에 저장해, 모바일 브라우저의 백그라운드
  // 새로고침 등으로 화면이 리로드돼도 발급 중이던 QR 화면(같은 회차·체크포인트)이 그대로 복원되도록 한다.
  const [sessionId, setSessionIdState] = useState(() => {
    const fromUrl = searchParams.get('session')
    return fromUrl && sessions.some((s) => s.id === fromUrl) ? fromUrl : (sessions[0]?.id ?? '')
  })
  const [checkpoint, setCheckpointState] = useState<Checkpoint | ''>(() => {
    const fromUrl = searchParams.get('cp')
    return fromUrl && (['start', 'mid', 'end'] as const).includes(fromUrl as Checkpoint) ? (fromUrl as Checkpoint) : ''
  })
  const [duration, setDuration] = useState(String(DEFAULT_DURATION_MIN))

  const updateQuery = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router])

  const setSessionId = useCallback((id: string) => {
    setSessionIdState(id)
    updateQuery({ session: id })
  }, [updateQuery])

  const setCheckpoint = useCallback((cp: Checkpoint | '') => {
    setCheckpointState(cp)
    updateQuery({ cp: cp || null })
  }, [updateQuery])
  const [checkinWindow, setCheckinWindow] = useState<CheckinWindow | null>(null)
  const [checkedInCount, setCheckedInCount] = useState(0)
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualResults, setManualResults] = useState<ManualResult[]>([])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const session = sessions.find((s) => s.id === sessionId)
  const availableCheckpoints: Checkpoint[] = session
    ? (['start', 'mid', 'end'] as Checkpoint[]).filter((cp) => session[`checkpoint_${cp}_enabled` as keyof EduSession])
    : []

  const remainingMs = useRemainingMs(checkinWindow?.expires_at ?? null)
  const isActive = !!checkinWindow && remainingMs > 0

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  const loadCurrentWindow = useCallback(async (sid: string, cp: Checkpoint) => {
    const res = await fetch(`/api/edu/courses/${courseId}/sessions/${sid}/checkin-window?checkpoint=${cp}`)
    if (!res.ok) return
    const data = await res.json()
    setCheckinWindow(data.window ?? null)
    setCheckedInCount(data.checkedInCount ?? 0)
  }, [courseId])

  useEffect(() => {
    if (!availableCheckpoints.includes(checkpoint as Checkpoint)) {
      setCheckpoint(availableCheckpoints[0] ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    setCheckinWindow(null)
    setCheckedInCount(0)
    setManualResults([])
    stopPolling()
    if (sessionId && checkpoint) {
      loadCurrentWindow(sessionId, checkpoint as Checkpoint)
    }
  }, [sessionId, checkpoint, loadCurrentWindow, stopPolling])

  useEffect(() => {
    stopPolling()
    if (isActive && sessionId && checkpoint) {
      pollRef.current = setInterval(() => loadCurrentWindow(sessionId, checkpoint as Checkpoint), 5000)
    }
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sessionId, checkpoint])

  const handleIssue = async () => {
    if (!sessionId || !checkpoint) return
    const durationMinutes = Number(duration)
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
      setError('유효시간은 1~720분 사이의 숫자로 입력해주세요.')
      return
    }
    setIssuing(true)
    setError('')
    const res = await fetch(`/api/edu/courses/${courseId}/sessions/${sessionId}/checkin-window`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoint, duration_minutes: durationMinutes }),
    })
    const data = await res.json().catch(() => ({}))
    setIssuing(false)
    if (!res.ok) {
      setError(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    setCheckinWindow(data.window)
    setCheckedInCount(0)
  }

  const handleClose = async () => {
    if (!sessionId || !checkpoint) return
    await fetch(`/api/edu/courses/${courseId}/sessions/${sessionId}/checkin-window?checkpoint=${checkpoint}`, { method: 'DELETE' })
    setCheckinWindow(null)
    stopPolling()
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim().toUpperCase()
    if (!code || !sessionId || !checkpoint) return
    setManualSubmitting(true)
    try {
      const res = await fetch(`/api/edu/courses/${courseId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, checkpoint, participant_code: code }),
      })
      const data = await res.json().catch(() => ({}))
      const entry: ManualResult = res.ok
        ? { code, status: data.alreadyChecked ? 'duplicate' : 'ok', message: data.alreadyChecked ? '이미 처리됨' : '출석 처리 완료', at: Date.now() }
        : { code, status: 'error', message: data.error ?? '처리 실패', at: Date.now() }
      setManualResults((prev) => [entry, ...prev].slice(0, 30))
    } catch {
      const entry: ManualResult = { code, status: 'error', message: '네트워크 오류', at: Date.now() }
      setManualResults((prev) => [entry, ...prev].slice(0, 30))
    } finally {
      setManualSubmitting(false)
      setManualCode('')
    }
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">회차가 없습니다. 먼저 회차를 구성해주세요.</p>
  }

  const checkinUrl = checkinWindow && typeof window !== 'undefined' ? `${window.location.origin}/edu/c/${checkinWindow.token}` : ''
  const remainingMin = Math.max(0, Math.floor(remainingMs / 60000))
  const remainingSec = Math.max(0, Math.floor((remainingMs % 60000) / 1000))

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">회차 선택</label>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}{s.session_date ? ` (${s.session_date})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">체크포인트</label>
          <div className="flex gap-2">
            {availableCheckpoints.map((cp) => (
              <button
                key={cp}
                onClick={() => setCheckpoint(cp)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  checkpoint === cp ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {CHECKPOINT_LABEL[cp]}
              </button>
            ))}
          </div>
        </div>

        {!isActive && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">유효시간(분)</label>
            <input
              type="number"
              min={1}
              max={720}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        {isActive && checkinWindow ? (
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-white rounded-lg border border-gray-100">
              <QRCodeCanvas value={checkinUrl} size={200} />
            </div>
            <p className="text-sm font-medium text-amber-600">남은 시간 {remainingMin}:{String(remainingSec).padStart(2, '0')}</p>
            <p className="text-sm text-gray-600">체크인 완료 {checkedInCount}명</p>
            <button onClick={handleClose} className="w-full text-sm font-medium text-gray-600 bg-gray-100 py-2.5 rounded-lg">
              지금 닫기
            </button>
          </div>
        ) : (
          <button
            onClick={handleIssue}
            disabled={issuing || !checkpoint}
            className="w-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2.5 rounded-lg"
          >
            {issuing ? '발급 중...' : '체크인 QR 발급'}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-500 mb-2">참가자 코드 수동 처리 (폰이 없는 경우 등)</label>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="예: A3F9K2"
            disabled={!checkpoint}
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase disabled:opacity-50"
          />
          <button type="submit" disabled={!checkpoint || manualSubmitting || !manualCode}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            확인
          </button>
        </form>
      </div>

      {manualResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-medium text-gray-500 mb-2">수동 처리 기록</h3>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {manualResults.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-gray-700">{r.code}</span>
                <span className={
                  r.status === 'ok' ? 'text-green-600' : r.status === 'duplicate' ? 'text-amber-600' : 'text-red-600'
                }>{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
