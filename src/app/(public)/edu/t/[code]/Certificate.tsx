'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface SessionStatus {
  id: string
  label: string
  session_date: string | null
  checkpoints: { start: boolean; mid: boolean; end: boolean }
}

interface StatusData {
  course: { title: string; location: string }
  registeredAt: string
  sessions: SessionStatus[]
  attendance: { session_id: string; checkpoint: string; checked_at: string }[]
  completed: boolean
  surveySubmitted: boolean
}

const CHECKPOINT_LABEL: Record<'start' | 'mid' | 'end', string> = { start: '시작', mid: '중간', end: '종료' }

export default function Certificate({ code }: { code: string }) {
  const [data, setData] = useState<StatusData | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/edu/status/${code}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return }
        setData(await res.json())
      })
      .catch(() => setNotFound(true))
  }, [code])

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-600">존재하지 않는 참가자 코드입니다.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>
  }

  const hasAttended = (sessionId: string, checkpoint: string) =>
    data.attendance.some((a) => a.session_id === sessionId && a.checkpoint === checkpoint)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-xs text-gray-400 mb-4">참가 확인증</p>

          <div className="p-3 bg-white rounded-lg border border-gray-100 inline-block">
            <QRCodeSVG value={pageUrl} size={160} />
          </div>
          <p className="mt-3 text-lg font-mono font-bold text-gray-900 tracking-widest">{code}</p>
          <p className="text-xs text-gray-400 mt-1">이 화면을 저장하거나 즐겨찾기 해주세요. 이 코드가 참여 확인의 유일한 수단입니다.</p>

          <div className="mt-5 pt-5 border-t border-gray-100 text-left">
            <h2 className="text-sm font-semibold text-gray-900">{data.course.title}</h2>
            {data.course.location && <p className="text-xs text-gray-400">{data.course.location}</p>}

            <div className="mt-3 space-y-2">
              {data.sessions.map((s) => {
                const cps = (Object.keys(s.checkpoints) as ('start' | 'mid' | 'end')[]).filter((cp) => s.checkpoints[cp])
                return (
                  <div key={s.id} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-gray-700">{s.label}</p>
                    <div className="flex gap-1.5 mt-1">
                      {cps.map((cp) => (
                        <span
                          key={cp}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            hasAttended(s.id, cp) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {CHECKPOINT_LABEL[cp]} {hasAttended(s.id, cp) ? '완료' : '대기'}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-gray-100">
            {data.completed ? (
              data.surveySubmitted ? (
                <p className="text-sm text-green-600 font-medium">수료 완료 · 만족도 조사 제출됨</p>
              ) : (
                <Link
                  href={`/edu/t/${code}/survey`}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                >
                  만족도 조사 응답하기
                </Link>
              )
            ) : (
              <p className="text-sm text-gray-400">모든 회차 출석을 완료하면 만족도 조사에 응답할 수 있습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
