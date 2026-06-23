import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const { searchParams } = new URL(request.url)

  let from: Date
  let to: Date

  const dateParam  = searchParams.get('date')
  const startParam = searchParams.get('start')
  const endParam   = searchParams.get('end')

  if (dateParam) {
    from = new Date(`${dateParam}T00:00:00.000Z`)
    to   = new Date(`${dateParam}T23:59:59.999Z`)
  } else if (startParam && endParam) {
    from = new Date(`${startParam}T00:00:00.000Z`)
    to   = new Date(`${endParam}T23:59:59.999Z`)
  } else {
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    from = new Date(year, month - 1, 1)
    from.setDate(from.getDate() - 7)
    to = new Date(year, month, 1)
    to.setDate(to.getDate() + 7)
  }

  const isAdmin = profile.role === 'super_admin'

  let query = admin
    .from('events')
    .select('*')
    .gte('start_at', from.toISOString())
    .lte('start_at', to.toISOString())
    .order('start_at', { ascending: true })

  const org = searchParams.get('organization')
  const isHome = searchParams.get('home') === 'true'

  if (org && org !== 'all') {
    // 선택한 기관 일정 + is_public=true 일정 항상 포함
    query = query.or(`organization.eq.${org},is_public.eq.true`)
  } else if (isHome && !isAdmin && profile.organization) {
    // 홈 화면: 본인 소속기관 일정 + 관리자가 항상 표시로 등록한 일정만
    query = query.or(`organization.eq.${profile.organization},is_public.eq.true`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('group_id')
  const title   = searchParams.get('title')
  if (!groupId && !title) return NextResponse.json({ error: 'group_id or title required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'super_admin'

  if (groupId) {
    let query = admin.from('events').delete().eq('repeat_group_id', groupId)
    if (!isAdmin) {
      // 같은 기관 사용자는 기관 단위 삭제 허용 (단일 삭제와 동일한 sameOrg 정책)
      if (profile?.organization) {
        query = query.eq('organization', profile.organization)
      } else {
        query = query.eq('user_id', user.id)
      }
    }
    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // 제목 기반 삭제: 같은 기관 사용자는 기관 단위 삭제 허용
    let titleQuery = admin.from('events').delete().eq('title', title!)
    if (!isAdmin) {
      if (profile?.organization) {
        titleQuery = titleQuery.eq('organization', profile.organization)
      } else {
        titleQuery = titleQuery.eq('user_id', user.id)
      }
    }
    const { error } = await titleQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    group_id, title_match, from_start_at, current_id,
    title, description, color, is_allday, is_public, organization,
    new_start_at, new_end_at,
  } = body

  if (!from_start_at || !current_id) {
    return NextResponse.json({ error: 'from_start_at and current_id required' }, { status: 400 })
  }
  if (!group_id && !title_match) {
    return NextResponse.json({ error: 'group_id or title_match required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'super_admin'

  let selectQuery = admin
    .from('events')
    .select('id, start_at, end_at')
    .gte('start_at', from_start_at)

  if (group_id) {
    selectQuery = selectQuery.eq('repeat_group_id', group_id)
  } else {
    selectQuery = selectQuery.eq('title', title_match)
  }

  if (!isAdmin) {
    if (profile?.organization) {
      selectQuery = selectQuery.eq('organization', profile.organization)
    } else {
      selectQuery = selectQuery.eq('user_id', user.id)
    }
  }

  const { data: futureEvents, error: fetchError } = await selectQuery
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!futureEvents || futureEvents.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 })
  }

  const newStartDate = new Date(new_start_at)
  const newEndDate   = new Date(new_end_at)
  const offsetMs     = newStartDate.getTime() - new Date(from_start_at).getTime()
  const durationMs   = newEndDate.getTime() - newStartDate.getTime()

  const commonFields = {
    title, description, color, is_allday, is_public,
    ...(isAdmin && organization ? { organization } : {}),
  }

  const updateResults = await Promise.all(
    futureEvents.map(ev => {
      let start_at_upd: string, end_at_upd: string

      if (ev.id === current_id) {
        start_at_upd = new_start_at
        end_at_upd   = new_end_at
      } else if (is_allday) {
        // 날짜를 offsetMs만큼 이동한 뒤 종일 형식으로 정규화
        const shifted = new Date(new Date(ev.start_at).getTime() + offsetMs)
        const ymd = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth()+1).padStart(2,'0')}-${String(shifted.getUTCDate()).padStart(2,'0')}`
        start_at_upd = `${ymd}T00:00:00.000Z`
        end_at_upd   = `${ymd}T23:59:59.999Z`
      } else {
        // 날짜+시간 모두 동일한 offset으로 이동 (요일 변경 포함)
        const ns = new Date(new Date(ev.start_at).getTime() + offsetMs)
        start_at_upd = ns.toISOString()
        end_at_upd   = new Date(ns.getTime() + durationMs).toISOString()
      }

      return admin
        .from('events')
        .update({ ...commonFields, start_at: start_at_upd, end_at: end_at_upd })
        .eq('id', ev.id)
    })
  )

  const firstErr = updateResults.find(r => r.error)
  if (firstErr?.error) return NextResponse.json({ error: firstErr.error.message }, { status: 500 })

  return NextResponse.json({ ok: true, updated: futureEvents.length })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, role, status')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.status !== 'approved' && profile.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Not approved' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, start_at, end_at, is_allday, color, is_public, repeat_group_id, organization } = body

  if (!title?.trim() || !start_at || !end_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const VALID_COLORS = ['blue','green','red','orange','purple','gray']
  const safeColor = VALID_COLORS.includes(color) ? color : 'blue'

  const canPublish = profile.role === 'super_admin'
  const targetOrg = (canPublish && organization) ? organization : profile.organization

  if (!targetOrg) {
    return NextResponse.json({ error: '등록 기관이 지정되지 않았습니다.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('events')
    .insert({
      user_id:      user.id,
      organization: targetOrg,
      title:        title.trim(),
      description:  description?.trim() ?? '',
      start_at,
      end_at,
      is_allday:    is_allday ?? false,
      color:        safeColor,
      is_public:    canPublish ? (is_public ?? false) : false,
      source:       'manual',
      ...(repeat_group_id ? { repeat_group_id } : {}),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
