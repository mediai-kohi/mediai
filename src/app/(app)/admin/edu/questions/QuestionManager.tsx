'use client'

import { useEffect, useRef, useState } from 'react'

interface Question {
  id: string
  label: string
  type: 'rating' | 'text'
  required: boolean
  sort_order: number
  is_active: boolean
}

function QuestionEditForm({ question, onSaved, onCancel }: {
  question: Question
  onSaved: (patch: Partial<Question>) => Promise<void>
  onCancel: () => void
}) {
  const [label, setLabel] = useState(question.label)
  const [type, setType] = useState<'rating' | 'text'>(question.type)
  const [required, setRequired] = useState(question.required)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    const trimmed = label.trim()
    if (!trimmed) {
      setError('문항 내용을 입력해주세요.')
      return
    }
    setSaving(true)
    setError('')
    await onSaved({ label: trimmed, type, required })
    setSaving(false)
  }

  return (
    <div className="flex-1 space-y-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
      />
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {([['rating', '평점형'], ['text', '서술형']] as const).map(([value, l]) => (
            <button key={value} type="button" onClick={() => setType(value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${type === value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          필수
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg">
          {saving ? '저장 중...' : '저장'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-500 px-2">취소</button>
      </div>
    </div>
  )
}

export default function QuestionManager() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<'rating' | 'text'>('rating')
  const [newRequired, setNewRequired] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const load = async () => {
    const res = await fetch('/api/edu/admin/questions')
    const data = await res.json()
    const list: Question[] = data.questions ?? []
    setQuestions(list)
    setOrderedIds(list.filter((q) => q.is_active).sort((a, b) => a.sort_order - b.sort_order).map((q) => q.id))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const questionById = new Map(questions.map((q) => [q.id, q]))
  const activeQuestions = orderedIds.map((id) => questionById.get(id)).filter((q): q is Question => !!q)
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
    await load()
  }

  const persistOrder = async (ids: string[]) => {
    await fetch('/api/edu/admin/questions/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }

  const handleDragStart = (index: number) => {
    dragIndex.current = index
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragOverIndex !== index) setDragOverIndex(index)
  }

  const handleDrop = (index: number) => {
    const from = dragIndex.current
    dragIndex.current = null
    setDragOverIndex(null)
    if (from === null || from === index) return

    const reordered = [...orderedIds]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(index, 0, moved)
    setOrderedIds(reordered)
    persistOrder(reordered)
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {activeQuestions.length === 0 ? (
          <p className="text-sm text-gray-400 p-4">등록된 문항이 없습니다.</p>
        ) : (
          activeQuestions.map((q, index) => (
            <div
              key={q.id}
              draggable={editingId !== q.id}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => { dragIndex.current = null; setDragOverIndex(null) }}
              className={`p-3 flex items-start gap-2 transition-colors ${dragOverIndex === index ? 'bg-blue-50' : ''}`}
            >
              <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none pt-1" title="드래그해서 순서 변경">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                </svg>
              </span>

              {editingId === q.id ? (
                <QuestionEditForm
                  question={q}
                  onCancel={() => setEditingId(null)}
                  onSaved={async (patch) => { await patchQuestion(q.id, patch); setEditingId(null) }}
                />
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{q.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">{q.type === 'rating' ? '평점형' : '서술형'}</span>
                      {q.required && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px]">필수</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setEditingId(q.id)} className="text-xs font-medium text-blue-600">수정</button>
                    <button onClick={() => patchQuestion(q.id, { is_active: false })} className="text-xs text-red-500">비활성화</button>
                  </div>
                </>
              )}
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
