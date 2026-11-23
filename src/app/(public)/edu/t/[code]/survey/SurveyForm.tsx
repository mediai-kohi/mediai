'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Question {
  id: string
  label: string
  type: 'rating' | 'text'
  required: boolean
  sort_order: number
  scale_min_label?: string | null
  scale_max_label?: string | null
}

type AnswerMap = Record<string, { rating_value?: number; text_value?: string }>

function RatingInput({ value, onChange, minLabel, maxLabel }: {
  value?: number
  onChange: (v: number) => void
  minLabel?: string | null
  maxLabel?: string | null
}) {
  return (
    <div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors ${
              value === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[11px] text-gray-400">{minLabel}</span>
          <span className="text-[11px] text-gray-400">{maxLabel}</span>
        </div>
      )}
    </div>
  )
}

export default function SurveyForm({ code }: { code: string }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [attendanceOk, setAttendanceOk] = useState(true)
  const [windowOpen, setWindowOpen] = useState(true)
  const [attendancePercent, setAttendancePercent] = useState(0)
  const [threshold, setThreshold] = useState(80)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/edu/survey/${code}`)
      .then((r) => r.json())
      .then((data) => {
        setQuestions(data.questions ?? [])
        setEligible(data.eligible ?? false)
        setAttendanceOk(data.attendanceOk ?? false)
        setWindowOpen(data.windowOpen ?? false)
        setAttendancePercent(data.attendancePercent ?? 0)
        setThreshold(data.threshold ?? 80)
        setAlreadySubmitted(data.alreadySubmitted ?? false)
        setLoading(false)
      })
  }, [code])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    for (const q of questions) {
      if (!q.required) continue
      const a = answers[q.id]
      if (q.type === 'rating' && !a?.rating_value) {
        setError('필수 문항에 모두 응답해주세요.')
        return
      }
      if (q.type === 'text' && !a?.text_value?.trim()) {
        setError('필수 문항에 모두 응답해주세요.')
        return
      }
    }

    setSubmitting(true)
    const res = await fetch(`/api/edu/survey/${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: Object.entries(answers).map(([question_id, v]) => ({ question_id, ...v })),
      }),
    })
    setSubmitting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    setDone(true)
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>
  }

  if (!eligible || alreadySubmitted || done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-700">
            {done ? '만족도 조사에 응답해주셔서 감사합니다.'
              : alreadySubmitted ? '이미 만족도 조사에 응답하셨습니다.'
              : !attendanceOk ? `출석률(${attendancePercent}%)이 수료 기준(${threshold}%)에 미달하여 만족도 조사에 응답할 수 없습니다.`
              : !windowOpen ? '담당자가 아직 만족도 조사를 열지 않았습니다. 잠시 후 다시 시도해주세요.'
              : '만족도 조사에 응답할 수 없습니다.'}
          </p>
          {done || alreadySubmitted ? (
            <Link
              href={`/edu/t/${code}`}
              className="block w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              수료증 발급받기
            </Link>
          ) : (
            <Link href={`/edu/t/${code}`} className="inline-block mt-4 text-sm text-blue-600 font-medium">확인증으로 돌아가기</Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-lg font-bold text-gray-900 mb-1">만족도 조사</h1>
          <p className="text-xs text-gray-400 mb-6">소중한 의견을 남겨주세요.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {questions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  {q.label}{q.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {q.type === 'rating' ? (
                  <RatingInput
                    value={answers[q.id]?.rating_value}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: { rating_value: v } }))}
                    minLabel={q.scale_min_label}
                    maxLabel={q.scale_max_label}
                  />
                ) : (
                  <textarea
                    value={answers[q.id]?.text_value ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { text_value: e.target.value } }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  />
                )}
              </div>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {submitting ? '제출 중...' : '제출하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
