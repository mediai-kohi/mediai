'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { WeeklySummaryData, OrgStatus } from '@/lib/weeklySummary'

const OrgDetailDrawer = dynamic(() => import('./OrgDetailDrawer'), { ssr: false })

// ─── AI 보고서 타입 ──────────────────────────────────────────────────────────

interface AiInstitutionDetail {
  organization: string
  kpi_status: string
  current_week: string
  next_week: string
}

interface AiIssue {
  issue: string
  organizations: string
  assessment: string
  action: string
}

export interface AiReportData {
  key_message?: string
  overall_assessment?: string
  institution_details?: AiInstitutionDetail[]
  issues?: AiIssue[]
  next_week_checklist?: Array<{ no: number; item: string; content: string; target: string }>
}

// ─── 스타일 상수 ──────────────────────────────────────────────────────────────

const BADGE_STYLE: Record<string, string> = {
  'HOT ISSUE':       'bg-red-500 text-white',
  'REGIONAL LEADER': 'bg-teal-600 text-white',
  'ACTIVE':          'bg-gray-700 text-white',
  'RISING STAR':     'bg-purple-600 text-white',
  '모니터링':          'bg-orange-100 text-orange-700',
}

const STATUS_STYLE: Record<string, string> = {
  '승인':  'bg-emerald-100 text-emerald-700',
  '제출':  'bg-blue-100 text-blue-700',
  '미제출': 'bg-gray-100 text-gray-500',
}

const KPI_COLORS = [
  { bg: 'bg-teal-50',   border: 'border-teal-100',   num: 'text-teal-700',   bar: 'bg-teal-500',   badge: 'bg-teal-100 text-teal-700',   en: 'text-teal-400' },
  { bg: 'bg-blue-50',   border: 'border-blue-100',   num: 'text-blue-700',   bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',   en: 'text-blue-400' },
  { bg: 'bg-amber-50',  border: 'border-amber-100',  num: 'text-amber-700',  bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700',  en: 'text-amber-400' },
  { bg: 'bg-purple-50', border: 'border-purple-100', num: 'text-purple-700', bar: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700', en: 'text-purple-400' },
]

// ─── KPI 아이콘 ───────────────────────────────────────────────────────────────

const KPI_ICONS = [
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>,
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
]

// ─── KPI 카드 ─────────────────────────────────────────────────────────────────

function KpiCard({ kpi, index }: { kpi: WeeklySummaryData['headline_kpis'][number]; index: number }) {
  const c = KPI_COLORS[index]
  const actualStr = kpi.actual % 1 === 0 ? kpi.actual.toLocaleString() : kpi.actual.toFixed(1)
  const targetStr = kpi.target % 1 === 0 ? kpi.target.toLocaleString() : kpi.target.toFixed(1)
  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[10px] font-bold tracking-widest ${c.en} mb-0.5`}>{kpi.labelEn}</p>
          <p className="text-xs font-semibold text-gray-600">{kpi.label}</p>
        </div>
        <span className={`${c.en} opacity-70`}>{KPI_ICONS[index]}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-2xl md:text-3xl font-bold ${c.num} leading-none`}>{actualStr}</span>
        {kpi.target > 0 && (
          <span className="text-sm text-gray-400 mb-0.5">/ {targetStr}{kpi.unit}</span>
        )}
      </div>
      {kpi.target > 0 && (
        <div className="space-y-1.5">
          <div className="h-1.5 bg-white/80 rounded-full overflow-hidden">
            <div
              className={`h-full ${c.bar} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(kpi.progress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${c.num} opacity-80`}>{kpi.tagline}</span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${c.badge}`}>
              {kpi.rate.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI 기관 카드 ─────────────────────────────────────────────────────────────

function AiOrgCard({ detail, onClick }: { detail: AiInstitutionDetail; onClick?: () => void }) {
  const bullets = detail.current_week
    .split(/(?<=[.。])\s+/)
    .map(s => s.replace(/^[•·\-\s]+/, '').trim())
    .filter(s => s.length > 3)

  const inner = (
    <>
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5">
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{detail.kpi_status}</p>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏛️</span>
            <p className="text-sm font-bold text-gray-900">{detail.organization}</p>
          </div>
          {onClick && <span className="text-[10px] text-gray-400 flex-shrink-0">보고서 보기 →</span>}
        </div>
        <ul className="space-y-2 flex-1">
          {(bullets.length > 0 ? bullets : [detail.current_week]).slice(0, 3).map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              <p className="text-xs text-gray-600 leading-relaxed">{b}</p>
            </li>
          ))}
        </ul>
        {detail.next_week && (
          <div className="border-t border-gray-100 pt-2.5 mt-3">
            <p className="text-[11px] text-blue-600 leading-relaxed">{detail.next_week}</p>
          </div>
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
      >
        {inner}
      </button>
    )
  }
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
      {inner}
    </div>
  )
}

// ─── 기존 기관 카드 (AI 없을 때 fallback) ─────────────────────────────────────

function OrgCard({ org, onClick }: { org: OrgStatus; onClick: () => void }) {
  const isMonitoring = org.badge === '모니터링'
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer ${
        isMonitoring ? 'border-orange-200 bg-orange-50/50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            org.display_status === '승인' ? 'bg-emerald-500'
            : org.display_status === '제출' ? 'bg-blue-500'
            : 'bg-gray-300'
          }`} />
          <p className="text-sm font-semibold text-gray-900 truncate">{org.org}</p>
        </div>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2 ${BADGE_STYLE[org.badge] ?? 'bg-gray-100 text-gray-600'}`}>
          {org.badge}
        </span>
      </div>
      {org.tagline
        ? <p className="text-xs text-gray-600 line-clamp-2 mb-2">{org.tagline}</p>
        : <p className="text-xs text-gray-400 mb-2 italic">보고서 미제출</p>
      }
      <div className="flex items-center justify-between mt-auto">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[org.display_status] ?? 'bg-gray-100 text-gray-500'}`}>
          {org.display_status}
        </span>
        <span className="text-xs text-gray-400">세부 보기 →</span>
      </div>
    </button>
  )
}

// ─── 아카이브 목록 ────────────────────────────────────────────────────────────

interface ArchiveItem {
  id: string
  period_label: string
  confirmed_at: string | null
  period_start: string
}

function ArchiveList() {
  const [archives, setArchives] = useState<ArchiveItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (archives !== null) { setOpen(true); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/weekly-summary/archive')
      const data = await res.json() as ArchiveItem[]
      setArchives(data)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [archives])

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => open ? setOpen(false) : load()}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>확정된 주간 요약 목록</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : !archives || archives.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">확정된 요약이 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {archives.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{a.period_label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      확정일: {a.confirmed_at
                        ? new Date(a.confirmed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                        : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => window.open(`/weekly-summary/${a.id}/print`, '_blank')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF
                    </button>
                    <a
                      href={`/api/admin/weekly-summary/archive/${a.id}/bulk-download`}
                      download
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      전체 Excel
                    </a>
                    <button
                      onClick={() => window.open(`/weekly-summary/${a.id}/bulk-print`, '_blank')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      전체 PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface Props {
  initialData: WeeklySummaryData | null
  aiReport?: AiReportData | null
}

export default function WeeklySummarySection({ initialData, aiReport }: Props) {
  const [data, setData] = useState<WeeklySummaryData | null>(initialData)
  const [selectedOrg, setSelectedOrg] = useState<OrgStatus | null>(null)
  const [selectedOrgBudget, setSelectedOrgBudget] = useState<WeeklySummaryData['budget']['org_executions'][number] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [unconfirming, setUnconfirming] = useState(false)
  const [archiveKey, setArchiveKey] = useState(0)

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center text-sm text-gray-400">
        주간 실적 데이터를 불러올 수 없습니다.
      </div>
    )
  }

  const handleUnconfirm = async () => {
    if (!confirm(`${data.period_label} 주간 실적 요약의 확정을 취소하시겠습니까?\n취소 후 내용을 수정하고 다시 확정할 수 있습니다.`)) return
    setUnconfirming(true)
    try {
      const res = await fetch('/api/admin/weekly-summary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: data.year, week: data.week_number }),
      })
      if (res.ok) {
        setData(await res.json() as WeeklySummaryData)
        setArchiveKey(k => k + 1)
      } else {
        const err = await res.json() as { error: string }
        alert(err.error)
      }
    } finally {
      setUnconfirming(false)
    }
  }

  const handleConfirm = async (force: boolean) => {
    setConfirming(true)
    try {
      const res = await fetch('/api/admin/weekly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: data.year, week: data.week_number, force }),
      })
      if (res.ok) {
        setData(await res.json() as WeeklySummaryData)
        setArchiveKey(k => k + 1)
      } else {
        const err = await res.json() as { error: string }
        alert(err.error)
      }
    } finally {
      setConfirming(false)
    }
  }

  const openOrgDetail = (orgStatus: OrgStatus) => {
    setSelectedOrg(orgStatus)
    setSelectedOrgBudget(data.budget.org_executions.find(e => e.org === orgStatus.org) ?? null)
  }

  const isConfirmed = data.status === 'confirmed'
  const activeOrgs = data.org_statuses.filter((o) => o.badge !== '모니터링')
  const monitoringOrgs = data.org_statuses.filter((o) => o.badge === '모니터링')
  const aiDetails = aiReport?.institution_details ?? []
  const featuredOrgs = aiDetails.slice(0, 3)
  const otherOrgs = aiDetails.slice(3)

  // AI key_message 첫 단락만 배너에 표시
  const keyMessageBanner = aiReport?.key_message
    ? aiReport.key_message.split(/\n\n|\n(?=[A-Z가-힣])/)[0].trim()
    : null

  return (
    <div className="space-y-6">

      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{data.period_label} 주간 실적 요약</h2>
          {isConfirmed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 shrink-0">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              확정 · {data.confirmed_at
                ? new Date(data.confirmed_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
                : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConfirmed && (
            <button
              onClick={handleUnconfirm}
              disabled={unconfirming}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {unconfirming ? '취소 중...' : '확정 취소'}
            </button>
          )}
          {!isConfirmed && data.all_approved && (
            <button
              onClick={() => handleConfirm(false)}
              disabled={confirming}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {confirming ? '확정 중...' : '전체 확정'}
            </button>
          )}
          {!isConfirmed && !data.all_approved && data.submitted_count > 0 && (
            <button
              onClick={() => {
                if (confirm(`아직 ${data.org_statuses.length - data.approved_count}개 기관이 미승인 상태입니다.\n현재 기준으로 강제 확정하시겠습니까?`)) {
                  handleConfirm(true)
                }
              }}
              disabled={confirming}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              현재 기준 확정
            </button>
          )}
        </div>
      </div>

      {/* ── 기관 제출 현황 배너 ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${data.all_approved ? 'bg-emerald-500' : 'bg-blue-500'}`} />
        <p className="text-xs text-gray-600 flex-1 min-w-0">
          {data.all_approved
            ? `${data.org_statuses.length}개 기관 전체 승인 완료 — 주간 실적 요약 확정 가능`
            : `${data.submitted_count}개 기관 제출 · ${data.approved_count}개 기관 승인 (미제출 ${data.org_statuses.length - data.submitted_count}개)`}
        </p>
        <span className="text-xs text-gray-400 shrink-0">{data.period_start} ~ {data.period_end}</span>
      </div>

      {/* ── 1. 핵심 성과 대시보드 ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-800 text-white text-[10px] font-bold flex-shrink-0">1</span>
          <p className="text-sm font-bold text-gray-800">핵심 성과 대시보드</p>
          <span className="hidden sm:inline text-[11px] font-semibold text-gray-400 tracking-wider">KEY KPI</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.headline_kpis.map((kpi, i) => (
            <KpiCard key={kpi.label} kpi={kpi} index={i} />
          ))}
        </div>
      </div>

      {/* ── AI 핵심 메시지 배너 ── */}
      {keyMessageBanner && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-white/80 mt-1.5 flex-shrink-0" />
            <p className="text-sm leading-relaxed">{keyMessageBanner}</p>
          </div>
        </div>
      )}

      {/* ── 2. 주요 운영기관별 핵심 동향 ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-800 text-white text-[10px] font-bold flex-shrink-0">2</span>
          <p className="text-sm font-bold text-gray-800">주요 운영기관별 핵심 동향</p>
          <span className="hidden sm:inline text-[11px] font-semibold text-gray-400 tracking-wider">INSTITUTIONS</span>
        </div>
        {aiDetails.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {featuredOrgs.map((d) => {
                const orgStatus = data.org_statuses.find(o => o.org === d.organization)
                return (
                  <AiOrgCard
                    key={d.organization}
                    detail={d}
                    onClick={orgStatus ? () => openOrgDetail(orgStatus) : undefined}
                  />
                )
              })}
            </div>
            {otherOrgs.length > 0 && (
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">기타 기관 현황</p>
                <div className="flex flex-wrap gap-2">
                  {otherOrgs.map((d) => {
                    const orgStatus = data.org_statuses.find(o => o.org === d.organization)
                    return orgStatus ? (
                      <button
                        key={d.organization}
                        onClick={() => openOrgDetail(orgStatus)}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 min-w-0 text-left hover:shadow-sm hover:border-gray-300 transition-all cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-gray-800">{d.organization}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 max-w-[180px]">{d.kpi_status}</p>
                      </button>
                    ) : (
                      <div key={d.organization} className="bg-white border border-gray-200 rounded-lg px-3 py-2 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{d.organization}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 max-w-[180px]">{d.kpi_status}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeOrgs.map((org) => (
                <OrgCard key={org.org} org={org} onClick={() => openOrgDetail(org)} />
              ))}
            </div>
            {monitoringOrgs.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">밀착 모니터링 기관</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {monitoringOrgs.map((org) => (
                    <button
                      key={org.org}
                      onClick={() => openOrgDetail(org)}
                      className="text-left border border-orange-200 bg-orange-50 rounded-lg px-4 py-3 hover:bg-orange-100 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800">{org.org}</p>
                      <p className="text-xs text-orange-600 mt-1">
                        {org.db_status === 'revision_requested' ? '정정요청 대기' : '미제출'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 3. 예산 집행 현황 ── */}
      {data.budget && data.budget.total_budget > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-800 text-white text-[10px] font-bold flex-shrink-0">3</span>
            <p className="text-sm font-bold text-gray-800">예산 집행 현황</p>
            <span className="hidden sm:inline text-[11px] font-semibold text-gray-400 tracking-wider">BUDGET</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            {/* 전체 집행 요약 */}
            <div>
              <p className="text-[10px] text-gray-400 tracking-wide mb-1">TOTAL EXECUTED BUDGET</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.budget.total_executed.toLocaleString()}
                <span className="text-sm font-normal text-gray-500 ml-1">원 집행 완료</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                총 사업 예산 {(data.budget.total_budget / 100_000_000).toFixed(1)}억원 대비{' '}
                <span className="font-semibold text-gray-600">{data.budget.execution_rate}</span> 집행률 기록
              </p>
              <div className="mt-3">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full transition-all"
                    style={{ width: `${Math.min(parseFloat(data.budget.execution_rate) || 0, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-red-500 mt-1">누적 실집행률 {data.budget.execution_rate}</p>
              </div>
            </div>

            {/* 국고보조금 / 자기부담금 분리 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-blue-500 tracking-wide mb-1">국고보조금</p>
                <p className="text-sm font-bold text-gray-900">{data.budget.total_executed_gov.toLocaleString()}원</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  예산 {(data.budget.total_budget_gov / 100_000_000).toFixed(1)}억 · 집행률 {data.budget.execution_rate_gov}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-emerald-600 tracking-wide mb-1">자기부담금</p>
                <p className="text-sm font-bold text-gray-900">{data.budget.total_executed_self.toLocaleString()}원</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  예산 {(data.budget.total_budget_self / 100_000_000).toFixed(1)}억 · 집행률 {data.budget.execution_rate_self}
                </p>
              </div>
            </div>

            {/* 기관별 집행 내역 */}
            {data.budget.org_executions && data.budget.org_executions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">기관별 집행 내역</p>
                <div className="space-y-2">
                  {data.budget.org_executions.filter(e => e.executed > 0).map((e) => (
                    <div key={e.org} className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-xs text-gray-700">{e.org}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-gray-900">{e.executed.toLocaleString()}원</p>
                        <p className="text-[10px] text-gray-400">
                          국고 {e.gov.toLocaleString()} · 자기 {e.self.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. 향후 운영 준비사항 ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-800 text-white text-[10px] font-bold flex-shrink-0">4</span>
          <p className="text-sm font-bold text-gray-800">향후 운영 준비사항</p>
          <span className="hidden sm:inline text-[11px] font-semibold text-gray-400 tracking-wider">ISSUES & ACTIONS</span>
        </div>
        {aiReport?.issues && aiReport.issues.length > 0 ? (
          <div className="space-y-2">
            {aiReport.issues.map((issue, i) => (
              <div key={i} className="bg-white border border-orange-200 rounded-2xl px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-orange-500 text-base flex-shrink-0 mt-0.5">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-sm font-bold text-gray-900">{issue.issue}</p>
                      {issue.organizations && (
                        <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 rounded-md px-2 py-0.5 flex-shrink-0 whitespace-nowrap">
                          {issue.organizations}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{issue.assessment}</p>
                    <p className="text-xs text-blue-600 mt-1.5">→ {issue.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-6 text-center">
            <p className="text-xs text-gray-400">AI 분석 보고서가 없습니다. 보고서를 생성하면 이슈 및 관리 계획이 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* ── 확정된 주간 요약 목록 ── */}
      <ArchiveList key={archiveKey} />

      {/* 기관 세부 드로어 */}
      {selectedOrg && (
        <OrgDetailDrawer
          org={selectedOrg}
          budgetExecution={selectedOrgBudget}
          onClose={() => { setSelectedOrg(null); setSelectedOrgBudget(null) }}
        />
      )}
    </div>
  )
}
