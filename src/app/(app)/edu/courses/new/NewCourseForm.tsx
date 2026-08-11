'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface SessionDraft {
  label: string
  session_date: string
  checkpoint_start_enabled: boolean
  checkpoint_mid_enabled: boolean
  checkpoint_end_enabled: boolean
}

function newSessionDraft(index: number): SessionDraft {
  return {
    label: `${index + 1}회차`,
    session_date: '',
    checkpoint_start_enabled: true,
    checkpoint_mid_enabled: false,
    checkpoint_end_enabled: true,
  }
}

function CheckpointCheckboxes({ session, onChange }: { session: SessionDraft; onChange: (patch: Partial<SessionDraft>) => void }) {
  return (
    <div className="flex gap-3 mt-2">
      {([
        ['checkpoint_start_enabled', '시작'],
        ['checkpoint_mid_enabled', '중간'],
        ['checkpoint_end_enabled', '종료'],
      ] as const).map(([key, label]) => (
        <label key={key} className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={session[key]}
            onChange={(e) => onChange({ [key]: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {label}
        </label>
      ))}
    </div>
  )
}

export default function NewCourseForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState('')
  const [description, setDescription] = useState('')
  const [courseType, setCourseType] = useState<'single' | 'series'>('single')
  const [sessions, setSessions] = useState<SessionDraft[]>([newSessionDraft(0)])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const updateSession = (index: number, patch: Partial<SessionDraft>) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addSession = () => setSessions((prev) => [...prev, newSessionDraft(prev.length)])
  const removeSession = (index: number) => setSessions((prev) => prev.filter((_, i) => i !== index))

  const handleCourseTypeChange = (type: 'single' | 'series') => {
    setCourseType(type)
    if (type === 'single' && sessions.length > 1) {
      setSessions([sessions[0]])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    for (const s of sessions) {
      if (!s.checkpoint_start_enabled && !s.checkpoint_mid_enabled && !s.checkpoint_end_enabled) {
        setError(`${s.label}: 체크포인트를 최소 1개 이상 선택해주세요.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/edu/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          location,
          description,
          capacity: capacity === '' ? 0 : Number(capacity),
          course_type: courseType,
          sessions,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '처리 중 오류가 발생했습니다.')
        setSubmitting(false)
        return
      }
      router.push(`/edu/courses/${data.course.id}`)
    } catch {
      setError('처리 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 px-4 pt-4">
      <h1 className="text-lg font-bold text-gray-900 mb-4">과정 개설</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">과정명</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">정원 (비우면 무제한)</label>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">과정 유형</label>
          <div className="flex gap-2">
            {([['single', '단일 교육'], ['series', '다회차(장기) 과정']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleCourseTypeChange(value)}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  courseType === value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {courseType === 'single' ? '출석 체크포인트' : '회차 구성'}
            </label>
            {courseType === 'series' && (
              <button type="button" onClick={addSession} className="text-xs font-medium text-blue-600">
                + 회차 추가
              </button>
            )}
          </div>

          <div className="space-y-3">
            {sessions.map((session, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-3">
                {courseType === 'series' && (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={session.label}
                      onChange={(e) => updateSession(index, { label: e.target.value })}
                      placeholder="회차명"
                      className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    />
                    <input
                      type="date"
                      value={session.session_date}
                      onChange={(e) => updateSession(index, { session_date: e.target.value })}
                      className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    />
                    {sessions.length > 1 && (
                      <button type="button" onClick={() => removeSession(index)} className="text-gray-400 hover:text-red-500 px-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                <CheckpointCheckboxes session={session} onChange={(patch) => updateSession(index, patch)} />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm transition-colors"
        >
          {submitting ? '개설 중...' : '과정 개설하기'}
        </button>
      </form>
    </div>
  )
}
