'use client'

import { useEffect, useState, useRef } from 'react'

interface Org {
  id: string
  name: string
  created_at: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace(/\.$/, '')
}

function EditableRow({ org, onSaved, onDeleted }: {
  org: Org
  onSaved: (id: string, name: string) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(org.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    const trimmed = value.trim()
    if (!trimmed) { setValue(org.name); setEditing(false); return }
    if (trimmed === org.name) { setEditing(false); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      onSaved(org.id, trimmed)
      setEditing(false)
    } else {
      setError(data.error ?? '저장 실패')
      setValue(org.name)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`'${org.name}' 기관을 삭제하시겠습니까?`)) return
    setDeleting(true)
    const res = await fetch(`/api/admin/organizations/${org.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) onDeleted(org.id)
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') { setValue(org.name); setEditing(false) }
            }}
            className="w-full text-sm border border-blue-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
        ) : (
          <span
            className="text-sm text-gray-800 cursor-pointer hover:underline decoration-dashed underline-offset-2"
            onClick={() => setEditing(true)}
            title="클릭하여 이름 변경"
          >
            {org.name}
          </span>
        )}
        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(org.created_at)}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleDelete}
          disabled={deleting || saving}
          className="px-2.5 py-1 border border-red-300 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
        >
          {deleting ? '삭제 중...' : '삭제'}
        </button>
      </td>
    </tr>
  )
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchOrgs = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/organizations')
    const data = await res.json()
    setOrgs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchOrgs() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setAddError('')
    const res = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setAdding(false)
    if (res.ok) {
      setOrgs(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))
      setNewName('')
      inputRef.current?.focus()
    } else {
      setAddError(data.error ?? '추가 실패')
    }
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">기관 관리</h1>

      {/* 기관 추가 폼 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">새 기관 추가</h2>
        </div>
        <form onSubmit={handleAdd} className="px-4 py-4 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={e => { setNewName(e.target.value); setAddError('') }}
            placeholder="기관명 입력"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {adding ? '추가 중...' : '추가'}
          </button>
        </form>
        {addError && <p className="px-4 pb-3 text-xs text-red-500">{addError}</p>}
      </div>

      {/* 기관 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">등록된 기관</h2>
          <span className="text-xs text-gray-400">{orgs.length}개</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">기관명</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">등록일</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
            ) : orgs.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">등록된 기관이 없습니다.</td></tr>
            ) : orgs.map(org => (
              <EditableRow
                key={org.id}
                org={org}
                onSaved={(id, name) => setOrgs(prev => prev.map(o => o.id === id ? { ...o, name } : o).sort((a, b) => a.name.localeCompare(b.name, 'ko')))}
                onDeleted={(id) => setOrgs(prev => prev.filter(o => o.id !== id))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
