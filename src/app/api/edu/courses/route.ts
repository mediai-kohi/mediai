import { NextResponse } from 'next/server'
import { requireEduUser } from '@/lib/edu/access'
import { generateCourseSlug } from '@/lib/edu/codes'

interface SessionInput {
  label?: string
  session_date?: string | null
  checkpoint_start_enabled?: boolean
  checkpoint_mid_enabled?: boolean
  checkpoint_end_enabled?: boolean
}

function normalizeSession(input: SessionInput, index: number) {
  const label = (input.label ?? '').trim() || `${index + 1}회차`
  const checkpoint_start_enabled = !!input.checkpoint_start_enabled
  const checkpoint_mid_enabled = !!input.checkpoint_mid_enabled
  const checkpoint_end_enabled = !!input.checkpoint_end_enabled

  if (!checkpoint_start_enabled && !checkpoint_mid_enabled && !checkpoint_end_enabled) {
    return { error: `${label}: 체크포인트를 최소 1개 이상 선택해야 합니다.` }
  }

  return {
    value: {
      label,
      session_date: input.session_date || null,
      checkpoint_start_enabled,
      checkpoint_mid_enabled,
      checkpoint_end_enabled,
    },
  }
}

// 과정 목록 — 일반 사용자는 본인 개설 과정만, super_admin은 ?all=1 로 전체 조회
export async function GET(request: Request) {
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const wantsAll = searchParams.get('all') === '1' && ctx.isSuperAdmin

  let query = ctx.admin
    .from('edu_courses')
    .select('id, slug, title, location, capacity, course_type, created_by, created_at')
    .order('created_at', { ascending: false })

  if (!wantsAll) query = query.eq('created_by', ctx.user.id)

  const { data: courses, error } = await query
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  const courseIds = (courses ?? []).map((c) => c.id)
  const registrationCounts: Record<string, number> = {}
  const creatorLabels: Record<string, string> = {}

  if (courseIds.length > 0) {
    const { data: regs } = await ctx.admin
      .from('edu_registrations')
      .select('course_id')
      .in('course_id', courseIds)
    for (const r of regs ?? []) {
      registrationCounts[r.course_id] = (registrationCounts[r.course_id] ?? 0) + 1
    }

    if (wantsAll) {
      const creatorIds = [...new Set((courses ?? []).map((c) => c.created_by))]
      const { data: creators } = await ctx.admin
        .from('profiles')
        .select('id, organization, user_code')
        .in('id', creatorIds)
      for (const p of creators ?? []) {
        creatorLabels[p.id] = `${p.organization || '미지정'} (${p.user_code})`
      }
    }
  }

  const result = (courses ?? []).map((c) => ({
    ...c,
    registration_count: registrationCounts[c.id] ?? 0,
    creator_label: wantsAll ? (creatorLabels[c.created_by] ?? '-') : undefined,
  }))

  return NextResponse.json({ courses: result, viewingAll: wantsAll })
}

// 과정 개설 — status='approved'인 user/super_admin 누구나
export async function POST(request: Request) {
  const ctx = await requireEduUser()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  const title: string = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: '과정명을 입력해주세요.' }, { status: 400 })

  const courseType: string = body.course_type === 'series' ? 'series' : 'single'
  const location: string = (body.location ?? '').trim()
  const description: string = (body.description ?? '').trim()
  const capacityRaw = body.capacity
  const capacity = Number.isFinite(Number(capacityRaw)) && Number(capacityRaw) > 0 ? Math.floor(Number(capacityRaw)) : 0

  const sessionInputs: SessionInput[] = Array.isArray(body.sessions) ? body.sessions : []
  if (sessionInputs.length === 0) {
    return NextResponse.json({ error: '회차를 최소 1개 이상 구성해야 합니다.' }, { status: 400 })
  }
  if (courseType === 'single' && sessionInputs.length !== 1) {
    return NextResponse.json({ error: '단일 교육은 회차를 1개만 가질 수 있습니다.' }, { status: 400 })
  }

  const normalizedSessions: NonNullable<ReturnType<typeof normalizeSession>['value']>[] = []
  for (let i = 0; i < sessionInputs.length; i++) {
    const result = normalizeSession(sessionInputs[i], i)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
    normalizedSessions.push(result.value!)
  }

  let slug = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateCourseSlug()
    const { data } = await ctx.admin.from('edu_courses').select('id').eq('slug', candidate).maybeSingle()
    if (!data) { slug = candidate; break }
  }
  if (!slug) return NextResponse.json({ error: '신청 URL 생성에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })

  const { data: course, error: courseError } = await ctx.admin
    .from('edu_courses')
    .insert({
      slug,
      title,
      location,
      description,
      capacity,
      course_type: courseType,
      created_by: ctx.user.id,
    })
    .select()
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  const { error: sessionsError } = await ctx.admin
    .from('edu_sessions')
    .insert(normalizedSessions.map((s) => ({ ...s, course_id: course.id })))

  if (sessionsError) {
    await ctx.admin.from('edu_courses').delete().eq('id', course.id)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ course }, { status: 201 })
}
