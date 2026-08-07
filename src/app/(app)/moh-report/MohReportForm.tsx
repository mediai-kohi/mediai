'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MOH_DEPARTMENTS, calcMohWeeklyPeriod, editableDepts, type MohDeptKey } from '@/lib/mohWeeklyReport'

const BULLET_MARK = '• '

interface AttachmentInfo {
  id: string
  filename: string
  size: number
}

interface PendingFile {
  path: string
  filename: string
  size: number
}

interface SectionState {
  prevWeek: string
  nextWeek: string
  status: 'draft' | 'submitted'
  prevAttachments: AttachmentInfo[]
  nextAttachments: AttachmentInfo[]
  pendingPrevFiles: PendingFile[]
  pendingNextFiles: PendingFile[]
  removeIds: string[]
  available: boolean
}

const blankSection: SectionState = {
  prevWeek: '',
  nextWeek: '',
  status: 'draft',
  prevAttachments: [],
  nextAttachments: [],
  pendingPrevFiles: [],
  pendingNextFiles: [],
  removeIds: [],
  available: true,
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const MAX_SIZE = 10 * 1024 * 1024

export default function MohReportForm({ role, department }: { role: string; department: string | null }) {
  const [weeklyDate, setWeeklyDate] = useState(todayStr())
  const [rowId, setRowId] = useState<string | null>(null)
  const [sections, setSections] = useState<Record<MohDeptKey, SectionState>>({
    bio: { ...blankSection },
    ai: { ...blankSection },
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savingDept, setSavingDept] = useState<MohDeptKey | null>(null)

  const period = calcMohWeeklyPeriod(weeklyDate)
  const editable = editableDepts(role, department)
  // 내 부서 카드가 맨 위로 오도록 정렬
  const orderedDepartments = department
    ? [...MOH_DEPARTMENTS].sort((a, b) => Number(b.department === department) - Number(a.department === department))
    : MOH_DEPARTMENTS

  const loadForPeriod = useCallback(async (periodStart: string) => {
    setLoading(true)
    setError('')
    try {
      const listRes = await fetch('/api/moh-weekly-reports')
      const list = await listRes.json()
      const found = Array.isArray(list) ? list.find((r: { period_start: string; id: string }) => r.period_start === periodStart) : null

      if (!found) {
        setRowId(null)
        setSections({ bio: { ...blankSection }, ai: { ...blankSection } })
        return
      }

      setRowId(found.id)
      const detailRes = await fetch(`/api/moh-weekly-reports/${found.id}`)
      if (!detailRes.ok) throw new Error()
      const detail = await detailRes.json()

      const toSection = (d: { status: string; prev_week?: string; next_week?: string; prev_attachments?: AttachmentInfo[]; next_attachments?: AttachmentInfo[]; available?: boolean }): SectionState => ({
        prevWeek: d.prev_week ?? '',
        nextWeek: d.next_week ?? '',
        status: d.status as 'draft' | 'submitted',
        prevAttachments: d.prev_attachments ?? [],
        nextAttachments: d.next_attachments ?? [],
        pendingPrevFiles: [],
        pendingNextFiles: [],
        removeIds: [],
        available: d.available !== false,
      })

      setSections({ bio: toSection(detail.bio), ai: toSection(detail.ai) })
    } catch {
      setError('불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadForPeriod(period.period_start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.period_start])

  const updateSection = (dept: MohDeptKey, patch: Partial<SectionState>) => {
    setSections((prev) => ({ ...prev, [dept]: { ...prev[dept], ...patch } }))
  }

  const setTextValue = (dept: MohDeptKey, cell: 'prev' | 'next', value: string) => {
    updateSection(dept, cell === 'prev' ? { prevWeek: value } : { nextWeek: value })
  }

  // textarea에서 Enter로 줄바꿈 시 자동으로 "• " 표시를 붙여주되, 사용자가 직접 지울 수 있도록 일반 텍스트로 삽입
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const textareaKey = (dept: MohDeptKey, cell: 'prev' | 'next') => `${dept}-${cell}`

  const setCaret = (dept: MohDeptKey, cell: 'prev' | 'next', pos: number) => {
    requestAnimationFrame(() => {
      const el = textareaRefs.current[textareaKey(dept, cell)]
      if (el) el.setSelectionRange(pos, pos)
    })
  }

  const handleTextareaFocus = (dept: MohDeptKey, cell: 'prev' | 'next') => (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (e.target.value !== '') return
    setTextValue(dept, cell, BULLET_MARK)
    setCaret(dept, cell, BULLET_MARK.length)
  }

  const handleTextareaKeyDown = (dept: MohDeptKey, cell: 'prev' | 'next') => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const target = e.currentTarget
    const { selectionStart, selectionEnd, value } = target
    const insertion = `\n${BULLET_MARK}`
    const newValue = value.slice(0, selectionStart) + insertion + value.slice(selectionEnd)
    setTextValue(dept, cell, newValue)
    setCaret(dept, cell, selectionStart + insertion.length)
  }

  const handleFileChange = async (dept: MohDeptKey, cell: 'prev' | 'next', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const oversized = files.filter((f) => f.size > MAX_SIZE)
    if (oversized.length > 0) {
      setError(`파일 용량 초과: ${oversized.map((f) => f.name).join(', ')} — 파일당 10MB 이하만 첨부 가능합니다.`)
      return
    }

    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        const key = cell === 'prev' ? 'pendingPrevFiles' : 'pendingNextFiles'
        setSections((prev) => ({ ...prev, [dept]: { ...prev[dept], [key]: [...prev[dept][key], { path: data.path, filename: data.filename, size: data.size }] } }))
      } else {
        setError(data.error ?? '파일 업로드 실패')
      }
    }
  }

  const removePendingFile = (dept: MohDeptKey, cell: 'prev' | 'next', idx: number) => {
    const key = cell === 'prev' ? 'pendingPrevFiles' : 'pendingNextFiles'
    setSections((prev) => ({ ...prev, [dept]: { ...prev[dept], [key]: prev[dept][key].filter((_, i) => i !== idx) } }))
  }

  const removeExistingFile = (dept: MohDeptKey, cell: 'prev' | 'next', id: string) => {
    const key = cell === 'prev' ? 'prevAttachments' : 'nextAttachments'
    setSections((prev) => ({
      ...prev,
      [dept]: {
        ...prev[dept],
        [key]: prev[dept][key].filter((f) => f.id !== id),
        removeIds: [...prev[dept].removeIds, id],
      },
    }))
  }

  const handleSave = async (dept: MohDeptKey, status: 'draft' | 'submitted') => {
    setSavingDept(dept)
    setError('')
    const sec = sections[dept]
    try {
      const res = await fetch('/api/moh-weekly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_label: period.period_label,
          period_start: period.period_start,
          period_end: period.period_end,
          department: dept,
          prev_week: sec.prevWeek,
          next_week: sec.nextWeek,
          status,
          addAttachments: [
            ...sec.pendingPrevFiles.map((f) => ({ ...f, cell: 'prev' as const })),
            ...sec.pendingNextFiles.map((f) => ({ ...f, cell: 'next' as const })),
          ],
          removeAttachmentIds: sec.removeIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '저장 중 오류가 발생했습니다.')
        return
      }
      await loadForPeriod(period.period_start)
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSavingDept(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h1 className="text-lg font-bold text-gray-900 mb-1">보건복지부 주간업무보고</h1>
        <p className="text-xs text-gray-500 mb-3">담당 부서 섹션만 작성할 수 있습니다. 제출하면 즉시 보건복지부 계정에 공개됩니다.</p>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">이번주(실적 대상) 기준일</label>
          <input
            type="date"
            value={weeklyDate}
            onChange={(e) => setWeeklyDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">지난 주차를 아직 작성하지 않았다면, 날짜를 이전으로 선택해 그 주차부터 순서대로 작성할 수 있습니다.</p>
        <p className="text-sm font-medium text-gray-800 mt-2">{period.period_label}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-8">불러오는 중...</div>
      ) : (
        orderedDepartments.map((d) => {
          const sec = sections[d.key]
          const canEdit = editable.includes(d.key)
          const isMyDept = department === d.department

          return (
            <div key={d.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{d.majorCategory}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {d.department} {isMyDept && <span className="text-blue-600 text-xs ml-1">(내 부서)</span>}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sec.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {sec.status === 'submitted' ? '제출완료' : '작성중'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                {(['prev', 'next'] as const).map((cell) => {
                  const label = cell === 'prev' ? `이번주(${period.period_short_label}) 추진 실적` : `다음주(${period.next_period_label}) 추진 계획`
                  const text = cell === 'prev' ? sec.prevWeek : sec.nextWeek
                  const existingFiles = cell === 'prev' ? sec.prevAttachments : sec.nextAttachments
                  const pendingFiles = cell === 'prev' ? sec.pendingPrevFiles : sec.pendingNextFiles

                  return (
                    <div key={cell} className="p-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2">{label}</p>
                      {canEdit ? (
                        <textarea
                          ref={(el) => { textareaRefs.current[textareaKey(d.key, cell)] = el }}
                          value={text}
                          onChange={(e) => setTextValue(d.key, cell, e.target.value)}
                          onFocus={handleTextareaFocus(d.key, cell)}
                          onKeyDown={handleTextareaKeyDown(d.key, cell)}
                          rows={6}
                          placeholder="클릭하면 자동으로 · 표시가 생깁니다. 필요 없는 줄은 표시를 지우고 작성하세요"
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-y"
                        />
                      ) : (
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          {text.trim() ? text : <span className="text-gray-300">(작성된 내용 없음)</span>}
                        </div>
                      )}

                      <div className="mt-2 space-y-1.5">
                        {existingFiles.map((f) => (
                          <div key={f.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                            <a href={`/api/attachments/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex-1 truncate">
                              [별첨] {f.filename}
                            </a>
                            <span className="text-[10px] text-gray-400">{formatSize(f.size)}</span>
                            {canEdit && (
                              <button type="button" onClick={() => removeExistingFile(d.key, cell, f.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                            )}
                          </div>
                        ))}
                        {canEdit && pendingFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                            <span className="text-xs text-gray-700 flex-1 truncate">{f.filename}</span>
                            <span className="text-[10px] text-gray-400">{formatSize(f.size)}</span>
                            <button type="button" onClick={() => removePendingFile(d.key, cell, i)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                          </div>
                        ))}
                      </div>

                      {canEdit && (
                        <label className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:underline">
                          <input type="file" className="hidden" onChange={(e) => handleFileChange(d.key, cell, e)} />
                          + 별첨파일 첨부
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>

              {canEdit && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={savingDept === d.key}
                    onClick={() => handleSave(d.key, 'draft')}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    임시저장
                  </button>
                  {sec.status === 'submitted' ? (
                    <button
                      type="button"
                      disabled={savingDept === d.key}
                      onClick={() => handleSave(d.key, 'draft')}
                      className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                    >
                      제출 취소
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={savingDept === d.key}
                      onClick={() => handleSave(d.key, 'submitted')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingDept === d.key ? '제출 중...' : '제출'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {rowId && (
        <div className="text-right">
          <a href={`/moh-weekly-report/${rowId}/print`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
            PDF로 인쇄 미리보기 →
          </a>
        </div>
      )}
    </div>
  )
}
