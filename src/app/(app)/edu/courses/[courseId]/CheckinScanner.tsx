'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import type { EduSession } from './CourseDetail'

type Checkpoint = 'start' | 'mid' | 'end'
const CHECKPOINT_LABEL: Record<Checkpoint, string> = { start: '시작', mid: '중간', end: '종료' }

function extractParticipantCode(scanned: string): string {
  const marker = '/edu/t/'
  const idx = scanned.indexOf(marker)
  if (idx === -1) return scanned.trim().toUpperCase()
  const rest = scanned.slice(idx + marker.length)
  return rest.split(/[/?#]/)[0].trim().toUpperCase()
}

interface ScanResult {
  code: string
  status: 'ok' | 'duplicate' | 'error'
  message: string
  at: number
}

export default function CheckinScanner({ courseId, sessions }: { courseId: string; sessions: EduSession[] }) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '')
  const [checkpoint, setCheckpoint] = useState<Checkpoint | ''>('')
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [results, setResults] = useState<ScanResult[]>([])
  const [submitting, setSubmitting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })

  const session = sessions.find((s) => s.id === sessionId)
  const availableCheckpoints: Checkpoint[] = session
    ? (['start', 'mid', 'end'] as Checkpoint[]).filter((cp) => session[`checkpoint_${cp}_enabled` as keyof EduSession])
    : []

  useEffect(() => {
    if (!availableCheckpoints.includes(checkpoint as Checkpoint)) {
      setCheckpoint(availableCheckpoints[0] ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const submitCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase()
    if (!code || !sessionId || !checkpoint) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/edu/courses/${courseId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, checkpoint, participant_code: code }),
      })
      const data = await res.json().catch(() => ({}))
      const entry: ScanResult = res.ok
        ? { code, status: data.alreadyChecked ? 'duplicate' : 'ok', message: data.alreadyChecked ? '이미 처리됨' : '출석 처리 완료', at: Date.now() }
        : { code, status: 'error', message: data.error ?? '처리 실패', at: Date.now() }
      setResults((prev) => [entry, ...prev].slice(0, 30))
    } catch {
      const entry: ScanResult = { code, status: 'error', message: '네트워크 오류', at: Date.now() }
      setResults((prev) => [entry, ...prev].slice(0, 30))
    } finally {
      setSubmitting(false)
    }
  }, [courseId, sessionId, checkpoint])

  const tick = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          const participantCode = extractParticipantCode(code.data)
          const now = Date.now()
          const isDuplicateScan = lastScanRef.current.code === participantCode && now - lastScanRef.current.at < 2500
          if (!isDuplicateScan) {
            lastScanRef.current = { code: participantCode, at: now }
            submitCode(participantCode)
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [submitCode])

  const startScanning = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setCameraError('카메라를 사용할 수 없습니다. 아래 수동 입력을 이용해주세요.')
    }
  }

  const stopScanning = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopScanning(), [stopScanning])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitCode(manualCode)
    setManualCode('')
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-gray-500">회차가 없습니다. 먼저 회차를 구성해주세요.</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">회차 선택</label>
          <select
            value={sessionId}
            onChange={(e) => { stopScanning(); setSessionId(e.target.value) }}
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
                onClick={() => { stopScanning(); setCheckpoint(cp) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  checkpoint === cp ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {CHECKPOINT_LABEL[cp]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {scanning ? (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-square max-w-sm mx-auto">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={stopScanning} className="w-full text-sm font-medium text-gray-600 bg-gray-100 py-2.5 rounded-lg">
              스캔 중지
            </button>
          </div>
        ) : (
          <button
            onClick={startScanning}
            disabled={!checkpoint}
            className="w-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2.5 rounded-lg"
          >
            카메라로 QR 스캔 시작
          </button>
        )}
        {cameraError && <p className="text-xs text-amber-600 mt-2">{cameraError}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-500 mb-2">참가자 코드 수동 입력</label>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="예: A3F9K2"
            disabled={!checkpoint}
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm uppercase disabled:opacity-50"
          />
          <button type="submit" disabled={!checkpoint || submitting || !manualCode}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            확인
          </button>
        </form>
      </div>

      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-medium text-gray-500 mb-2">최근 처리 기록</h3>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
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
