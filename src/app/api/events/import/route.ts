import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Excel 날짜 시리얼 → ISO 문자열 변환
function excelSerialToDate(serial: number): string {
  // Excel epoch: 1900-01-01 (단, 1900-02-29 버그로 인해 +1 보정 불필요, -1 보정)
  const utcDays = serial - 25569
  const ms = utcDays * 86400 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

// 날짜 문자열 정규화 → 'YYYY-MM-DD'
function normalizeDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return excelSerialToDate(val)
  const s = String(val).trim()
  // YYYY-MM-DD 또는 YYYY/MM/DD
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return null
}

// 시간 문자열 정규화 → 'HH:MM'
function normalizeTime(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') {
    // Excel 시간 소수 (0.375 = 09:00)
    const totalMins = Math.round(val * 1440)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const s = String(val).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  return null
}

function isTruthy(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false
  const s = String(val).trim().toLowerCase()
  return ['y', 'yes', 'true', '1', '예', '네', '종일'].includes(s)
}

// 헤더 키 정규화: 한국어/영어 → 내부 키
const HEADER_MAP: Record<string, string> = {
  '기관': 'organization', organization: 'organization',
  '제목': 'title', title: 'title',
  '시작일': 'start_date', start_date: 'start_date', '시작날짜': 'start_date',
  '시작시간': 'start_time', start_time: 'start_time',
  '시작일시': 'start_at', start_at: 'start_at',
  '종료일': 'end_date', end_date: 'end_date', '종료날짜': 'end_date',
  '종료시간': 'end_time', end_time: 'end_time',
  '종료일시': 'end_at', end_at: 'end_at',
  '종일': 'is_allday', is_allday: 'is_allday', allday: 'is_allday',
  '반복': 'repeat_type', repeat_type: 'repeat_type',
  '요일': 'repeat_day', repeat_day: 'repeat_day',
  '반복종료일': 'repeat_until', repeat_until: 'repeat_until',
  '설명': 'description', description: 'description', '내용': 'description',
}

const REPEAT_MAP: Record<string, string> = {
  '없음': 'none', none: 'none', '': 'none',
  '매주': 'weekly',   weekly:   'weekly',
  '격주': 'biweekly', biweekly: 'biweekly',
}

const DAY_MAP: Record<string, number> = {
  '일': 0, sun: 0,
  '월': 1, mon: 1,
  '화': 2, tue: 2,
  '수': 3, wed: 3,
  '목': 4, thu: 4,
  '금': 5, fri: 5,
  '토': 6, sat: 6,
}

type ParsedRow = {
  title: string
  description: string
  start_at: string
  end_at: string
  is_allday: boolean
  organization?: string
  repeat_type?: string
  repeat_day?: string
  repeat_until?: string
}

function expandOccurrences(row: ParsedRow): { start_at: string; end_at: string }[] {
  const repeatType = row.repeat_type ?? 'none'
  if (repeatType === 'none' || !row.repeat_until) {
    return [{ start_at: row.start_at, end_at: row.end_at }]
  }

  const untilDate = new Date(row.repeat_until + 'T23:59:59+09:00')
  const start = new Date(row.start_at)
  const end   = new Date(row.end_at)

  // 반복 이벤트: 종료일은 시리즈 마지막날과 동일하게 쓰는 경우가 많으므로
  // 날짜 차이는 무시하고 시작시간→종료시간의 시각(time-of-day) 차이만 기간으로 사용
  const startDayMs = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const endDayMs   = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  let duration = (end.getTime() - endDayMs) - (start.getTime() - startDayMs)
  if (duration <= 0) duration += 24 * 3600 * 1000  // 자정을 넘기는 이벤트

  const MAX = 366
  const occurrences: { start_at: string; end_at: string }[] = []
  let cur = new Date(start)

  // 요일이 지정된 경우 시작일을 해당 요일로 이동 (on or after 시작일)
  if ((repeatType === 'weekly' || repeatType === 'biweekly') && row.repeat_day) {
    const targetDay = DAY_MAP[row.repeat_day.trim()]
    if (targetDay !== undefined) {
      const diff = (targetDay - cur.getUTCDay() + 7) % 7
      cur.setUTCDate(cur.getUTCDate() + diff)
    }
  }

  while (cur <= untilDate && occurrences.length < MAX) {
    occurrences.push({
      start_at: new Date(cur).toISOString(),
      end_at:   new Date(cur.getTime() + duration).toISOString(),
    })
    if (repeatType === 'weekly')        cur.setUTCDate(cur.getUTCDate() + 7)
    else if (repeatType === 'biweekly') cur.setUTCDate(cur.getUTCDate() + 14)
  }
  return occurrences
}

type RowError = { row: number; reason: string }

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    return NextResponse.json({ error: '.xlsx, .xls, .csv 파일만 지원합니다.' }, { status: 400 })
  }

  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 5MB를 초과할 수 없습니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let rows: Record<string, unknown>[]
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  } catch {
    return NextResponse.json({ error: '파일 파싱에 실패했습니다. 형식을 확인해 주세요.' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 400 })
  }

  const valid: ParsedRow[] = []
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2 // 헤더가 1행이므로 데이터는 2행부터

    // 헤더 정규화
    const r: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      const key = HEADER_MAP[k.trim()] ?? k.trim()
      r[key] = v
    }

    const title = String(r.title ?? '').trim()
    if (!title) {
      errors.push({ row: rowNum, reason: '제목이 비어 있습니다.' })
      continue
    }

    const isAllday = isTruthy(r.is_allday)
    let startAt: string | null = null
    let endAt: string | null = null

    // 합쳐진 날짜시간 필드 우선
    if (r.start_at) {
      const d = normalizeDate(r.start_at)
      const t = normalizeTime(r.start_at)
      if (d) startAt = t ? `${d}T${t}:00+09:00` : `${d}T00:00:00+09:00`
    } else {
      const d = normalizeDate(r.start_date)
      if (d) {
        const t = normalizeTime(r.start_time)
        startAt = isAllday ? `${d}T00:00:00+09:00` : (t ? `${d}T${t}:00+09:00` : `${d}T09:00:00+09:00`)
      }
    }

    if (r.end_at) {
      const d = normalizeDate(r.end_at)
      const t = normalizeTime(r.end_at)
      if (d) endAt = t ? `${d}T${t}:00+09:00` : `${d}T23:59:59+09:00`
    } else {
      const d = normalizeDate(r.end_date)
      if (d) {
        const t = normalizeTime(r.end_time)
        endAt = isAllday ? `${d}T23:59:59+09:00` : (t ? `${d}T${t}:00+09:00` : `${d}T18:00:00+09:00`)
      }
    }

    if (!startAt) {
      errors.push({ row: rowNum, reason: '시작일을 인식할 수 없습니다.' })
      continue
    }
    if (!endAt) {
      errors.push({ row: rowNum, reason: '종료일을 인식할 수 없습니다.' })
      continue
    }
    if (new Date(startAt) > new Date(endAt)) {
      errors.push({ row: rowNum, reason: '시작일이 종료일보다 늦습니다.' })
      continue
    }

    valid.push({
      title,
      description:  String(r.description ?? '').trim(),
      start_at:     startAt,
      end_at:       endAt,
      is_allday:    isAllday,
      organization: String(r.organization ?? '').trim() || undefined,
      repeat_type:  REPEAT_MAP[String(r.repeat_type ?? '').trim()] ?? 'none',
      repeat_day:   String(r.repeat_day ?? '').trim() || undefined,
      repeat_until: normalizeDate(r.repeat_until) ?? undefined,
    })
  }

  if (valid.length === 0) {
    return NextResponse.json({ imported: 0, errors })
  }

  const insertRecords: object[] = []

  for (const e of valid) {
    const occurrences = expandOccurrences(e)
    const repeat_group_id = occurrences.length > 1 ? crypto.randomUUID() : undefined
    const org = (profile.role === 'super_admin' && e.organization)
      ? e.organization
      : (profile.organization ?? '')

    for (const occ of occurrences) {
      insertRecords.push({
        user_id:      user.id,
        organization: org,
        agency_type:  null,
        title:        e.title,
        description:  e.description,
        start_at:     occ.start_at,
        end_at:       occ.end_at,
        is_allday:    e.is_allday,
        color:        'blue',
        source:       'document',
        is_public:    false,
        ...(repeat_group_id ? { repeat_group_id } : {}),
      })
    }
  }

  const { error: insertError } = await admin.from('events').insert(insertRecords)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ imported: insertRecords.length, errors })
}
