'use client'

import { useEffect, useState } from 'react'

interface QuestionStat {
  id: string
  label: string
  type: 'rating' | 'text'
  average?: number | null
  distribution?: number[]
  responseCount?: number
  responses?: string[]
}

interface DashboardData {
  registrationCount: number
  completedCount: number
  surveyResponseCount: number
  averageRating: number | null
  questionStats: QuestionStat[]
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

export default function CourseDashboard({ courseId }: { courseId: string }) {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch(`/api/edu/courses/${courseId}/dashboard`)
      .then((r) => r.json())
      .then(setData)
  }, [courseId])

  if (!data) return <div className="text-sm text-gray-400 py-8 text-center">불러오는 중...</div>

  const maxDist = (dist: number[]) => Math.max(1, ...dist)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="신청인원" value={`${data.registrationCount}명`} />
        <StatCard label="수료인원" value={`${data.completedCount}명`} />
        <StatCard label="만족도 응답" value={`${data.surveyResponseCount}명`} />
        <StatCard label="평균 만족도" value={data.averageRating != null ? data.averageRating.toFixed(2) : '-'} />
      </div>

      <div className="space-y-3">
        {data.questionStats.map((q) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">{q.label}</p>
            {q.type === 'rating' ? (
              q.responseCount === 0 ? (
                <p className="text-xs text-gray-400">아직 응답이 없습니다.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">평균 {q.average?.toFixed(2)}점 · 응답 {q.responseCount}건</p>
                  <div className="space-y-1">
                    {(q.distribution ?? []).map((count, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-6">{i + 1}점</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / maxDist(q.distribution ?? [])) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              (q.responses ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">아직 응답이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {(q.responses ?? []).map((text, i) => (
                    <li key={i} className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{text}</li>
                  ))}
                </ul>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
