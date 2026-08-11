'use client'

import { useEffect, useState } from 'react'

interface SessionRef {
  id: string
  label: string
  checkpoint_start_enabled: boolean
  checkpoint_mid_enabled: boolean
  checkpoint_end_enabled: boolean
}

interface Participant {
  id: string
  participant_code: string
  registered_at: string
  completed: boolean
  surveySubmitted: boolean
  averageRating: number | null
  attendance: { session_id: string; checkpoint: string }[]
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ParticipantList({ courseId }: { courseId: string }) {
  const [sessions, setSessions] = useState<SessionRef[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/edu/courses/${courseId}/participants`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(data.sessions ?? [])
        setParticipants(data.participants ?? [])
        setLoading(false)
      })
  }, [courseId])

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">불러오는 중...</div>
  if (participants.length === 0) return <p className="text-sm text-gray-500 py-8 text-center">아직 신청자가 없습니다.</p>

  const hasAttended = (p: Participant, sessionId: string, checkpoint: string) =>
    p.attendance.some((a) => a.session_id === sessionId && a.checkpoint === checkpoint)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
            <th className="px-3 py-2 font-medium">코드</th>
            <th className="px-3 py-2 font-medium">신청시각</th>
            {sessions.map((s) => (
              <th key={s.id} className="px-3 py-2 font-medium whitespace-nowrap">{s.label}</th>
            ))}
            <th className="px-3 py-2 font-medium">수료</th>
            <th className="px-3 py-2 font-medium">만족도</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr key={p.id} className="border-b border-gray-50 last:border-0">
              <td className="px-3 py-2 font-mono text-gray-700">{p.participant_code}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDateTime(p.registered_at)}</td>
              {sessions.map((s) => {
                const cps = (['start', 'mid', 'end'] as const).filter((cp) => s[`checkpoint_${cp}_enabled` as keyof SessionRef])
                return (
                  <td key={s.id} className="px-3 py-2">
                    <div className="flex gap-1">
                      {cps.map((cp) => (
                        <span
                          key={cp}
                          title={cp}
                          className={`w-2 h-2 rounded-full ${hasAttended(p, s.id, cp) ? 'bg-green-500' : 'bg-gray-200'}`}
                        />
                      ))}
                    </div>
                  </td>
                )
              })}
              <td className="px-3 py-2">
                {p.completed
                  ? <span className="text-green-600 font-medium">수료</span>
                  : <span className="text-gray-400">미수료</span>}
              </td>
              <td className="px-3 py-2 text-gray-700">
                {p.surveySubmitted ? (p.averageRating != null ? p.averageRating.toFixed(1) : '제출') : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
