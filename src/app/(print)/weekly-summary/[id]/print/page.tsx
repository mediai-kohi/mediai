import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { WeeklySummaryData } from '@/lib/weeklySummary'
import PrintTrigger from './PrintTrigger'
import PrintButtons from './PrintButtons'

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

interface AiReportData {
  key_message?: string
  overall_assessment?: string
  institution_details?: AiInstitutionDetail[]
  issues?: AiIssue[]
  next_week_checklist?: Array<{ no: number; item: string; content: string; target: string }>
}

const KPI_COLORS = [
  { bg: '#f0fdfa', border: '#ccfbf1', num: '#0f766e', bar: '#14b8a6', badgeBg: '#ccfbf1', badgeColor: '#0f766e', en: '#5eead4' },
  { bg: '#eff6ff', border: '#dbeafe', num: '#1d4ed8', bar: '#3b82f6', badgeBg: '#dbeafe', badgeColor: '#1d4ed8', en: '#93c5fd' },
  { bg: '#fffbeb', border: '#fef3c7', num: '#b45309', bar: '#f59e0b', badgeBg: '#fef3c7', badgeColor: '#b45309', en: '#fcd34d' },
  { bg: '#faf5ff', border: '#ede9fe', num: '#6d28d9', bar: '#8b5cf6', badgeBg: '#ede9fe', badgeColor: '#6d28d9', en: '#c4b5fd' },
]

const KPI_ICONS = [
  <svg key="bar" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>,
  <svg key="people" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  <svg key="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="22" height="22"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  <svg key="globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="22" height="22"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
]

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

  const { data: aiRow } = await admin
    .from('ai_analysis_reports')
    .select('result')
    .eq('start_date', snap.period_start)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const aiReport = (aiRow?.result as AiReportData) ?? null

  const confirmedDate = row.confirmed_at
    ? new Date(row.confirmed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const aiDetails = aiReport?.institution_details ?? []
  const featuredOrgs = aiDetails.slice(0, 3)
  const otherOrgs = aiDetails.slice(3)
  const keyMessageBanner = aiReport?.key_message
    ? aiReport.key_message.split(/\n\n|\n(?=[A-Z가-힣])/)[0].trim()
    : null

  const R: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }
  const NUM_BADGE: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 4, background: '#1f2937',
    color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0,
  }

  return (
    <>
      <PrintTrigger />
      <style>{`
        @page { margin: 12mm 14mm; size: A4 portrait; }
        * { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', Arial, sans-serif !important; box-sizing: border-box; }
        body { background: white !important; color: #111 !important; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-break { page-break-inside: avoid; }
          .page-break { page-break-before: always; }
          .no-print { display: none !important; }
        }
      `}</style>

      <PrintButtons />

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 28px' }}>

        {/* ── 헤더 ── */}
        <div className="no-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid #1f2937' }}>
          <div>
            <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3, letterSpacing: '0.08em' }}>의료AI 사업관리시스템</p>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>{snap.period_label} 주간 실적 요약</h1>
            <p style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>{snap.period_start} ~ {snap.period_end}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>
              ✓ 확정 · {row.confirmed_at ? new Date(row.confirmed_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : ''}
            </span>
            <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>출력일: {today}</p>
          </div>
        </div>

        {/* ── 기관 제출 현황 배너 ── */}
        <div className="no-break" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: snap.all_approved ? '#10b981' : '#3b82f6', flexShrink: 0, display: 'inline-block' }} />
          <p style={{ fontSize: 11, color: '#4b5563', margin: 0, flex: 1 }}>
            {snap.all_approved
              ? `${snap.org_statuses.length}개 기관 전체 승인 완료 — 주간 실적 요약 확정`
              : `${snap.submitted_count}개 기관 제출 · ${snap.approved_count}개 기관 승인 (미제출 ${snap.org_statuses.length - snap.submitted_count}개)`}
          </p>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{snap.period_start} ~ {snap.period_end}</span>
        </div>

        {/* ── 1. 핵심 성과 대시보드 ── */}
        <div className="no-break" style={{ marginBottom: 18 }}>
          <div style={R}>
            <span style={NUM_BADGE}>1</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: 0 }}>핵심 성과 대시보드</p>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.1em' }}>KEY KPI</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {snap.headline_kpis.map((kpi, i) => {
              const c = KPI_COLORS[i]
              const actualStr = kpi.actual % 1 === 0 ? kpi.actual.toLocaleString() : kpi.actual.toFixed(1)
              const targetStr = kpi.target % 1 === 0 ? kpi.target.toLocaleString() : kpi.target.toFixed(1)
              return (
                <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* 상단: 라벨 + 아이콘 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: c.en, margin: '0 0 2px' }}>{kpi.labelEn}</p>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', margin: 0 }}>{kpi.label}</p>
                    </div>
                    <span style={{ color: c.en, opacity: 0.7 }}>{KPI_ICONS[i]}</span>
                  </div>
                  {/* 실적 수치 */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: c.num, lineHeight: 1 }}>{actualStr}</span>
                    {kpi.target > 0 && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>/ {targetStr}{kpi.unit}</span>
                    )}
                  </div>
                  {/* 진행바 + tagline + rate */}
                  {kpi.target > 0 && (
                    <div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.8)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{ width: `${Math.min(kpi.progress, 100)}%`, height: '100%', background: c.bar, borderRadius: 3 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: c.num, opacity: 0.8 }}>{kpi.tagline}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 6, background: c.badgeBg, color: c.badgeColor }}>{kpi.rate.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── AI 핵심 메시지 배너 ── */}
        {keyMessageBanner && (
          <div className="no-break" style={{ background: 'linear-gradient(to right, #059669, #0d9488)', borderRadius: 16, padding: '16px 20px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.8)', flexShrink: 0, marginTop: 5, display: 'inline-block' }} />
              <p style={{ fontSize: 12, lineHeight: 1.6, margin: 0, color: 'white' }}>{keyMessageBanner}</p>
            </div>
          </div>
        )}

        {/* ── 2. 주요 운영기관별 핵심 동향 ── */}
        <div className="no-break" style={{ marginBottom: 18 }}>
          <div style={R}>
            <span style={NUM_BADGE}>2</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: 0 }}>주요 운영기관별 핵심 동향</p>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.1em' }}>INSTITUTIONS</span>
          </div>

          {aiDetails.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {featuredOrgs.map((d, i) => {
                  const bullets = d.current_week
                    .split(/(?<=[.。])\s+/)
                    .map((s: string) => s.replace(/^[•·\-\s]+/, '').trim())
                    .filter((s: string) => s.length > 3)
                  return (
                    <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: 'white', display: 'flex', flexDirection: 'column' }}>
                      {/* KPI 상태 헤더 */}
                      <div style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6', padding: '10px 14px' }}>
                        <p style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5, margin: 0 }}>{d.kpi_status}</p>
                      </div>
                      {/* 본문 */}
                      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <span style={{ fontSize: 15 }}>🏛️</span>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: 0 }}>{d.organization}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                          {(bullets.length > 0 ? bullets : [d.current_week]).slice(0, 3).map((b: string, j: number) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                              <span style={{ width: 4, height: 4, borderRadius: 2, background: '#60a5fa', marginTop: 5, flexShrink: 0, display: 'inline-block' }} />
                              <p style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.5, margin: 0 }}>{b}</p>
                            </div>
                          ))}
                        </div>
                        {d.next_week && (
                          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8, marginTop: 10 }}>
                            <p style={{ fontSize: 10, color: '#2563eb', lineHeight: 1.5, margin: 0 }}>{d.next_week}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {otherOrgs.length > 0 && (
                <div style={{ marginTop: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 8px' }}>기타 기관 현황</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {otherOrgs.map((d: AiInstitutionDetail, i: number) => (
                      <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#1f2937', margin: 0 }}>{d.organization}</p>
                        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.kpi_status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* AI 없을 때 fallback: org status 카드 */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {snap.org_statuses.map((o, i) => (
                <div key={i} style={{
                  border: o.badge === '모니터링' ? '1px solid #fed7aa' : '1px solid #e5e7eb',
                  background: o.badge === '모니터링' ? '#fff7ed' : 'white',
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: 4, display: 'inline-block', flexShrink: 0,
                        background: o.display_status === '승인' ? '#10b981' : o.display_status === '제출' ? '#3b82f6' : '#d1d5db',
                      }} />
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0 }}>{o.org}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#374151', color: 'white', flexShrink: 0, marginLeft: 6 }}>{o.badge}</span>
                  </div>
                  {o.tagline
                    ? <p style={{ fontSize: 11, color: '#4b5563', margin: '0 0 8px' }}>{o.tagline}</p>
                    : <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', margin: '0 0 8px' }}>보고서 미제출</p>
                  }
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500,
                    background: o.display_status === '승인' ? '#d1fae5' : o.display_status === '제출' ? '#dbeafe' : '#f3f4f6',
                    color: o.display_status === '승인' ? '#065f46' : o.display_status === '제출' ? '#1e40af' : '#6b7280',
                  }}>
                    {o.display_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 3. 예산 집행 현황 ── */}
        {snap.budget?.total_budget > 0 && (
          <div className="no-break" style={{ marginBottom: 18 }}>
            <div style={R}>
              <span style={NUM_BADGE}>3</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: 0 }}>예산 집행 현황</p>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.1em' }}>BUDGET</span>
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <p style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.1em', margin: '0 0 4px' }}>TOTAL EXECUTED BUDGET</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
                    {snap.budget.total_executed.toLocaleString()}
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 4 }}>원 집행 완료</span>
                  </p>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    총 사업 예산 {(snap.budget.total_budget / 100_000_000).toFixed(1)}억원 대비 {snap.budget.execution_rate} 집행률 기록
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(parseFloat(snap.budget.execution_rate) || 0, 100)}%`,
                        height: '100%', background: '#f87171', borderRadius: 4,
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>누적 실집행률 {snap.budget.execution_rate}</p>
                  </div>
                </div>
                {(snap.budget.org_executions?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#4b5563', margin: '0 0 8px' }}>집행 완료 내역</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {snap.budget.org_executions.map((e) => (
                        <div key={e.org} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981', display: 'inline-block' }} />
                            <span style={{ fontSize: 11, color: '#374151' }}>{e.org}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#111827' }}>{e.executed.toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 4. 향후 운영 준비사항 ── */}
        <div className="no-break" style={{ marginBottom: 18 }}>
          <div style={R}>
            <span style={NUM_BADGE}>4</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: 0 }}>향후 운영 준비사항</p>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.1em' }}>ISSUES & ACTIONS</span>
          </div>
          {aiReport?.issues && aiReport.issues.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aiReport.issues.map((issue, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid #fed7aa', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{issue.issue}</p>
                        {issue.organizations && (
                          <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 6, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {issue.organizations}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.6, margin: 0 }}>{issue.assessment}</p>
                      <p style={{ fontSize: 11, color: '#2563eb', margin: '8px 0 0' }}>→ {issue.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>AI 분석 보고서가 없습니다. 보고서를 생성하면 이슈 및 관리 계획이 표시됩니다.</p>
            </div>
          )}
        </div>

        {/* ── 푸터 ── */}
        <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
          <span>의료AI 사업관리시스템 — 내부 자료</span>
          <span>출력일: {today}</span>
        </div>

      </div>
    </>
  )
}
