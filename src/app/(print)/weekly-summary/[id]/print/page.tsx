import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { WeeklySummaryData } from '@/lib/weeklySummary'
import { KPI_LABELS } from '@/lib/weeklySummary'
import PrintTrigger from './PrintTrigger'
import PrintButtons from './PrintButtons'

export default async function WeeklySummaryPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') redirect('/admin')

  const { data: row, error } = await admin
    .from('weekly_summaries')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !row) notFound()

  const snap = row.snapshot as WeeklySummaryData
  const confirmedDate = row.confirmed_at
    ? new Date(row.confirmed_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—'
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // KPI 라벨 약칭 (테이블 헤더 용)
  const KPI_SHORT = ['과정수', '수료(명)', '수료율', '만족도', '지역확산', '홍보(건)']

  return (
    <>
      <PrintTrigger />
      <style>{`
        @page { margin: 12mm 14mm; size: A4 portrait; }
        * { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', Arial, sans-serif !important; }
        body { background: white !important; color: #111 !important; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
          .no-break { page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { vertical-align: middle; }
      `}</style>

      <PrintButtons />

      <div className="max-w-[780px] mx-auto px-8 py-8 print:px-0 print:py-0">

        {/* ── 헤더 ── */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-800 no-break">
          <div>
            <p className="text-[11px] text-gray-400 mb-1 tracking-wider">의료AI 사업관리시스템</p>
            <h1 className="text-xl font-bold text-gray-900">{snap.period_label} 주간 실적 요약</h1>
            <p className="text-xs text-gray-500 mt-1">{snap.period_start} ~ {snap.period_end}</p>
          </div>
          <div className="text-right">
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: '#d1fae5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
              }}
            >
              ✓ 확정
            </span>
            <p className="text-[11px] text-gray-400 mt-2">확정일: {confirmedDate}</p>
            <p className="text-[11px] text-gray-400">출력일: {today}</p>
          </div>
        </div>

        {/* ── 기관 제출 요약 배너 ── */}
        <div
          className="no-break mb-5 px-4 py-2.5 rounded-lg"
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          <p className="text-xs text-gray-600">
            <span className="font-semibold">제출 현황: </span>
            전체 {snap.org_statuses.length}개 기관 중{' '}
            {snap.submitted_count}개 제출 · {snap.approved_count}개 승인 완료
          </p>
        </div>

        {/* ── 1. KPI 달성 현황 ── */}
        <div className="no-break mb-6">
          <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 4, background: '#1f2937',
                color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}
            >1</span>
            핵심 성과 지표(KPI) 달성 현황
          </h2>
          <table>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0', width: 190 }}>지표명</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0' }}>연간 목표</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0' }}>누적 실적</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0', width: 80 }}>달성률</th>
              </tr>
            </thead>
            <tbody>
              {snap.kpi_totals.map((k, i) => {
                const rate = parseFloat(k.rate) || 0
                const isOver = rate >= 100
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-800" style={{ border: '1px solid #e2e8f0' }}>{k.label}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-600" style={{ border: '1px solid #e2e8f0' }}>{k.target.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900" style={{ border: '1px solid #e2e8f0' }}>{k.actual.toLocaleString()}</td>
                    <td
                      className="px-3 py-2 text-sm text-center font-bold"
                      style={{ border: '1px solid #e2e8f0', color: isOver ? '#059669' : '#2563eb' }}
                    >
                      {k.rate}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── 2. 기관별 현황 ── */}
        <div className="no-break mb-6">
          <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 4, background: '#1f2937',
                color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}
            >2</span>
            운영기관별 제출 현황
          </h2>
          <table>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0', width: 120 }}>기관명</th>
                <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0', width: 52 }}>상태</th>
                {KPI_SHORT.map((l) => (
                  <th key={l} className="text-center px-1 py-2 font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0', fontSize: 10 }}>
                    {l}
                  </th>
                ))}
                <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0' }}>주요 활동 요약</th>
              </tr>
            </thead>
            <tbody>
              {snap.org_statuses.map((o, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                  <td className="px-2 py-2 text-xs font-medium text-gray-800" style={{ border: '1px solid #e2e8f0' }}>{o.org}</td>
                  <td className="px-2 py-2 text-center" style={{ border: '1px solid #e2e8f0' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background:
                          o.display_status === '승인' ? '#d1fae5' :
                          o.display_status === '제출' ? '#dbeafe' : '#f3f4f6',
                        color:
                          o.display_status === '승인' ? '#065f46' :
                          o.display_status === '제출' ? '#1e40af' : '#6b7280',
                      }}
                    >
                      {o.display_status}
                    </span>
                  </td>
                  {KPI_LABELS.map((_, ki) => (
                    <td key={ki} className="px-1 py-2 text-center text-gray-700" style={{ border: '1px solid #e2e8f0', fontSize: 11 }}>
                      {o.kpi_rows?.[ki]?.actual || '—'}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-gray-600" style={{ border: '1px solid #e2e8f0', fontSize: 11, maxWidth: 160 }}>
                    {o.tagline || <span className="text-gray-300 italic">미제출</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 3. 예산 집행 현황 ── */}
        {snap.budget?.total_budget > 0 && (
          <div className="no-break mb-6">
            <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, borderRadius: 4, background: '#1f2937',
                  color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}
              >3</span>
              예산 집행 현황
            </h2>
            <div className="flex gap-6">
              <table style={{ width: 260, flexShrink: 0 }}>
                <tbody>
                  {[
                    { label: '총 사업 예산(보조금)', value: snap.budget.total_budget.toLocaleString() + '원' },
                    { label: '누적 집행액', value: snap.budget.total_executed.toLocaleString() + '원' },
                    { label: '집행률', value: snap.budget.execution_rate },
                  ].map((r) => (
                    <tr key={r.label} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td className="py-2 pr-3 text-xs text-gray-500" style={{ width: 140 }}>{r.label}</td>
                      <td className="py-2 text-sm font-semibold text-gray-900">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(snap.budget.org_executions?.length ?? 0) > 0 && (
                <table style={{ flex: 1 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0' }}>기관명</th>
                      <th className="text-right px-2 py-1.5 text-xs font-semibold text-gray-600" style={{ border: '1px solid #e2e8f0' }}>집행액(원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.budget.org_executions.map((e) => (
                      <tr key={e.org} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="px-2 py-1.5 text-xs text-gray-700" style={{ border: '1px solid #e2e8f0' }}>{e.org}</td>
                        <td className="px-2 py-1.5 text-xs text-right font-medium text-gray-900" style={{ border: '1px solid #e2e8f0' }}>{e.executed.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── 푸터 ── */}
        <div
          className="no-break mt-8 pt-3 flex justify-between"
          style={{ borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#9ca3af' }}
        >
          <span>의료AI 사업관리시스템 — 내부 자료</span>
          <span>출력일: {today}</span>
        </div>

      </div>
    </>
  )
}
