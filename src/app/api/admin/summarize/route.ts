import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rl = await checkRateLimit(ctx.user.id, 'summarize', 10)
  if (!rl.allowed) return rateLimitResponse(rl)

  const { admin } = ctx

  const { periodStarts, periodLabel, reportType, organization } = await request.json()
  if (!periodStarts || !Array.isArray(periodStarts) || periodStarts.length === 0) {
    return NextResponse.json({ error: '기간을 선택해주세요.' }, { status: 400 })
  }

  let query = admin
    .from('reports')
    .select('type, period_label, content, organization')
    .in('period_start', periodStarts)
    .neq('status', 'draft')
    .order('period_start', { ascending: true })

  if (organization && organization !== 'all') query = query.eq('organization', organization)
  if (reportType && reportType !== 'all') query = query.eq('type', reportType)

  const { data: reports, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reports || reports.length === 0) {
    return NextResponse.json({ error: '해당 기간에 제출된 보고서가 없습니다.' }, { status: 404 })
  }

  // 보고서 텍스트 포맷 (v2 content 기준)
  const KPI_LABELS = ['프로그램 운영(과정수)', '전문인력 양성(명)', '수료율(%)', '만족도 점수(점)', '지역확산(%)', '홍보(건)']
  const ACTIVITY_LABELS = ['직무교육', '대외협력 및 홍보', '기타']

  // 고유 기관 목록 추출 (보고서 순서 유지)
  const allOrgs = [...new Set(reports.map((r) => r.organization).filter(Boolean))]
  const orgCount = allOrgs.length
  const orgList = allOrgs.join(', ')

  const formatted = reports.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = r.content as any
    const typeLbl = r.type === 'weekly' ? '주간' : '월간'
    let body = ''

    if (c?.version === 2) {
      if (r.type === 'weekly') {
        const kpiLines = KPI_LABELS.map((label, i) => {
          const row = c.kpi_rows?.[i] ?? {}
          if (label === '전문인력 양성(명)') {
            return `${label}: 목표 ${row.target || '-'}, 수료 ${row.actual || '-'}, 교육중 ${row.actual_sub || '-'}`
          }
          return `${label}: 목표 ${row.target || '-'}, 실적 ${row.actual || '-'}`
        }).join(' / ')
        const actLines = ACTIVITY_LABELS.map((label, i) => {
          const row = c.activity_rows?.[i] ?? {}
          return `[${label}] 이번주: ${row.current_week || '-'} / 다음주: ${row.next_week || '-'}`
        }).join('\n')
        body = `성과지표: ${kpiLines}\n${actLines}`
      } else {
        const kpiLines = KPI_LABELS.map((label, i) => {
          const row = c.kpi_rows?.[i] ?? {}
          if (label === '전문인력 양성(명)') {
            return `${label}: 목표 ${row.target || '-'}, 수료 ${row.actual || '-'}, 교육중 ${row.actual_sub || '-'}`
          }
          return `${label}: 목표 ${row.target || '-'}, 실적 ${row.actual || '-'}`
        }).join(' / ')
        const qual = c.qualitative ?? {}
        body = `성과지표: ${kpiLines}\n정성목표: ${qual.target || '-'}\n정성실적: ${qual.actual || '-'} (달성률 ${qual.rate || '-'})\n향후계획: ${c.achievement_plan || '-'}`
      }
    } else {
      // 구버전 fallback
      if (r.type === 'weekly') {
        body = `완료업무: ${c?.completed || '-'}\n다음주계획: ${c?.next_plan || '-'}`
      } else {
        body = `주요성과: ${c?.achievements || '-'}\n다음달목표: ${c?.next_month_plan || '-'}`
      }
    }
    return `[${typeLbl}보고 | ${r.period_label} | ${r.organization}]\n${body}`
  }).join('\n\n---\n\n')

  const prompt = `다음은 ${periodLabel ?? periodStarts.join(', ')} 기간의 의료AI 보건의료인 직무교육사업 업무보고입니다.

【중요】이 보고서에는 총 ${orgCount}개 기관의 데이터가 있습니다: ${orgList}
institution_progress와 institution_details 배열에는 반드시 위 ${orgCount}개 기관 전체를 빠짐없이 포함해야 합니다. 기관을 생략하거나 누락하지 마세요.

${formatted}

위 내용을 분석하여 아래 JSON 형식으로 주간 실적보고서를 작성하세요. JSON만 반환:
{
  "overall_assessment": "종합판단 (3~5문장, 이번 주 전체 현황 및 주요 특이사항 서술)",
  "dashboard": [
    {"category": "교육운영 본격화", "content": "운영 중인 기관 및 과정 현황"},
    {"category": "교육 참여/성과", "content": "주요 수치 및 이수 현황"},
    {"category": "과정 개발·구체화", "content": "과정 개발 현황"},
    {"category": "모집·지역확산", "content": "모집 및 지역연계 현황"},
    {"category": "행정·운영관리", "content": "행정 진행 사항"}
  ],
  "key_summary": [
    {"no": 1, "keyword": "키워드(4자 내외)", "content": "핵심 내용 1~2문장"},
    {"no": 2, "keyword": "키워드", "content": "핵심 내용"},
    {"no": 3, "keyword": "키워드", "content": "핵심 내용"},
    {"no": 4, "keyword": "키워드", "content": "핵심 내용"},
    {"no": 5, "keyword": "키워드", "content": "핵심 내용"}
  ],
  "institution_progress": [
    /* 아래는 예시 1개 — 실제로는 ${orgCount}개 기관 전부 포함: ${orgList} */
    {"organization": "기관명", "stage": "추진단계", "current_week": "이번 주 핵심실적", "next_week": "다음 주 핵심계획", "status": "정상추진 또는 준비중 또는 관리필요"}
  ],
  "quantitative_summary": [
    {"indicator": "프로그램 운영", "organizations": "관련 기관명 나열", "content": "기관별 실적 수치 포함", "management_point": "관리 포인트"},
    {"indicator": "전문인력 양성", "organizations": "관련 기관명 나열", "content": "수료 N명, 교육중 N명 수치 포함", "management_point": "관리 포인트"},
    {"indicator": "수료율", "organizations": "관련 기관명 나열", "content": "실적 수치 포함", "management_point": "관리 포인트"},
    {"indicator": "만족도", "organizations": "관련 기관명 나열", "content": "점수 포함", "management_point": "관리 포인트"},
    {"indicator": "지역확산", "organizations": "관련 기관명 나열", "content": "실적 수치 포함", "management_point": "관리 포인트"},
    {"indicator": "홍보", "organizations": "관련 기관명 나열", "content": "실적 수치 포함", "management_point": "관리 포인트"}
  ],
  "issues": [
    {"issue": "이슈 제목", "organizations": "관련기관", "assessment": "현황 판단 1~2문장", "action": "조치방향 1문장"}
  ],
  "next_week_checklist": [
    {"no": 1, "item": "점검항목(6자 내외)", "content": "확인내용 1~2문장", "target": "확인대상 기관"},
    {"no": 2, "item": "점검항목", "content": "확인내용", "target": "확인대상"},
    {"no": 3, "item": "점검항목", "content": "확인내용", "target": "확인대상"},
    {"no": 4, "item": "점검항목", "content": "확인내용", "target": "확인대상"},
    {"no": 5, "item": "점검항목", "content": "확인내용", "target": "확인대상"},
    {"no": 6, "item": "점검항목", "content": "확인내용", "target": "확인대상"}
  ],
  "key_message": "보고용 핵심 메시지 (2~3문단, 전체를 아우르는 종합 평가 및 시사점)",
  "institution_details": [
    /* 아래는 예시 1개 — 실제로는 ${orgCount}개 기관 전부 포함: ${orgList} */
    {"organization": "기관명", "kpi_status": "프로그램 운영 N과정, 전문인력 양성 수료 N명·교육중 N명 등 주요 지표 수치", "current_week": "이번 주 실적 2~3문장", "next_week": "차주 계획 1~2문장"}
  ]
}

최종 확인: institution_progress와 institution_details 각각에 ${orgCount}개 기관(${orgList})이 모두 포함되었는지 반드시 확인하세요.`

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 8000,
      messages: [
        { role: 'system', content: '의료AI 교육사업 보고서를 작성하는 전문 보조자입니다. 주어진 JSON 스키마를 정확히 따르고 JSON만 반환하세요.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!aiRes.ok) {
    await admin.from('ai_audit_log').insert({
      user_id: ctx.user.id,
      endpoint: 'summarize',
      model: 'gpt-4o-mini',
      input_chars: prompt.length,
      output_chars: 0,
      status: 'error',
      error_message: `OpenAI API ${aiRes.status}`,
      metadata: { periodStarts, organization },
    })
    return NextResponse.json({ error: 'AI 요약 요청 실패' }, { status: 500 })
  }

  const aiData = await aiRes.json()
  const result = JSON.parse(aiData.choices[0].message.content)

  const koSort = (a: { organization: string }, b: { organization: string }) =>
    a.organization.localeCompare(b.organization, 'ko')
  if (Array.isArray(result.institution_progress)) result.institution_progress.sort(koSort)
  if (Array.isArray(result.institution_details)) result.institution_details.sort(koSort)

  await admin.from('ai_audit_log').insert({
    user_id: ctx.user.id,
    endpoint: 'summarize',
    model: 'gpt-4o-mini',
    input_chars: prompt.length,
    output_chars: aiData.choices[0].message.content.length,
    status: 'success',
    metadata: { periodStarts, organization, reports_count: reports.length },
  })

  return NextResponse.json(result)
}
