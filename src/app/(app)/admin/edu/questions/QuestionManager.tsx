'use client'

import { useEffect, useState } from 'react'

interface Question {
  id: string
  label: string
  type: 'rating' | 'text'
  required: boolean
  sort_order: number
  is_active: boolean
}

export default function QuestionManager() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<'rating' | 'text'>('rating')
  const [newRequired, setNewRequired] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/edu/admin/questions')
    const data = await res.json()
    setQuestions(data.questions ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const activeQuestions = questions.filter((q) => q.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const inactiveQuestions = questions.filter((q) => !q.is_active)

  const handleAdd = async () => {
    const label = newLabel.trim()
    if (!label) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/edu/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, type: newType, required: newRequired }),
    })
    setAdding(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    setNewLabel('')
    load()
  }

  const patchQuestion = async (id: string, patch: Partial<Question>) => {
    await fetch(`/api/edu/admin/questions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    load()
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= activeQuestions.length) return
    const reordered = [...activeQuestions]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    await fetch('/api/edu/admin/questions/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((q) => q.id) }),
    })
    load()
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {activeQuestions.length === 0 ? (
          <p className="text-sm text-gray-400 p-4">등록된 문항이 없습니다.</p>
        ) : (
          activeQuestions.map((q, index) => (
            <div key={q.id} className="p-3 flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(index, -1)} disabled={index === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 h-4">▲</button>
                <button onClick={() => move(index, 1)} disabled={index === activeQuestions.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30 h-4">▼</button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{q.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">{q.type === 'rating' ? '평점형' : '서술형'}</span>
                  {q.required && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px]">필수</span>}
                </div>
              </div>
              <button onClick={() => patchQuestion(q.id, { is_active: false })} className="text-xs text-red-500 flex-shrink-0">비활성화</button>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">문항 추가</h2>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="문항 내용"
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
        />
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {([['rating', '평점형'], ['text', '서술형']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setNewType(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${newType === value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto">
            <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            필수
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={handleAdd} disabled={adding || !newLabel.trim()}
          className="w-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2 rounded-lg">
          {adding ? '추가 중...' : '문항 추가'}
        </button>
      </div>

      {inactiveQuestions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          <p className="text-xs text-gray-400 p-3">비활성화된 문항</p>
          {inactiveQuestions.map((q) => (
            <div key={q.id} className="p-3 flex items-center gap-2 opacity-60">
              <p className="text-sm text-gray-700 flex-1 truncate">{q.label}</p>
              <button onClick={() => patchQuestion(q.id, { is_active: true })} className="text-xs text-blue-600 flex-shrink-0">다시 활성화</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
