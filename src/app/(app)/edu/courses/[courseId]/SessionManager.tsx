'use client'

import { useState } from 'react'
import type { EduSession } from './CourseDetail'

const CHECKPOINT_FIELDS = [
  ['checkpoint_start_enabled', '시작'],
  ['checkpoint_mid_enabled', '중간'],
  ['checkpoint_end_enabled', '종료'],
] as const

function CheckpointBadges({ session }: { session: EduSession }) {
  return (
    <div className="flex gap-1">
      {CHECKPOINT_FIELDS.filter(([key]) => session[key]).map(([key, label]) => (
        <span key={key} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">{label}</span>
      ))}
    </div>
  )
}

function SessionEditForm({ courseId, session, onDone }: { courseId: string; session: EduSession; onDone: () => void }) {
  const [label, setLabel] = useState(session.label)
  const [date, setDate] = useState(session.session_date ?? '')
  const [checkpoints, setCheckpoints] = useState({
    checkpoint_start_enabled: session.checkpoint_start_enabled,
    checkpoint_mid_enabled: session.checkpoint_mid_enabled,
    checkpoint_end_enabled: session.checkpoint_end_enabled,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!checkpoints.checkpoint_start_enabled && !checkpoints.checkpoint_mid_enabled && !checkpoints.checkpoint_end_enabled) {
      setError('체크포인트를 최소 1개 이상 선택해주세요.')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/edu/courses/${courseId}/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, session_date: date || null, ...checkpoints }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    onDone()
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="회차명"
          className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div className="flex gap-3">
        {CHECKPOINT_FIELDS.map(([key, label2]) => (
          <label key={key} className="flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={checkpoints[key]}
              onChange={(e) => setCheckpoints((prev) => ({ ...prev, [key]: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            {label2}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg">
          {saving ? '저장 중...' : '저장'}
        </button>
        <button onClick={onDone} className="text-xs text-gray-500 px-2">취소</button>
      </div>
    </div>
  )
}

export default function SessionManager({
  courseId, courseType, sessions, onChanged,
}: {
  courseId: string
  courseType: 'single' | 'series'
  sessions: EduSession[]
  onChanged: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newCheckpoints, setNewCheckpoints] = useState({
    checkpoint_start_enabled: true,
    checkpoint_mid_enabled: false,
    checkpoint_end_enabled: true,
  })
  const [addError, setAddError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!newCheckpoints.checkpoint_start_enabled && !newCheckpoints.checkpoint_mid_enabled && !newCheckpoints.checkpoint_end_enabled) {
      setAddError('체크포인트를 최소 1개 이상 선택해주세요.')
      return
    }
    const res = await fetch(`/api/edu/courses/${courseId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel || `${sessions.length + 1}회차`, session_date: newDate || null, ...newCheckpoints }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setAddError(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    setAdding(false)
    setNewLabel('')
    setNewDate('')
    setAddError('')
    onChanged()
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm('이 회차를 삭제하시겠습니까?')) return
    setBusyId(sessionId)
    const res = await fetch(`/api/edu/courses/${courseId}/sessions/${sessionId}`, { method: 'DELETE' })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    onChanged()
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div key={session.id} className="bg-white border border-gray-200 rounded-xl p-3">
          {editingId === session.id ? (
            <SessionEditForm courseId={courseId} session={session} onDone={() => { setEditingId(null); onChanged() }} />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{session.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{session.session_date || '날짜 미정'}</span>
                  <CheckpointBadges session={session} />
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setEditingId(session.id)} className="text-xs font-medium text-blue-600">수정</button>
                {courseType === 'series' && sessions.length > 1 && (
                  <button onClick={() => handleDelete(session.id)} disabled={busyId === session.id} className="text-xs font-medium text-red-500 disabled:opacity-50">삭제</button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {courseType === 'series' && (
        adding ? (
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex gap-2">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={`${sessions.length + 1}회차`}
                className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex gap-3 mt-2">
              {CHECKPOINT_FIELDS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-sm text-gray-600">
                  <input type="checkbox" checked={newCheckpoints[key]}
                    onChange={(e) => setNewCheckpoints((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  {label}
                </label>
              ))}
            </div>
            {addError && <p className="text-xs text-red-600 mt-2">{addError}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={handleAdd} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg">추가</button>
              <button onClick={() => setAdding(false)} className="text-xs text-gray-500 px-2">취소</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full text-sm font-medium text-blue-600 bg-white border border-dashed border-gray-300 rounded-xl py-2.5">
            + 회차 추가
          </button>
        )
      )}
    </div>
  )
}
