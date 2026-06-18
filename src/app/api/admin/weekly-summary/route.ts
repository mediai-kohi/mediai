import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  computeWeeklySummary,
  getMonday,
  addDays,
  formatDateOnly,
  getISOWeekInfo,
} from '@/lib/weeklySummary'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function GET(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const weekParam = searchParams.get('week')

  // 기준 월요일 계산
  let weekStart: Date
  if (yearParam && weekParam) {
    // ISO 주차 → 월요일 날짜 계산
    const year = parseInt(yearParam)
    const week = parseInt(weekParam)
    const jan4 = new Date(year, 0, 4)
    const startOfWeek1 = new Date(jan4)
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
    weekStart = new Date(startOfWeek1)
    weekStart.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  } else {
    weekStart = getMonday(new Date())
  }

  const weekEnd = addDays(weekStart, 6)
  const startStr = formatDateOnly(weekStart)
  const endStr = formatDateOnly(weekEnd)

  // 해당 주차 weekly 보고서 조회 (제출 이상 상태)
  const { data: weeklyReports } = await admin
    .from('reports')
    .select('id, organization, type, status, period_start, period_end, content, submitted_at, approved_at, created_at')
    .eq('type', 'weekly')
    .gte('period_start', startStr)
    .lte('period_start', endStr)
    .in('status', ['submitted', 'resubmitted', 'approved', 'revision_requested'])

  // 최근 월간 보고서 (예산 집계용)
  const { data: monthlyReports } = await admin
    .from('reports')
    .select('id, organization, type, status, period_start, period_end, content, submitted_at, created_at')
    .eq('type', 'monthly')
    .eq('status', 'approved')
    .order('period_start', { ascending: false })
    .limit(24)

  // 기존 확정 레코드 조회
  const { year, week_number } = getISOWeekInfo(weekStart)
  const { data: existing } = await admin
    .from('weekly_summaries')
    .select('status, confirmed_at')
    .eq('year', year)
    .eq('week_number', week_number)
    .maybeSingle()

  const summary = computeWeeklySummary(
    weeklyReports ?? [],
    weekStart,
    (existing?.status as 'partial' | 'confirmed') ?? 'partial',
    existing?.confirmed_at ?? null,
    monthlyReports ?? []
  )

  // partial 레코드 upsert (아카이브 목록 표시 및 이력 보존용)
  if (!existing || existing.status !== 'confirmed') {
    await admin.from('weekly_summaries').upsert({
      year,
      week_number,
      period_label: summary.period_label,
      period_start: summary.period_start,
      period_end: summary.period_end,
      status: 'partial',
      snapshot: summary,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'year,week_number' }).select()
  }

  return NextResponse.json(summary)
}

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const body = await request.json() as { year?: number; week?: number; force?: boolean }
  const { year, week, force = false } = body

  let weekStart: Date
  if (year && week) {
    const jan4 = new Date(year, 0, 4)
    const startOfWeek1 = new Date(jan4)
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
    weekStart = new Date(startOfWeek1)
    weekStart.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  } else {
    weekStart = getMonday(new Date())
  }

  const weekEnd = addDays(weekStart, 6)
  const startStr = formatDateOnly(weekStart)
  const endStr = formatDateOnly(weekEnd)

  const { data: weeklyReports } = await admin
    .from('reports')
    .select('id, organization, type, status, period_start, period_end, content, submitted_at, approved_at, created_at')
    .eq('type', 'weekly')
    .gte('period_start', startStr)
    .lte('period_start', endStr)
    .in('status', ['submitted', 'resubmitted', 'approved', 'revision_requested'])

  const { data: monthlyReports } = await admin
    .from('reports')
    .select('id, organization, type, status, period_start, period_end, content, submitted_at, created_at')
    .eq('type', 'monthly')
    .eq('status', 'approved')
    .order('period_start', { ascending: false })
    .limit(24)

  const summary = computeWeeklySummary(weeklyReports ?? [], weekStart, 'confirmed', null, monthlyReports ?? [])

  if (!force && !summary.all_approved) {
    return NextResponse.json(
      { error: '아직 승인되지 않은 기관이 있습니다. force=true로 강제 확정할 수 있습니다.', submitted_count: summary.submitted_count, approved_count: summary.approved_count },
      { status: 400 }
    )
  }

  const { year: y, week_number: w } = getISOWeekInfo(weekStart)
  const confirmedAt = new Date().toISOString()
  const confirmedSummary = { ...summary, status: 'confirmed' as const, confirmed_at: confirmedAt }

  const { data: upserted, error } = await admin
    .from('weekly_summaries')
    .upsert({
      year: y,
      week_number: w,
      period_label: summary.period_label,
      period_start: summary.period_start,
      period_end: summary.period_end,
      status: 'confirmed',
      confirmed_at: confirmedAt,
      snapshot: confirmedSummary,
      updated_at: confirmedAt,
    }, { onConflict: 'year,week_number' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...confirmedSummary, id: upserted?.id })
}
