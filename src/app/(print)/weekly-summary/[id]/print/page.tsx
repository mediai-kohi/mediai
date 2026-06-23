import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { WeeklySummaryData } from '@/lib/weeklySummary'
import { KPI_LABELS } from '@/lib/weeklySummary'
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

const HEADLINE_COLORS = [
  { bg: '#f0fdfa', num: '#0d9488', bar: '#14b8a6' },
  { bg: '#eff6ff', num: '#2563eb', bar: '#3b82f6' },
  { bg: '#fffbeb', num: '#d97706', bar: '#f59e0b' },
  { bg: '#faf5ff', num: '#7c3aed', bar: '#8b5cf6' },
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
    ? new Date(row.confirmed_at).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—'
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

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
        <div className="flex justify-between items-start mb-5 pb-4 border-b-2 border-gray-800 no-break">
          <div>
            <p className="text-[11px] text-gray-400 mb-1 tracking-wider">의료AI 사업관리시스템</p>
            <h1 className="text-xl font-bold text-gray-900">{snap.period_label} 주간 실적 요약</h1>
            <p className="text-xs text-gray-500 mt-1">{snap.period_start} ~ {snap.period_end}</p>
          </div>
          <div className="text-right">
            <span style={{display:'inline-block',padding:'2px 10px',borderRadius:'999px',fontSize:'11px',fontWeight:600,background:'#d1fae5',color:'#065f46',border:'1px solid #a7f3d0'}}>
              ✓ 확정
            </span>
            <p className="text-[11px] text-gray-400 mt-2">확정일: {confirmedDate}</p>
            <p className="text-[11px] text-gray-400">출력일: {today}</p>
          </div>
        </div>

        {/* ── 기관 제출 요약 배너 ── */}
        <div className="no-break mb-5 px-4 py-2.5 rounded-lg" style={{background:'#f8fafc',border:'1px solid #e2e8f0'}}>
          <p className="text-xs text-gray-600">
            <span className="font-semibold">제출 현황: </span>
            전체 {snap.org_statuses.length}개 기관 중{' '}
            {snap.submitted_count}개 제출 · {snap.approved_count}개 승인 완료
          </p>
        </div>

        {/* ── 핵심 성과 지표 (Headline KPI) ── */}
        <div className="no-break mb-5">
          <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:4,background:'#1f2937',color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>●</span>
            핵심 성과 지표
          </h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
            {snap.headline_kpis.map((kpi, i) => {
              const c = HEADLINE_COLORS[i]
              const actualStr = kpi.actual % 1 === 0 ? kpi.actual.toLocaleString() : kpi.actual.toFixed(1)
              const targetStr = kpi.target % 1 === 0 ? kpi.target.toLocaleString() : kpi.target.toFixed(1)
              return (
                <div key={i} style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'10px 12px',background:c.bg}}>
                  <p style={{fontSize:9,color:'#9ca3af',marginBottom:2,letterSpacing:'0.05em'}}>{kpi.labelEn}</p>
                  <p style={{fontSize:10,color:'#374151',marginBottom:5,fontWeight:600}}>{kpi.label}</p>
                  <p style={{fontSize:20,fontWeight:700,color:c.num,margin:'2px 0',lineHeight:1}}>{actualStr}</p>
                  {kpi.target > 0 && (
                    <>
                      <p style={{fontSize:9,color:'#9ca3af',margin:'3px 0'}}> / {targetStr}{kpi.unit}</p>
                      <div style={{height:3,background:'#e5e7eb',borderRadius:2,overflow:'hidden',marginBottom:3}}>
                        <div style={{width:`${Math.min(kpi.progress,100)}%`,height:'100%',background:c.bar,borderRadius:2}} />
                      </div>
                      <p style={{fontSize:9,color:c.num}}>{kpi.tagline} · {kpi.rate.toFixed(1)}%</p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── AI 핵심 메시지 ── */}
        {aiReport?.key_message && (
          <div className="no-break mb-5 px-4 py-3 rounded-lg" style={{background:'#ecfdf5',border:'1px solid #a7f3d0'}}>
            <p style={{fontSize:10,fontWeight:700,color:'#065f46',marginBottom:4}}>AI 분석 핵심 메시지</p>
            <p className="text-xs text-gray-700 leading-relaxed">
              {aiReport.key_message.split(/\n\n|\n(?=[A-Z가-힣])/)[0].trim()}
            </p>
          </div>
        )}

        {/* ── 1. KPI 달성 현황 ── */}
        <div className="no-break mb-5">
          <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:4,background:'#1f2937',color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>1</span>
            핵심 성과 지표(KPI) 달성 현황
          </h2>
          <table>
            <thead>
              <tr style={{background:'#f1f5f9'}}>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:190}}>지표명</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0'}}>연간 목표</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0'}}>누적 실적</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:80}}>달성률</th>
              </tr>
            </thead>
            <tbody>
              {snap.kpi_totals.map((k, i) => {
                const rate = parseFloat(k.rate) || 0
                const isOver = rate >= 100
                return (
                  <tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-800" style={{border:'1px solid #e2e8f0'}}>{k.label}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-600" style={{border:'1px solid #e2e8f0'}}>{k.target.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900" style={{border:'1px solid #e2e8f0'}}>{k.actual.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-center font-bold" style={{border:'1px solid #e2e8f0',color:isOver?'#059669':'#2563eb'}}>{k.rate}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── 2. 기관별 현황 ── */}
        <div className="no-break mb-5">
          <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:4,background:'#1f2937',color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>2</span>
            운영기관별 제출 현황
          </h2>
          <table>
            <thead>
              <tr style={{background:'#f1f5f9'}}>
                <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:110}}>기관명</th>
                <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:48}}>상태</th>
                {KPI_SHORT.map((l) => (
                  <th key={l} className="text-center px-1 py-2 font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',fontSize:10}}>{l}</th>
                ))}
                <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0'}}>이번 주 실적 / 다음 주 계획</th>
              </tr>
            </thead>
            <tbody>
              {snap.org_statuses.map((o, i) => (
                <tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}>
                  <td className="px-2 py-2 text-xs font-medium text-gray-800" style={{border:'1px solid #e2e8f0'}}>{o.org}</td>
                  <td className="px-2 py-2 text-center" style={{border:'1px solid #e2e8f0'}}>
                    <span style={{display:'inline-block',padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:600,background:o.display_status==='승인'?'#d1fae5':o.display_status==='제출'?'#dbeafe':'#f3f4f6',color:o.display_status==='승인'?'#065f46':o.display_status==='제출'?'#1e40af':'#6b7280'}}>
                      {o.display_status}
                    </span>
                  </td>
                  {KPI_LABELS.map((_, ki) => (
                    <td key={ki} className="px-1 py-2 text-center text-gray-700" style={{border:'1px solid #e2e8f0',fontSize:11}}>
                      {o.kpi_rows?.[ki]?.actual || '—'}
                    </td>
                  ))}
                  <td className="px-2 py-2" style={{border:'1px solid #e2e8f0',fontSize:11,maxWidth:180}}>
                    {o.tagline
                      ? <p style={{color:'#374151',marginBottom:o.next_week?3:0}}>{o.tagline}</p>
                      : <p style={{color:'#d1d5db',fontStyle:'italic'}}>미제출</p>
                    }
                    {o.next_week && (
                      <p style={{color:'#2563eb',fontSize:10}}>→ {o.next_week}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 3. 예산 집행 현황 ── */}
        {snap.budget?.total_budget > 0 && (
          <div className="no-break mb-5">
            <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:4,background:'#1f2937',color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>3</span>
              예산 집행 현황
            </h2>
            <div className="flex gap-6">
              <table style={{width:260,flexShrink:0}}>
                <tbody>
                  {[
                    {label:'총 사업 예산(보조금)',value:snap.budget.total_budget.toLocaleString()+'원'},
                    {label:'누적 집행액',value:snap.budget.total_executed.toLocaleString()+'원'},
                    {label:'집행률',value:snap.budget.execution_rate},
                  ].map((r) => (
                    <tr key={r.label} style={{borderBottom:'1px solid #e2e8f0'}}>
                      <td className="py-2 pr-3 text-xs text-gray-500" style={{width:140}}>{r.label}</td>
                      <td className="py-2 text-sm font-semibold text-gray-900">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(snap.budget.org_executions?.length ?? 0) > 0 && (
                <table style={{flex:1}}>
                  <thead>
                    <tr style={{background:'#f1f5f9'}}>
                      <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0'}}>기관명</th>
                      <th className="text-right px-2 py-1.5 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0'}}>집행액(원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.budget.org_executions.map((e) => (
                      <tr key={e.org} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td className="px-2 py-1.5 text-xs text-gray-700" style={{border:'1px solid #e2e8f0'}}>{e.org}</td>
                        <td className="px-2 py-1.5 text-xs text-right font-medium text-gray-900" style={{border:'1px solid #e2e8f0'}}>{e.executed.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── 4. AI 분석 — 기관별 핵심 동향 ── */}
        {aiReport?.institution_details && aiReport.institution_details.length > 0 && (
          <div className="no-break mb-5 page-break">
            <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:4,background:'#1f2937',color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>4</span>
              AI 분석 — 기관별 핵심 동향
            </h2>
            <table>
              <thead>
                <tr style={{background:'#f1f5f9'}}>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:100}}>기관명</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:130}}>KPI 현황</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0'}}>이번 주 주요 활동</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:150}}>다음 주 계획</th>
                </tr>
              </thead>
              <tbody>
                {aiReport.institution_details.map((d, i) => (
                  <tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}>
                    <td className="px-2 py-2 text-xs font-medium text-gray-800" style={{border:'1px solid #e2e8f0',verticalAlign:'top'}}>{d.organization}</td>
                    <td className="px-2 py-2 text-[10px] text-gray-600 leading-relaxed" style={{border:'1px solid #e2e8f0',verticalAlign:'top'}}>{d.kpi_status}</td>
                    <td className="px-2 py-2 text-[10px] text-gray-700 leading-relaxed" style={{border:'1px solid #e2e8f0',verticalAlign:'top'}}>{d.current_week}</td>
                    <td className="px-2 py-2 text-[10px] text-blue-600 leading-relaxed" style={{border:'1px solid #e2e8f0',verticalAlign:'top'}}>{d.next_week}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 5. 향후 운영 준비사항 ── */}
        {aiReport?.issues && aiReport.issues.length > 0 && (
          <div className="no-break mb-5">
            <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:4,background:'#1f2937',color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>5</span>
              향후 운영 준비사항
            </h2>
            <table>
              <thead>
                <tr style={{background:'#fef3c7'}}>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-amber-700" style={{border:'1px solid #fde68a',width:150}}>이슈</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-amber-700" style={{border:'1px solid #fde68a',width:100}}>해당 기관</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-amber-700" style={{border:'1px solid #fde68a'}}>평가 및 조치 방안</th>
                </tr>
              </thead>
              <tbody>
                {aiReport.issues.map((issue, i) => (
                  <tr key={i} style={{background:i%2===0?'white':'#fffbeb'}}>
                    <td className="px-3 py-2 text-xs font-semibold text-gray-900" style={{border:'1px solid #fde68a',verticalAlign:'top'}}>{issue.issue}</td>
                    <td className="px-3 py-2 text-xs text-gray-600" style={{border:'1px solid #fde68a',verticalAlign:'top'}}>{issue.organizations}</td>
                    <td className="px-3 py-2" style={{border:'1px solid #fde68a',verticalAlign:'top'}}>
                      <p className="text-xs text-gray-700 mb-1">{issue.assessment}</p>
                      <p className="text-xs text-blue-600">→ {issue.action}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 6. 다음 주 체크리스트 ── */}
        {aiReport?.next_week_checklist && aiReport.next_week_checklist.length > 0 && (
          <div className="no-break mb-5">
            <h2 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-2">
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,borderRadius:4,background:'#1f2937',color:'white',fontSize:10,fontWeight:700,flexShrink:0}}>6</span>
              다음 주 체크리스트
            </h2>
            <table>
              <thead>
                <tr style={{background:'#f1f5f9'}}>
                  <th className="text-center px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:30}}>No</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:120}}>항목</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0'}}>세부 내용</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-gray-600" style={{border:'1px solid #e2e8f0',width:80}}>담당/대상</th>
                </tr>
              </thead>
              <tbody>
                {aiReport.next_week_checklist.map((c, i) => (
                  <tr key={i} style={{background:i%2===0?'white':'#f8fafc'}}>
                    <td className="text-center px-2 py-2 text-xs text-gray-500" style={{border:'1px solid #e2e8f0'}}>{c.no}</td>
                    <td className="px-2 py-2 text-xs font-medium text-gray-800" style={{border:'1px solid #e2e8f0'}}>{c.item}</td>
                    <td className="px-2 py-2 text-xs text-gray-700" style={{border:'1px solid #e2e8f0'}}>{c.content}</td>
                    <td className="px-2 py-2 text-xs text-gray-600" style={{border:'1px solid #e2e8f0'}}>{c.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 푸터 ── */}
        <div className="no-break mt-8 pt-3 flex justify-between" style={{borderTop:'1px solid #e2e8f0',fontSize:10,color:'#9ca3af'}}>
          <span>의료AI 사업관리시스템 — 내부 자료</span>
          <span>출력일: {today}</span>
        </div>

      </div>
    </>
  )
}
