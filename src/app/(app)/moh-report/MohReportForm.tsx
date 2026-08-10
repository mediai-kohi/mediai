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

interface ReportListItem {
  id: string
  period_label: string
  period_start: string
  period_end: string
  bio: { status: string; prev_week?: string; next_week?: string }
  ai: { status: string; prev_week?: string; next_week?: string }
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

// GhostTextarea: 직전 제출된 내용을 흐릿하게 자동 표시(참고용). 클릭해서 펼칠 필요 없이 빈 칸일 때 바로 보임
function GhostTextarea({
  value,
  onChange,
  onFocus,
  onKeyDown,
  ghostText,
  rows,
  placeholder,
  className,
  textareaRef,
}: {
  value: string
  onChange: (v: string) => void
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  ghostText?: string
  rows: number
  placeholder: string
  className: string
  textareaRef: (el: HTMLTextAreaElement | null) => void
}) {
  const [focused, setFocused] = useState(false)
  const showGhost = !focused && value === '' && !!ghostText?.trim()

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        rows={rows}
        placeholder={showGhost ? '' : placeholder}
        className={className}
      />
      {showGhost && (
        <div
          className="absolute inset-0 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap overflow-hidden pointer-events-none leading-5"
          style={{ opacity: 0.35 }}
        >
          {ghostText}
        </div>
      )}
    </div>
  )
}

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
  const [pastReports, setPastReports] = useState<ReportListItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [autoFillMsg, setAutoFillMsg] = useState('')

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
      const reportList: ReportListItem[] = Array.isArray(list) ? list : []
      setPastReports(reportList)
      const found = reportList.find((r) => r.period_start === periodStart)

      if (!found) {
        setRowId(null)
        // 새 주차: 아직 저장된 내용이 없으므로 부서별 직전 제출본을 실제 입력값으로 채워 바로 수정할 수 있게 함
        const editableSet = new Set(editableDepts(role, department))
        let filled = false
        const fillSection = (deptKey: MohDeptKey): SectionState => {
          if (!editableSet.has(deptKey)) return { ...blankSection }
          const prevRow = reportList.find((r) => r.period_start < periodStart && r[deptKey].status === 'submitted')
          if (!prevRow) return { ...blankSection }
          filled = true
          return { ...blankSection, prevWeek: prevRow[deptKey].prev_week ?? '', nextWeek: prevRow[deptKey].next_week ?? '' }
        }
        const nextSections = { bio: fillSection('bio'), ai: fillSection('ai') }
        setSections(nextSections)
        if (filled) {
          setAutoFillMsg('이전 제출 내용을 불러와 채웠습니다. 필요한 부분만 수정해서 사용하세요.')
          setTimeout(() => setAutoFillMsg(''), 6000)
        }
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
  }, [role, department])

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

  const jumpToPeriod = (periodStart: string) => {
    setWeeklyDate(periodStart)
    setHistoryOpen(false)
  }

  const submittedHistory = pastReports.filter(
    (r) => (r.bio.status === 'submitted' || r.ai.status === 'submitted') && r.period_start !== period.period_start
  )

  // 부서별 직전 제출본(현재 기간보다 이전이면서 제출완료된 것 중 가장 최근) — 목록은 이미 period_start desc 정렬됨
  const prevSubmittedByDept: Record<MohDeptKey, ReportListItem | undefined> = {
    bio: pastReports.find((r) => r.period_start < period.period_start && r.bio.status === 'submitted'),
    ai: pastReports.find((r) => r.period_start < period.period_start && r.ai.status === 'submitted'),
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

      {submittedHistory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>제출완료 자료 목록 ({submittedHistory.length})</span>
            <span className="text-gray-400">{historyOpen ? '▲' : '▼'}</span>
          </button>
          {historyOpen && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {submittedHistory.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => jumpToPeriod(r.period_start)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.period_label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.period_start} ~ {r.period_end}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.bio.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>바이오헬스</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.ai.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>의료AI</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {autoFillMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-600">{autoFillMsg}</div>
      )}

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-8">불러오는 중...</div>
      ) : (
        orderedDepartments.map((d) => {
          const sec = sections[d.key]
          const canEdit = editable.includes(d.key)
          const isMyDept = department === d.department
          const prevSubmission = prevSubmittedByDept[d.key]

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

              {canEdit && prevSubmission && (
                <p className="text-xs text-amber-600 bg-amber-50 border-b border-amber-100 px-4 py-1.5">
                  {!rowId
                    ? `※ ${prevSubmission.period_label} 제출 내용을 불러와 채웠습니다. 필요한 부분만 수정해서 사용하세요.`
                    : `※ ${prevSubmission.period_label} 제출 내용을 참고용으로 표시합니다.`}
                </p>
              )}

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
                        <GhostTextarea
                          textareaRef={(el) => { textareaRefs.current[textareaKey(d.key, cell)] = el }}
                          value={text}
                          onChange={(v) => setTextValue(d.key, cell, v)}
                          onFocus={handleTextareaFocus(d.key, cell)}
                          onKeyDown={handleTextareaKeyDown(d.key, cell)}
                          ghostText={cell === 'prev' ? prevSubmission?.[d.key].prev_week : prevSubmission?.[d.key].next_week}
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
