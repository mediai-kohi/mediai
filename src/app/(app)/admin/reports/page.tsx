'use client'

import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { downloadReportExcel, printReportPdf, type ReportDownloadData } from '@/lib/reportDownload'

type PageTab = 'list' | 'pending' | 'summary' | 'ai_history'

interface Report {
  id: string
  type: string
  period_label: string
  status: string
  revision_reason: string | null
  revision_comment: string | null
  submitted_at: string | null
  created_at: string
  organization: string
  author: { id: string; user_code: string; organization: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  draft:              'bg-gray-100 text-gray-600',
  submitted:          'bg-green-100 text-green-700',
  approved:           'bg-emerald-100 text-emerald-700',
  revision_requested: 'bg-red-100 text-red-600',
  resubmitted:        'bg-blue-100 text-blue-700',
  revision_approved:  'bg-amber-100 text-amber-600',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '임시저장',
  submitted: '제출완료',
  approved: '승인',
  revision_requested: '정정요청',
  resubmitted: '재제출',
  revision_approved: '재제출 필요',
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeeksInMonth(year: number, month: number): { start: string; label: string }[] {
  const result: { start: string; label: string }[] = []
  let monday = new Date(year, month - 1, 1)
  while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1)
  let weekNum = 1
  while (monday.getFullYear() === year && monday.getMonth() + 1 === month) {
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    result.push({ start: toDateStr(monday), label: `${month}월 ${weekNum}주차 (${fmt(monday)}~${fmt(sunday)})` })
    weekNum++
    monday = new Date(monday); monday.setDate(monday.getDate() + 7)
  }
  return result
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    .replace('. ', '.').replace(/\.$/, '')
}

interface DashboardItem { category: string; content: string }
interface KeySummaryItem { no: number; keyword: string; content: string }
interface InstitutionProgress { organization: string; stage: string; current_week: string; next_week: string; status: string }
interface QuantitativeItem { indicator: string; organizations: string; content: string; management_point: string }
interface IssueItem { issue: string; organizations: string; assessment: string; action: string }
interface ChecklistItem { no: number; item: string; content: string; target: string }
interface InstitutionDetail { organization: string; kpi_status: string; current_week: string; next_week: string }

interface SummaryResult {
  overall_assessment: string
  dashboard: DashboardItem[]
  key_summary: KeySummaryItem[]
  institution_progress: InstitutionProgress[]
  quantitative_summary: QuantitativeItem[]
  issues: IssueItem[]
  next_week_checklist: ChecklistItem[]
  key_message: string
  institution_details: InstitutionDetail[]
}

export default function AdminReportsPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<PageTab>((searchParams.get('tab') as PageTab) ?? 'list')

  // 목록 탭 상태
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [orgFilter, setOrgFilter] = useState('all')
  const [orgs, setOrgs] = useState<string[]>([])

  // 승인 대기 탭 상태
  const [pending, setPending] = useState<Report[]>([])
  const [pendLoading, setPendLoading] = useState(false)
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve'; user_code: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 다운로드 상태
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [dropdownId, setDropdownId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // AI 분석 탭 상태
  const sumType = 'weekly'
  const [sumYear, setSumYear] = useState(2026)
  const [sumMonth, setSumMonth] = useState(new Date().getMonth() + 1)
  const [sumPeriod, setSumPeriod] = useState<{ label: string; start: string } | null>(null)
  const [sumOrg, setSumOrg] = useState('all')
  const [sumLoading, setSumLoading] = useState(false)
  const [sumResult, setSumResult] = useState<SummaryResult | null>(null)
  const [sumError, setSumError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  // AI 분석 기록 탭 상태
  interface AiReportMeta { id: string; period_label: string; organization: string; created_at: string }
  const [historyList, setHistoryList] = useState<AiReportMeta[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [expandedHistoryData, setExpandedHistoryData] = useState<SummaryResult | null>(null)
  const [expandedHistoryLoading, setExpandedHistoryLoading] = useState(false)

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 다운로드 공통 fetch
  const fetchReportData = async (id: string): Promise<ReportDownloadData | null> => {
    setDownloadingId(id)
    try {
      const res = await fetch(`/api/admin/reports/${id}`)
      if (!res.ok) return null
      const data = await res.json()
      return {
        type: data.type,
        period_label: data.period_label,
        content: data.content,
        organization: data.organization,
      }
    } finally {
      setDownloadingId(null)
      setDropdownId(null)
    }
  }

  const handleExcel = async (id: string) => {
    const d = await fetchReportData(id)
    if (d) downloadReportExcel(d)
  }

  const handlePdf = async (id: string) => {
    const d = await fetchReportData(id)
    if (d) printReportPdf(d)
  }

  // 기관 목록
  useEffect(() => {
    fetch('/api/admin/users?tab=all')
      .then(r => r.json())
      .then(data => {
        const unique = Array.from(new Set((data as { organization: string }[]).map(u => u.organization))).sort()
        setOrgs(unique as string[])
      })
  }, [])

  // 목록 탭
  const fetchReports = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ status: statusFilter, type: 'weekly', organization: orgFilter })
    const res = await fetch(`/api/admin/reports?${p}`)
    const data = await res.json()
    setReports(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [statusFilter, orgFilter])

  useEffect(() => { if (tab === 'list') fetchReports() }, [tab, fetchReports])

  // 승인 대기 탭 (submitted + resubmitted)
  const fetchPending = useCallback(async () => {
    setPendLoading(true)
    const [r1, r2] = await Promise.all([
      fetch('/api/admin/reports?status=submitted').then(r => r.json()),
      fetch('/api/admin/reports?status=resubmitted').then(r => r.json()),
    ])
    const merged: Report[] = [...(Array.isArray(r1) ? r1 : []), ...(Array.isArray(r2) ? r2 : [])]
    merged.sort((a, b) => (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at))
    setPending(merged)
    setPendLoading(false)
  }, [])

  useEffect(() => { if (tab === 'pending') fetchPending() }, [tab, fetchPending])

  const doApprove = async () => {
    if (!confirm) return
    setActionLoading(true)
    await fetch(`/api/admin/reports/${confirm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    setConfirm(null)
    setActionLoading(false)
    fetchPending()
  }

  const buildSummaryHtml = (result: SummaryResult, period: string) => {
    const statusStyle = (s: string) =>
      s === '정상추진' ? 'background:#dcfce7;color:#15803d' :
      s === '준비중'   ? 'background:#dbeafe;color:#1d4ed8' :
                        'background:#fee2e2;color:#dc2626'

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>AI 분석 보고서 ${period}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Malgun Gothic',sans-serif;font-size:9.5pt;color:#111;padding:20px}
  h1{font-size:14pt;text-align:center;margin-bottom:4px}
  .sub{text-align:center;font-size:9pt;color:#555;margin-bottom:16px}
  .sec{margin-bottom:14px}
  .sec-title{background:#1f2937;color:#fff;padding:5px 10px;font-size:10pt;font-weight:bold}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #d1d5db;padding:5px 8px;font-size:8.5pt;text-align:left;vertical-align:top}
  th{background:#f3f4f6;font-weight:600}
  .overall{background:#eff6ff;border:1px solid #bfdbfe;padding:10px;border-radius:4px;margin-bottom:14px;line-height:1.7;white-space:pre-line}
  .keymsg{background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:4px;line-height:1.7;white-space:pre-line}
  .badge{display:inline-block;padding:1px 6px;border-radius:9999px;font-size:8pt}
  @media print{body{padding:8px}@page{size:A4;margin:12mm}}
</style>
</head>
<body>
<h1>2026년 의료AI 보건의료인 직무교육사업 주간 실적보고</h1>
<p class="sub">${period}</p>

<div class="overall">${result.overall_assessment}</div>

<div class="sec">
  <div class="sec-title">1. 주간 종합 대시보드</div>
  <table>
    <thead><tr><th style="width:22%">구분</th><th>주요 현황</th></tr></thead>
    <tbody>${result.dashboard.map(d => `<tr><td>${d.category}</td><td>${d.content}</td></tr>`).join('')}</tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-title">2. 이번 주 핵심 요약</div>
  <table>
    <thead><tr><th style="width:4%;text-align:center">구분</th><th style="width:14%">키워드</th><th>핵심 내용</th></tr></thead>
    <tbody>${result.key_summary.map(k => `<tr><td style="text-align:center">${k.no}</td><td>${k.keyword}</td><td>${k.content}</td></tr>`).join('')}</tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-title">3. 수행기관별 추진현황 비교</div>
  <table>
    <thead><tr><th style="width:14%">기관</th><th style="width:11%">추진단계</th><th>이번 주 핵심실적</th><th>다음 주 핵심계획</th><th style="width:10%">상태</th></tr></thead>
    <tbody>${result.institution_progress.map(p => `<tr><td>${p.organization}</td><td>${p.stage}</td><td>${p.current_week}</td><td>${p.next_week}</td><td><span class="badge" style="${statusStyle(p.status)}">${p.status}</span></td></tr>`).join('')}</tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-title">4. 정량 성과 요약</div>
  <table>
    <thead><tr><th style="width:12%">지표</th><th style="width:18%">주요 실적 확인 기관</th><th>이번 주 확인 내용</th><th>관리 포인트</th></tr></thead>
    <tbody>${result.quantitative_summary.map(q => `<tr><td>${q.indicator}</td><td>${q.organizations}</td><td>${q.content}</td><td style="font-style:italic;color:#555">${q.management_point}</td></tr>`).join('')}</tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-title">5. 주요 이슈 및 조치 필요사항</div>
  <table>
    <thead><tr><th style="width:16%">이슈</th><th style="width:14%">관련기관</th><th>판단</th><th>인재원 조치방향</th></tr></thead>
    <tbody>${result.issues.map(iss => `<tr><td>${iss.issue}</td><td>${iss.organizations}</td><td>${iss.assessment}</td><td>${iss.action}</td></tr>`).join('')}</tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-title">6. 차주 중점 점검 체크리스트</div>
  <table>
    <thead><tr><th style="width:4%;text-align:center">순번</th><th style="width:14%">점검항목</th><th>확인내용</th><th style="width:22%">확인대상</th></tr></thead>
    <tbody>${result.next_week_checklist.map(c => `<tr><td style="text-align:center">${c.no}</td><td>${c.item}</td><td>${c.content}</td><td>${c.target}</td></tr>`).join('')}</tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-title">7. 보고용 핵심 메시지</div>
  <div class="keymsg">${result.key_message}</div>
</div>

<div class="sec">
  <div class="sec-title">붙임. 기관별 세부 요약</div>
  <table>
    <thead><tr><th style="width:14%">기관</th><th style="width:22%">성과지표 현황</th><th>이번 주 실적</th><th>차주 계획/비고</th></tr></thead>
    <tbody>${result.institution_details.map(d => `<tr><td>${d.organization}</td><td>${d.kpi_status}</td><td>${d.current_week}</td><td>${d.next_week}</td></tr>`).join('')}</tbody>
  </table>
</div>

</body>
</html>`
  }

  const downloadSummaryPdf = (result: SummaryResult, period: string) => {
    const html = buildSummaryHtml(result, period)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 600)
    }
  }

  const downloadSummaryDoc = (result: SummaryResult, period: string) => {
    const html = buildSummaryHtml(result, period)
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AI분석보고서_${period.replace(/[,\s]+/g, '_') || '보고서'}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    const res = await fetch('/api/admin/ai-reports')
    const data = await res.json()
    setHistoryList(Array.isArray(data) ? data : [])
    setHistoryLoading(false)
  }, [])

  useEffect(() => { if (tab === 'ai_history') fetchHistory() }, [tab, fetchHistory])

  const saveReport = async () => {
    if (!sumResult) return
    setSaving(true)
    const res = await fetch('/api/admin/ai-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: sumPeriod?.start ?? '',
        end_date: sumPeriod?.start ?? '',
        period_label: sumPeriod?.label ?? '',
        organization: sumOrg,
        result: sumResult,
      }),
    })
    const data = await res.json()
    if (res.ok) setSavedId(data.id)
    setSaving(false)
  }

  const toggleHistoryExpand = async (id: string) => {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null)
      setExpandedHistoryData(null)
      return
    }
    setExpandedHistoryId(id)
    setExpandedHistoryData(null)
    setExpandedHistoryLoading(true)
    const res = await fetch(`/api/admin/ai-reports/${id}`)
    if (res.ok) {
      const data = await res.json()
      setExpandedHistoryData(data.result)
    }
    setExpandedHistoryLoading(false)
  }

  const deleteReport = async (id: string) => {
    setDeletingId(id)
    await fetch(`/api/admin/ai-reports/${id}`, { method: 'DELETE' })
    setHistoryList(prev => prev.filter(r => r.id !== id))
    setDeletingId(null)
  }

  const downloadFromHistory = async (id: string, type: 'pdf' | 'doc') => {
    const res = await fetch(`/api/admin/ai-reports/${id}`)
    if (!res.ok) return
    const data = await res.json()
    const period = data.period_label ?? (data.start_date && data.end_date ? `${data.start_date} ~ ${data.end_date}` : '')
    if (type === 'pdf') downloadSummaryPdf(data.result, period)
    else downloadSummaryDoc(data.result, period)
  }

  const doSummary = async () => {
    if (!sumPeriod) {
      setSumError('분석할 기간을 선택해주세요.')
      return
    }
    setSumError('')
    setSumResult(null)
    setSavedId(null)
    setSumLoading(true)
    const res = await fetch('/api/admin/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStarts: [sumPeriod.start], periodLabel: sumPeriod.label, reportType: sumType, organization: sumOrg }),
    })
    const data = await res.json()
    if (!res.ok) setSumError(data.error ?? '오류가 발생했습니다.')
    else setSumResult(data)
    setSumLoading(false)
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">보고서 관리</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-5">
        {([['list', '보고서 목록'], ['pending', '승인 대기'], ['summary', 'AI 분석'], ['ai_history', '분석 기록']] as [PageTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
            {label}
            {t === 'pending' && pending.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 목록 탭 ── */}
      {tab === 'list' && (
        <>
          <div className="flex gap-2 flex-wrap mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 상태</option>
              <option value="submitted">제출완료</option>
              <option value="approved">승인</option>
              <option value="revision_requested">정정요청</option>
              <option value="resubmitted">재제출</option>
              <option value="draft">임시저장</option>
            </select>
            <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 기관</option>
              {orgs.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기관</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">작성자</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">유형</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기간</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">제출일</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">다운로드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
                  ) : reports.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">보고서가 없습니다.</td></tr>
                  ) : reports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.organization}</td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{r.author?.user_code ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-600">
                          주간
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/reports/${r.id}`} className="text-gray-800 hover:text-blue-600 font-medium whitespace-nowrap">
                          {r.period_label}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.submitted_at)}</td>
                      <td className="px-4 py-3">
                        <div className="relative" ref={dropdownId === r.id ? dropdownRef : null}>
                          <button
                            onClick={() => setDropdownId(prev => prev === r.id ? null : r.id)}
                            disabled={downloadingId === r.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            {downloadingId === r.id ? (
                              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                            )}
                            다운로드
                          </button>
                          {dropdownId === r.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-36">
                              <button
                                onClick={() => handleExcel(r.id)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                Excel 다운로드
                              </button>
                              <button
                                onClick={() => handlePdf(r.id)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                              >
                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                PDF 저장
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 승인 대기 탭 ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {pendLoading ? (
            <div className="text-center py-10 text-sm text-gray-400">불러오는 중...</div>
          ) : pending.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
              승인 대기 중인 보고서가 없습니다.
            </div>
          ) : pending.map((r) => (
            <div key={r.id} className={`bg-white border rounded-xl p-4 ${r.status === 'resubmitted' ? 'border-blue-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-600">
                      주간
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <Link href={`/reports/${r.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                      {r.period_label}
                    </Link>
                  </div>
                  <p className="text-xs text-gray-500">
                    {r.author?.user_code ?? '-'} · {r.organization} · 제출 {formatDate(r.submitted_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    href={`/reports/${r.id}`}
                    className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    검토
                  </Link>
                  <button
                    onClick={() => setConfirm({ id: r.id, action: 'approve', user_code: r.author?.user_code ?? '' })}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    승인
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI 요약 탭 ── */}
      {tab === 'summary' && (
        <div className="w-full">
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 max-w-2xl">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">분석 조건 설정</h2>
            <div className="space-y-3">
              {/* 년도/월 선택 */}
              <div className="flex gap-2 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">년도</label>
                  <select value={sumYear} onChange={e => { setSumYear(Number(e.target.value)); setSumPeriod(null) }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">월</label>
                  <select value={sumMonth} onChange={e => { setSumMonth(Number(e.target.value)); setSumPeriod(null) }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                  </select>
                </div>
              </div>

              {/* 기간 선택 */}
              {(() => {
                const available = getWeeksInMonth(sumYear, sumMonth)
                return (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">기간 선택</label>
                    <select
                      value={sumPeriod?.start ?? ''}
                      onChange={e => {
                        const found = available.find(p => p.start === e.target.value)
                        setSumPeriod(found ?? null)
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">기간을 선택하세요</option>
                      {available.map(p => (
                        <option key={p.start} value={p.start}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )
              })()}

              {/* 기관 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">기관</label>
                <select value={sumOrg} onChange={e => setSumOrg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">전체 기관</option>
                  {orgs.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {sumError && <p className="text-sm text-red-600">{sumError}</p>}
              <button
                onClick={doSummary}
                disabled={sumLoading || !sumPeriod}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {sumLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    AI 분석 중...
                  </>
                ) : 'AI 분석보고서 생성'}
              </button>
            </div>
          </div>

          {sumResult && (
            <div className="mt-4 space-y-5">
              {/* 액션 버튼 그룹 */}
              <div className="flex justify-end items-center gap-2 flex-wrap">
                {savedId ? (
                  <span className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    저장 완료
                  </span>
                ) : (
                  <button
                    onClick={saveReport}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {saving ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                      </svg>
                    )}
                    저장
                  </button>
                )}
                <button
                  onClick={() => downloadSummaryPdf(sumResult, sumPeriod?.label ?? '')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  PDF 다운로드
                </button>
                <button
                  onClick={() => downloadSummaryDoc(sumResult, sumPeriod?.label ?? '')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Word 다운로드
                </button>
              </div>

              {/* 종합판단 */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-blue-900 mb-2">종합판단</h3>
                <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{sumResult.overall_assessment}</p>
              </div>

              {/* 1. 주간 종합 대시보드 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2.5"><h3 className="text-sm font-bold text-white">1. 주간 종합 대시보드</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 w-1/4">구분</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">주요 현황</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {(sumResult.dashboard ?? []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-xs font-medium text-gray-700 bg-gray-50">{item.category}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{item.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. 이번 주 핵심 요약 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2.5"><h3 className="text-sm font-bold text-white">2. 이번 주 핵심 요약</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-100">
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 w-10">구분</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 w-32">키워드</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">핵심 내용</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {(sumResult.key_summary ?? []).map(item => (
                      <tr key={item.no}>
                        <td className="px-4 py-2.5 text-xs text-center text-gray-500">{item.no}</td>
                        <td className="px-4 py-2.5 text-xs font-medium text-blue-700">{item.keyword}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{item.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 3. 수행기관별 추진현황 비교 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2.5"><h3 className="text-sm font-bold text-white">3. 수행기관별 추진현황 비교</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">기관</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">추진단계</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">이번 주 핵심실적</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">다음 주 핵심계획</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">상태</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {(sumResult.institution_progress ?? []).map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">{item.organization}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{item.stage}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-700">{item.current_week}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-700">{item.next_week}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              item.status === '정상추진' ? 'bg-green-100 text-green-700' :
                              item.status === '준비중'   ? 'bg-blue-100 text-blue-700' :
                                                          'bg-red-100 text-red-600'
                            }`}>{item.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. 정량 성과 요약 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2.5"><h3 className="text-sm font-bold text-white">4. 정량 성과 요약</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">지표</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">주요 실적 확인 기관</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">이번 주 확인 내용</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">관리 포인트</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {(sumResult.quantitative_summary ?? []).map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">{item.indicator}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{item.organizations}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-700">{item.content}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 italic">{item.management_point}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. 주요 이슈 및 조치 필요사항 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2.5"><h3 className="text-sm font-bold text-white">5. 주요 이슈 및 조치 필요사항</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">이슈</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">관련기관</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">판단</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">인재원 조치방향</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {(sumResult.issues ?? []).map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{item.issue}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{item.organizations}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-700">{item.assessment}</td>
                          <td className="px-3 py-2.5 text-xs text-blue-700">{item.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. 차주 중점 점검 체크리스트 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2.5"><h3 className="text-sm font-bold text-white">6. 차주 중점 점검 체크리스트</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-100">
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-10">순번</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-32">점검항목</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">확인내용</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">확인대상</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {(sumResult.next_week_checklist ?? []).map(item => (
                      <tr key={item.no}>
                        <td className="px-3 py-2.5 text-xs text-center text-gray-500">{item.no}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-800">{item.item}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">{item.content}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{item.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 7. 보고용 핵심 메시지 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-amber-900 mb-2">7. 보고용 핵심 메시지</h3>
                <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-line">{sumResult.key_message}</p>
              </div>

              {/* 붙임. 기관별 세부 요약 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2.5"><h3 className="text-sm font-bold text-white">붙임. 기관별 세부 요약</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">기관</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">성과지표 현황</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">이번 주 실적</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">차주 계획/비고</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {(sumResult.institution_details ?? []).map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">{item.organization}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{item.kpi_status}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-700">{item.current_week}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{item.next_week}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 분석 기록 탭 ── */}
      {tab === 'ai_history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">저장된 AI 분석보고서 목록입니다.</p>
            <button onClick={fetchHistory} className="text-xs text-blue-600 hover:underline">새로고침</button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">분석 기간</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기관</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">저장 일시</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">다운로드</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyLoading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
                ) : historyList.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">저장된 분석보고서가 없습니다.</td></tr>
                ) : historyList.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleHistoryExpand(r.id)}
                    >
                      <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${expandedHistoryId === r.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                          </svg>
                          {r.period_label}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.organization === 'all' ? '전체 기관' : r.organization}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => downloadFromHistory(r.id, 'pdf')}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            PDF
                          </button>
                          <button
                            onClick={() => downloadFromHistory(r.id, 'doc')}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Word
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => deleteReport(r.id)}
                          disabled={deletingId === r.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors rounded"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    {expandedHistoryId === r.id && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 border-t border-gray-100 px-4 py-5">
                          {expandedHistoryLoading ? (
                            <div className="text-center text-sm text-gray-400 py-6">불러오는 중...</div>
                          ) : expandedHistoryData ? (
                            <div className="space-y-4">
                              {/* 종합판단 */}
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-blue-900 mb-1.5">종합판단</h3>
                                <p className="text-xs text-blue-800 leading-relaxed whitespace-pre-line">{expandedHistoryData.overall_assessment}</p>
                              </div>

                              {/* 1. 주간 종합 대시보드 */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-800 px-3 py-2"><h3 className="text-xs font-bold text-white">1. 주간 종합 대시보드</h3></div>
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-100"><th className="px-3 py-1.5 text-left font-semibold text-gray-600 w-1/4">구분</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">주요 현황</th></tr></thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {(expandedHistoryData.dashboard ?? []).map((item, i) => (
                                      <tr key={i}><td className="px-3 py-2 font-medium text-gray-700 bg-gray-50">{item.category}</td><td className="px-3 py-2 text-gray-700">{item.content}</td></tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* 2. 이번 주 핵심 요약 */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-800 px-3 py-2"><h3 className="text-xs font-bold text-white">2. 이번 주 핵심 요약</h3></div>
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-100"><th className="px-3 py-1.5 text-center font-semibold text-gray-600 w-10">구분</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600 w-28">키워드</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">핵심 내용</th></tr></thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {(expandedHistoryData.key_summary ?? []).map(item => (
                                      <tr key={item.no}><td className="px-3 py-2 text-center text-gray-500">{item.no}</td><td className="px-3 py-2 font-medium text-blue-700">{item.keyword}</td><td className="px-3 py-2 text-gray-700">{item.content}</td></tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* 3. 수행기관별 추진현황 */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-800 px-3 py-2"><h3 className="text-xs font-bold text-white">3. 수행기관별 추진현황 비교</h3></div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100"><th className="px-3 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">기관</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">추진단계</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">이번 주 핵심실적</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">다음 주 핵심계획</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">상태</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(expandedHistoryData.institution_progress ?? []).map((item, i) => (
                                        <tr key={i}><td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{item.organization}</td><td className="px-3 py-2 text-gray-600 whitespace-nowrap">{item.stage}</td><td className="px-3 py-2 text-gray-700">{item.current_week}</td><td className="px-3 py-2 text-gray-700">{item.next_week}</td><td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${item.status === '정상추진' ? 'bg-green-100 text-green-700' : item.status === '준비중' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>{item.status}</span></td></tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* 4. 정량 성과 요약 */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-800 px-3 py-2"><h3 className="text-xs font-bold text-white">4. 정량 성과 요약</h3></div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100"><th className="px-3 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">지표</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">주요 실적 확인 기관</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">이번 주 확인 내용</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">관리 포인트</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(expandedHistoryData.quantitative_summary ?? []).map((item, i) => (
                                        <tr key={i}><td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{item.indicator}</td><td className="px-3 py-2 text-gray-600">{item.organizations}</td><td className="px-3 py-2 text-gray-700">{item.content}</td><td className="px-3 py-2 text-gray-500 italic">{item.management_point}</td></tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* 5. 주요 이슈 */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-800 px-3 py-2"><h3 className="text-xs font-bold text-white">5. 주요 이슈 및 조치 필요사항</h3></div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100"><th className="px-3 py-1.5 text-left font-semibold text-gray-600">이슈</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">관련기관</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">판단</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">인재원 조치방향</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(expandedHistoryData.issues ?? []).map((item, i) => (
                                        <tr key={i}><td className="px-3 py-2 font-medium text-gray-900">{item.issue}</td><td className="px-3 py-2 text-gray-600 whitespace-nowrap">{item.organizations}</td><td className="px-3 py-2 text-gray-700">{item.assessment}</td><td className="px-3 py-2 text-blue-700">{item.action}</td></tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* 6. 차주 중점 점검 체크리스트 */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-800 px-3 py-2"><h3 className="text-xs font-bold text-white">6. 차주 중점 점검 체크리스트</h3></div>
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-100"><th className="px-3 py-1.5 text-center font-semibold text-gray-600 w-10">순번</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600 w-28">점검항목</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">확인내용</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">확인대상</th></tr></thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {(expandedHistoryData.next_week_checklist ?? []).map(item => (
                                      <tr key={item.no}><td className="px-3 py-2 text-center text-gray-500">{item.no}</td><td className="px-3 py-2 font-medium text-gray-800">{item.item}</td><td className="px-3 py-2 text-gray-700">{item.content}</td><td className="px-3 py-2 text-gray-600">{item.target}</td></tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* 7. 보고용 핵심 메시지 */}
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-amber-900 mb-1.5">7. 보고용 핵심 메시지</h3>
                                <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">{expandedHistoryData.key_message}</p>
                              </div>

                              {/* 붙임. 기관별 세부 요약 */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-800 px-3 py-2"><h3 className="text-xs font-bold text-white">붙임. 기관별 세부 요약</h3></div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100"><th className="px-3 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">기관</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">성과지표 현황</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">이번 주 실적</th><th className="px-3 py-1.5 text-left font-semibold text-gray-600">차주 계획/비고</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(expandedHistoryData.institution_details ?? []).map((item, i) => (
                                        <tr key={i}><td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{item.organization}</td><td className="px-3 py-2 text-gray-600">{item.kpi_status}</td><td className="px-3 py-2 text-gray-700">{item.current_week}</td><td className="px-3 py-2 text-gray-600">{item.next_week}</td></tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-sm text-gray-400 py-6">데이터를 불러올 수 없습니다.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 승인 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <p className="text-sm font-medium text-gray-900 mb-5">
              {confirm.user_code} 보고서를 승인하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button onClick={doApprove} disabled={actionLoading}
                className="flex-1 font-medium py-2.5 rounded-xl text-sm text-white transition-colors bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400">
                {actionLoading ? '처리 중...' : '승인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
