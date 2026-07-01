'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────
// 첨부파일 유틸
// ─────────────────────────────────────────────────
interface PendingFile { path: string; filename: string; size: number }
interface ExistingFile { id: string; filename: string; size: number }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
import { useRouter } from 'next/navigation'
import ReportPreviewModal from './ReportPreviewModal'
import {
  ReportMode,
  WeeklyContent,
  KPI_LABELS, ACTIVITY_LABELS,
  calcRate, calcBudgetRow, calcBudgetSubtotal, fmtNum,
  defaultWeekly,
} from './report-types'

// ─────────────────────────────────────────────────
// 날짜 유틸
// ─────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekOfMonth(monday: Date): number {
  return Math.ceil(monday.getDate() / 7)
}

function calcWeeklyPeriod(weeklyDate: string) {
  const monday = getMondayOfWeek(new Date(weeklyDate + 'T00:00:00'))
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const week = getWeekOfMonth(monday)
  return {
    period_label: `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${week}주차 (${monday.getMonth() + 1}.${monday.getDate()}.~${sunday.getMonth() + 1}.${sunday.getDate()}.)`,
    period_start: toDateStr(monday),
    period_end:   toDateStr(sunday),
    monday,
  }
}

/** 해당 연월에 속하는 주(월요일이 해당 월인 주만) 목록 반환 */
function getWeeksInMonth(year: number, month: number): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = []
  let monday = new Date(year, month - 1, 1)
  while (monday.getDay() !== 1) {
    monday.setDate(monday.getDate() + 1)
  }
  let weekNum = 1
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  while (monday.getFullYear() === year && monday.getMonth() + 1 === month) {
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    result.push({ value: toDateStr(monday), label: `${weekNum}주차 (${fmt(monday)}~${fmt(sunday)})` })
    weekNum++
    monday = new Date(monday)
    monday.setDate(monday.getDate() + 7)
  }
  return result
}

function getWeekHeaders(monday: Date) {
  const thisEnd   = new Date(monday); thisEnd.setDate(monday.getDate() + 6)
  const nextStart = new Date(monday); nextStart.setDate(monday.getDate() + 7)
  const nextEnd   = new Date(monday); nextEnd.setDate(monday.getDate() + 13)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return {
    thisWeek: `이번주 실적 (${fmt(monday)}~${fmt(thisEnd)})`,
    nextWeek: `다음주 계획 (${fmt(nextStart)}~${fmt(nextEnd)})`,
  }
}

function isPastDeadline(periodEnd: string) {
  return new Date().toISOString().split('T')[0] > periodEnd
}

// ─────────────────────────────────────────────────
// 로컬스토리지 키
// ─────────────────────────────────────────────────
const LS_KEY_NEW = 'eduops_report_new_v2'
const lsKeyEdit = (id: string) => `eduops_report_edit_v2_${id}`

// ─────────────────────────────────────────────────
// 소수점 포함 숫자 표시 (정수 부분만 천단위 콤마)
// ─────────────────────────────────────────────────
function formatDecimalDisplay(value: string): string {
  if (!value) return ''
  const parts = value.split('.')
  const intPart = parseInt(parts[0] || '0', 10)
  const intFormatted = isNaN(intPart) ? '' : intPart.toLocaleString('ko-KR')
  if (parts.length > 1) return `${intFormatted}.${parts[1]}`
  return intFormatted
}

// ─────────────────────────────────────────────────
// NumInput: 천단위 콤마 자동 표시 숫자 입력
// ─────────────────────────────────────────────────
function NumInput({
  value,
  onChange,
  className,
  placeholder = '0',
  decimal = false,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  decimal?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const display = focused
    ? value
    : value
      ? decimal ? formatDecimalDisplay(value) : Number(value).toLocaleString('ko-KR')
      : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (decimal) {
      let raw = e.target.value.replace(/[^0-9.]/g, '')
      const dotIdx = raw.indexOf('.')
      if (dotIdx !== -1) {
        const intPart = raw.slice(0, dotIdx)
        const decPart = raw.slice(dotIdx + 1).replace(/\./g, '').slice(0, 1)
        raw = intPart + '.' + decPart
      }
      onChange(raw)
    } else {
      onChange(e.target.value.replace(/[^0-9]/g, ''))
    }
  }

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className={className}
    />
  )
}

// GhostNumInput: 이전 값을 흐릿하게 표시, 입력 시 사라짐
// ─────────────────────────────────────────────────
function GhostNumInput({
  value,
  onChange,
  ghostValue,
  className,
  decimal = false,
}: {
  value: string
  onChange: (v: string) => void
  ghostValue?: string
  className?: string
  decimal?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const display = focused
    ? value
    : value
      ? decimal ? formatDecimalDisplay(value) : Number(value).toLocaleString('ko-KR')
      : ''
  const showGhost = !focused && value === '' && !!ghostValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (decimal) {
      let raw = e.target.value.replace(/[^0-9.]/g, '')
      const dotIdx = raw.indexOf('.')
      if (dotIdx !== -1) {
        const intPart = raw.slice(0, dotIdx)
        const decPart = raw.slice(dotIdx + 1).replace(/\./g, '').slice(0, 1)
        raw = intPart + '.' + decPart
      }
      onChange(raw)
    } else {
      onChange(e.target.value.replace(/[^0-9]/g, ''))
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={display}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={showGhost ? '' : '0'}
        className={className}
      />
      {showGhost && (
        <div
          className="absolute inset-0 flex items-center justify-center text-xs tabular-nums pointer-events-none select-none"
          style={{ opacity: 0.35 }}
        >
          {decimal ? formatDecimalDisplay(ghostValue!) : Number(ghostValue).toLocaleString('ko-KR')}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────
// GhostTextarea: 이전 보고서 내용을 흐릿하게 표시
// ─────────────────────────────────────────────────
function GhostTextarea({
  value,
  onChange,
  ghostText,
  rows = 3,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  ghostText?: string
  rows?: number
  placeholder?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const showGhost = !focused && value === '' && !!ghostText

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={rows}
        placeholder={showGhost ? '' : placeholder}
        className={`w-full resize-none ${className ?? ''}`}
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

// ─────────────────────────────────────────────────
// SectionCard: 섹션 카드 래퍼
// ─────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────
// 셀 스타일
// ─────────────────────────────────────────────────
const TH_BASE = 'border border-gray-300 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-600'
const TD_BASE = 'border border-gray-300 px-2 py-1 text-xs text-gray-800'

const KPI_HINTS: Record<string, string> = {
  '홍보(건)': '월 1회 이상',
  '수료율(%)': '수료인원/참여인원',
  '만족도 점수(점)': '100점 만점 기준',
  '지역확산(%)': '수도권 이외 지역의료기관 참여인원 비중',
}

// ─────────────────────────────────────────────────
// WeeklyFormBody
// ─────────────────────────────────────────────────
function WeeklyFormBody({
  value,
  onChange,
  prev,
  weeklyDate,
  mode,
}: {
  value: WeeklyContent
  onChange: (v: WeeklyContent) => void
  prev?: WeeklyContent
  weeklyDate: string
  mode: ReportMode
}) {
  const [autoFillMsg, setAutoFillMsg] = useState('')
  const autoFillDone = useRef(false)

  // 이전 주간보고 내용 자동입력 (create 모드, 빈 폼일 때)
  useEffect(() => {
    if (mode !== 'create' || autoFillDone.current || !prev) return
    const isEmpty = value.kpi_rows.every(r => !r.target)
    if (!isEmpty) { autoFillDone.current = true; return }
    autoFillDone.current = true
    onChange({
      ...value,
      kpi_rows: value.kpi_rows.map((r, i) => ({
        ...r,
        target: prev.kpi_rows[i]?.target ?? r.target,
        note: r.note || (prev.kpi_rows[i]?.note ?? ''),
      })),
      activity_rows: value.activity_rows.map((r, i) => ({
        ...r,
        current_week: r.current_week || (prev.activity_rows[i]?.current_week ?? ''),
        next_week: r.next_week || (prev.activity_rows[i]?.next_week ?? ''),
        note: r.note || (prev.activity_rows[i]?.note ?? ''),
      })),
      budget: {
        operator_gov: {
          budget: value.budget.operator_gov.budget || prev.budget?.operator_gov?.budget || '',
          executed: value.budget.operator_gov.executed,
        },
        operator_self: {
          budget: value.budget.operator_self.budget || prev.budget?.operator_self?.budget || '',
          executed: value.budget.operator_self.executed,
        },
      },
      budget_plan: value.budget_plan || prev.budget_plan || '',
    })
    setAutoFillMsg('이전 주간보고 내용을 불러왔습니다.')
    setTimeout(() => setAutoFillMsg(''), 6000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, prev])

  const monday = getMondayOfWeek(new Date(weeklyDate + 'T00:00:00'))
  const { thisWeek, nextWeek } = getWeekHeaders(monday)

  const setKpi = (i: number, patch: Partial<typeof value.kpi_rows[0]>) =>
    onChange({ ...value, kpi_rows: value.kpi_rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) })

  const setActivity = (i: number, patch: Partial<typeof value.activity_rows[0]>) =>
    onChange({ ...value, activity_rows: value.activity_rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) })

  const setBudget = (key: keyof typeof value.budget, patch: Partial<typeof value.budget.operator_gov>) =>
    onChange({ ...value, budget: { ...value.budget, [key]: { ...value.budget[key], ...patch } } })

  const opGov  = calcBudgetRow(value.budget.operator_gov)
  const opSelf = calcBudgetRow(value.budget.operator_self)
  const total  = calcBudgetSubtotal(value.budget.operator_gov, value.budget.operator_self)

  const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white'
  const readonlyCls = 'w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600 cursor-default'
  const numCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white tabular-nums'
  const autoNumCls = 'w-full px-2 py-1.5 bg-gray-50 text-xs text-center tabular-nums text-gray-600 cursor-default'
  const textareaCls = 'w-full px-3 py-2 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none leading-relaxed'

  return (
    <div className="space-y-4">
      {/* ── 1. 수행기관 정보 ── */}
      <SectionCard title="1. 수행기관 정보">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className={`${TH_BASE} w-36 text-center`}>기관명</td>
                <td className={TD_BASE}>
                  <input readOnly value={value.org_info.operator} className={readonlyCls} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── 2. 성과지표 달성 현황 ── */}
      <SectionCard title="2. 성과지표 달성 현황">
        {autoFillMsg && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1.5 mb-3">
            ✓ {autoFillMsg}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} w-28 text-center`}>지표명</th>
                <th className={`${TH_BASE} w-24 text-center`}>연간목표(A)</th>
                <th className={`${TH_BASE} w-24 text-center`}>누적실적(B)</th>
                <th className={`${TH_BASE} w-20 text-center`}>달성률</th>
                <th className={`${TH_BASE} w-28 text-center`}>비고</th>
              </tr>
            </thead>
            <tbody>
              {KPI_LABELS.map((label, i) => {
                const row = value.kpi_rows[i]
                const prevRow = prev?.kpi_rows[i]
                const isManpower = label === '전문인력 양성(명)'
                const isProgram = label === '프로그램 개발·운영(과정수)'
                return (
                  <tr key={label}>
                    <td className={`${TH_BASE} text-center font-medium`}>
                      <div>{label}</div>
                      {KPI_HINTS[label] && <div className="text-[10px] font-normal text-gray-400 mt-0.5">{KPI_HINTS[label]}</div>}
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      {isProgram ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-6 flex-shrink-0 text-right">개발</span>
                          <NumInput
                            value={row.target}
                            onChange={(v) => setKpi(i, { target: v })}
                            className={numCls}
                            placeholder={prevRow?.target ? fmtNum(prevRow.target) : '0'}
                            decimal
                          />
                        </div>
                      ) : (
                        <NumInput
                          value={row.target}
                          onChange={(v) => setKpi(i, { target: v })}
                          className={numCls}
                          placeholder={prevRow?.target ? fmtNum(prevRow.target) : '0'}
                          decimal
                        />
                      )}
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      {isManpower ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 w-8 flex-shrink-0 text-right">수료</span>
                            <GhostNumInput
                              value={row.actual}
                              onChange={(v) => setKpi(i, { actual: v })}
                              ghostValue={prevRow?.actual}
                              className={numCls}
                              decimal
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 w-8 flex-shrink-0 text-right">교육중</span>
                            <GhostNumInput
                              value={row.actual_sub ?? ''}
                              onChange={(v) => setKpi(i, { actual_sub: v })}
                              ghostValue={prevRow?.actual_sub}
                              className={numCls}
                              decimal
                            />
                          </div>
                        </div>
                      ) : isProgram ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-6 flex-shrink-0 text-right">운영</span>
                          <GhostNumInput
                            value={row.actual}
                            onChange={(v) => setKpi(i, { actual: v })}
                            ghostValue={prevRow?.actual}
                            className={numCls}
                            decimal
                          />
                        </div>
                      ) : (
                        <GhostNumInput
                          value={row.actual}
                          onChange={(v) => setKpi(i, { actual: v })}
                          ghostValue={prevRow?.actual}
                          className={numCls}
                          decimal
                        />
                      )}
                    </td>
                    <td className={`${TD_BASE} text-center font-semibold text-blue-600 tabular-nums`}>
                      {calcRate(row.target, row.actual)}
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <input
                        type="text"
                        value={row.note ?? ''}
                        onChange={(e) => setKpi(i, { note: e.target.value })}
                        placeholder="비고 입력"
                        className={inputCls}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── 3. 주간 실적 및 계획 ── */}
      <SectionCard title="3. 주간 실적 및 계획">
        {prev && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-3">
            ※ 지난주 리포트 내용을 참고용으로 표시합니다.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} w-20 text-center`}>구분</th>
                <th className={`${TH_BASE} text-center`}>{thisWeek}</th>
                <th className={`${TH_BASE} text-center`}>{nextWeek}</th>
                <th className={`${TH_BASE} w-24 text-center`}>비고</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITY_LABELS.map((label, i) => {
                const row = value.activity_rows[i]
                const prevRow = prev?.activity_rows[i]
                return (
                  <tr key={label}>
                    <td className={`${TH_BASE} text-center font-medium`}>{label}</td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <GhostTextarea
                        value={row.current_week}
                        onChange={(v) => setActivity(i, { current_week: v })}
                        ghostText={prevRow?.current_week}
                        rows={3}
                        placeholder="이번주 실적 입력"
                        className={textareaCls}
                      />
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <GhostTextarea
                        value={row.next_week}
                        onChange={(v) => setActivity(i, { next_week: v })}
                        ghostText={prevRow?.next_week}
                        rows={3}
                        placeholder="다음주 계획 입력"
                        className={textareaCls}
                      />
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <textarea
                        value={row.note}
                        onChange={(e) => setActivity(i, { note: e.target.value })}
                        rows={3}
                        placeholder="비고"
                        className={textareaCls}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── 4. 예산 집행현황 ── */}
      <SectionCard title="4. 예산 집행현황">
        <div className="overflow-x-auto mb-3">
          <table className="w-full border-collapse table-fixed min-w-[480px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} w-24 text-center`}>구분</th>
                <th className={`${TH_BASE} text-center`}>예산</th>
                <th className={`${TH_BASE} text-center`}>집행액</th>
                <th className={`${TH_BASE} text-center`}>집행잔액</th>
                <th className={`${TH_BASE} w-16 text-center`}>집행률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TH_BASE} text-center`}>국고보조금</td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_gov.budget} onChange={(v) => setBudget('operator_gov', { budget: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_gov.executed} onChange={(v) => setBudget('operator_gov', { executed: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className={autoNumCls}>{opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} text-center font-medium text-blue-600`}>{opGov.rate}</td>
              </tr>
              <tr>
                <td className={`${TH_BASE} text-center`}>자기부담금</td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_self.budget} onChange={(v) => setBudget('operator_self', { budget: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_self.executed} onChange={(v) => setBudget('operator_self', { executed: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className={autoNumCls}>{opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} text-center font-medium text-blue-600`}>{opSelf.rate}</td>
              </tr>
              <tr className="bg-blue-50">
                <td className={`${TH_BASE} text-center font-bold text-blue-700`}>합계</td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className="w-full px-2 py-1.5 bg-blue-50 text-xs text-center tabular-nums font-semibold text-blue-700">{total.budget ? total.budget.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className="w-full px-2 py-1.5 bg-blue-50 text-xs text-center tabular-nums font-semibold text-blue-700">{total.executed ? total.executed.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className="w-full px-2 py-1.5 bg-blue-50 text-xs text-center tabular-nums font-semibold text-blue-700">{total.budget ? total.remaining.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} text-center font-bold text-blue-700`}>{total.rate}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">향후예산 활용계획</label>
          <GhostTextarea
            value={value.budget_plan}
            onChange={(v) => onChange({ ...value, budget_plan: v })}
            ghostText={prev?.budget_plan}
            rows={3}
            placeholder="향후예산 활용계획을 입력하세요"
            className={textareaCls}
          />
        </div>
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────
interface UserProfile {
  organization: string
}

interface ReportFormProps {
  mode: ReportMode
  reportId?: string
  initialWeeklyDate?: string
  initialWeeklyContent?: WeeklyContent
  forceAllowSubmit?: boolean
  userProfile: UserProfile
  existingReports?: { id: string; type: string; period_start: string }[]
  initialAttachments?: ExistingFile[]
}

// ─────────────────────────────────────────────────
// Main ReportForm
// ─────────────────────────────────────────────────
export default function ReportForm({
  mode,
  reportId,
  initialWeeklyDate,
  initialWeeklyContent,
  forceAllowSubmit = false,
  userProfile,
  existingReports,
  initialAttachments = [],
}: ReportFormProps) {
  const router = useRouter()
  const today = new Date()
  const defaultMonday = getMondayOfWeek(today)

  const [weeklyDate, setWeeklyDate] = useState(initialWeeklyDate ?? toDateStr(defaultMonday))
  const [weeklyDisplayYear, setWeeklyDisplayYear] = useState(() => {
    const d = new Date((initialWeeklyDate ?? toDateStr(defaultMonday)) + 'T00:00:00')
    return d.getFullYear()
  })
  const [weeklyDisplayMonth, setWeeklyDisplayMonth] = useState(() => {
    const d = new Date((initialWeeklyDate ?? toDateStr(defaultMonday)) + 'T00:00:00')
    return d.getMonth() + 1
  })

  const [weekly, setWeekly] = useState<WeeklyContent>(
    initialWeeklyContent ?? defaultWeekly(userProfile.organization)
  )

  const [prevWeekly, setPrevWeekly] = useState<WeeklyContent | undefined>()
  const [prevLabel, setPrevLabel] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileError, setFileError] = useState('')
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [restored, setRestored] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [dupReportId, setDupReportId] = useState<string | null>(null)

  // ── 첨부파일
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>(initialAttachments)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    e.target.value = ''
    const MAX = 10 * 1024 * 1024
    const oversized = selected.filter(f => f.size > MAX)
    if (oversized.length > 0) {
      setFileError(`파일 용량 초과: ${oversized.map(f => `"${f.name}" (${(f.size / (1024 * 1024)).toFixed(1)}MB)`).join(', ')} — 파일당 10MB 이하만 첨부 가능합니다.`)
      return
    }
    setFileError('')
    setUploading(true)
    for (const file of selected) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setPendingFiles(prev => [...prev, { path: data.path, filename: data.filename, size: data.size }])
      } else {
        setError(data.error ?? '파일 업로드 실패')
      }
    }
    setUploading(false)
  }

  const removeExisting = (id: string) => {
    setExistingFiles(prev => prev.filter(f => f.id !== id))
    setRemovedIds(prev => [...prev, id])
  }

  const removePending = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lsKey = mode === 'create' ? LS_KEY_NEW : (reportId ? lsKeyEdit(reportId) : LS_KEY_NEW)

  // ── 복원 프롬프트 (create 모드)
  useEffect(() => {
    if (mode === 'create' && localStorage.getItem(lsKey)) {
      setShowRestorePrompt(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 30초 자동저장
  useEffect(() => {
    const save = () => {
      const draft = { weeklyDate, weekly }
      localStorage.setItem(lsKey, JSON.stringify(draft))
    }
    autoSaveTimer.current = setInterval(save, 30000)
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current) }
  }, [weeklyDate, weekly, lsKey])

  // ── 이전 보고서 불러오기 (기간 변경 시)
  const fetchPrev = useCallback(async (before: string) => {
    try {
      const res = await fetch(`/api/reports/previous?type=weekly&before=${before}`)
      if (!res.ok) { setPrevWeekly(undefined); return }
      const data = await res.json()
      if (!data) { setPrevWeekly(undefined); return }
      setPrevLabel(data.period_label ?? '')
      if (data.content?.version === 2) {
        setPrevWeekly(data.content as WeeklyContent)
      } else {
        setPrevWeekly(undefined)
      }
    } catch {
      setPrevWeekly(undefined)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'create') return
    const { period_start } = calcWeeklyPeriod(weeklyDate)
    fetchPrev(period_start)
  }, [mode, weeklyDate, fetchPrev])

  // ── 중복 보고서 감지 (create 모드)
  useEffect(() => {
    if (mode !== 'create' || !existingReports) return
    const { period_start } = calcWeeklyPeriod(weeklyDate)
    const found = existingReports.find(r => r.type === 'weekly' && r.period_start === period_start)
    setDupReportId(found?.id ?? null)
  }, [mode, weeklyDate, existingReports])

  const handleRestore = () => {
    const saved = localStorage.getItem(lsKey)
    if (!saved) return
    try {
      const d = JSON.parse(saved)
      if (d.weeklyDate) {
        setWeeklyDate(d.weeklyDate)
        const wd = new Date(d.weeklyDate + 'T00:00:00')
        setWeeklyDisplayYear(wd.getFullYear())
        setWeeklyDisplayMonth(wd.getMonth() + 1)
      }
      if (d.weekly) setWeekly(d.weekly)
      setRestored(true)
    } catch { /* ignore */ }
    setShowRestorePrompt(false)
  }

  const handleDiscard = () => {
    localStorage.removeItem(lsKey)
    setShowRestorePrompt(false)
  }

  // ── 기간 정보
  const { period_label, period_start, period_end } = calcWeeklyPeriod(weeklyDate)
  const pastDeadline = isPastDeadline(period_end)
  const canSubmit = !dupReportId

  // ── 저장/제출
  const doSave = async (saveStatus: 'draft' | 'submitted' | 'resubmitted') => {
    if (saveStatus === 'submitted' && !canSubmit) {
      setError('해당 기간에 이미 작성된 리포트가 있습니다.')
      return
    }

    setLoading(true)
    setError('')

    let res: Response
    if (mode === 'create') {
      res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'weekly', period_label, period_start, period_end, content: weekly, status: saveStatus,
          attachments: pendingFiles,
        }),
      })
    } else {
      res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: weekly, status: saveStatus,
          addAttachments: pendingFiles,
          removeAttachmentIds: removedIds,
        }),
      })
    }

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다.')
      setLoading(false)
      return
    }

    localStorage.removeItem(lsKey)
    router.push(`/reports/${mode === 'create' ? data.id : reportId}`)
  }

  const submitLabel = mode === 'resubmit' ? '재제출' : mode === 'edit' ? '저장' : '제출'
  const showDraftBtn = mode !== 'edit'

  // 사용하지 않는 변수 경고 방지
  void pastDeadline

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          {mode === 'create' ? '리포트 작성' : mode === 'edit' ? '리포트 수정' : '리포트 재제출'}
        </h1>
      </div>

      {/* 복원 프롬프트 */}
      {showRestorePrompt && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">임시저장된 내용이 있습니다</p>
          <p className="text-xs text-amber-600 mb-3">이전에 작성하던 리포트를 불러오시겠습니까?</p>
          <div className="flex gap-2">
            <button onClick={handleRestore} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors">불러오기</button>
            <button onClick={handleDiscard} className="px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors">새로 작성</button>
          </div>
        </div>
      )}

      {restored && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600">임시저장 내용을 불러왔습니다.</p>
        </div>
      )}

      {prevLabel && mode === 'create' && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p className="text-xs text-gray-500">참고: <span className="font-medium text-gray-700">{prevLabel}</span> 리포트 내용이 입력칸에 회색으로 표시됩니다.</p>
        </div>
      )}

      <div className="space-y-4">
        {/* 기간 선택 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="block text-xs font-medium text-gray-500 mb-3">리포트 기간</label>
          {mode === 'create' ? (() => {
            const weeks = getWeeksInMonth(weeklyDisplayYear, weeklyDisplayMonth)
            const selectCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
            return (
              <div className="flex gap-2 flex-wrap items-center">
                <select value={weeklyDisplayYear} onChange={(e) => {
                  const ny = Number(e.target.value)
                  setWeeklyDisplayYear(ny)
                  const nw = getWeeksInMonth(ny, weeklyDisplayMonth)
                  if (nw.length > 0) setWeeklyDate(nw[0].value)
                }} className={selectCls}>
                  {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select value={weeklyDisplayMonth} onChange={(e) => {
                  const nm = Number(e.target.value)
                  setWeeklyDisplayMonth(nm)
                  const nw = getWeeksInMonth(weeklyDisplayYear, nm)
                  if (nw.length > 0) setWeeklyDate(nw[0].value)
                }} className={selectCls}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
                </select>
                <select value={weeklyDate} onChange={(e) => setWeeklyDate(e.target.value)} className={selectCls}>
                  {weeks.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
            )
          })() : (
            <p className="text-sm font-medium text-gray-800">{period_label}</p>
          )}

          {dupReportId && (
            <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-amber-700">해당 기간에 이미 작성된 리포트가 있습니다.</p>
                <a href={`/reports/${dupReportId}`} className="text-xs text-amber-600 underline">기존 리포트 수정하기 →</a>
              </div>
            </div>
          )}
        </div>

        {/* 보고서 본문 */}
        <WeeklyFormBody
          value={weekly}
          onChange={setWeekly}
          prev={prevWeekly}
          weeklyDate={weeklyDate}
          mode={mode}
        />

        {/* ── 첨부파일 ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">
            첨부파일 <span className="text-gray-400 font-normal">(선택, 파일당 10MB 이하)</span>
          </p>
          <p className="text-[10px] text-gray-400 mb-3">※ 개인정보, 민감정보 등이 포함된 사항은 이메일 및 유선연락을 활용해 주시기 바랍니다.</p>
          {fileError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{fileError}</div>
          )}
          <div className="space-y-2">
            {existingFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <a
                  href={`/api/attachments/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex-1 truncate"
                >
                  {f.filename}
                </a>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                <button type="button" onClick={() => removeExisting(f.id)} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="text-sm text-gray-700 flex-1 truncate">{f.filename}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                <button type="button" onClick={() => removePending(i)} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors w-full disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {uploading ? '업로드 중...' : '파일 추가'}
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAdd} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-2">
          {showDraftBtn && (
            <button
              type="button"
              onClick={() => doSave('draft')}
              disabled={loading || !!dupReportId}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              임시저장
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm transition-colors hover:bg-gray-50"
          >
            미리보기
          </button>
          <button
            type="button"
            onClick={() => doSave(mode === 'resubmit' ? 'resubmitted' : 'submitted')}
            disabled={loading || !canSubmit}
            className="flex-[2] font-medium py-3 rounded-xl text-sm transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white"
          >
            {loading ? '저장 중...' : submitLabel}
          </button>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPreview && (
        <ReportPreviewModal
          periodLabel={period_label}
          content={weekly}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
