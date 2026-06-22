import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sortOrgsByFixedOrder } from '@/lib/orgColors'
import CalendarView from './CalendarView'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, organization')
    .eq('id', user!.id)
    .single()

  // 모든 사용자에게 기관 목록 제공 (기관별 필터링 지원)
  const { data: userProfiles } = await admin
    .from('profiles')
    .select('organization')
    .eq('status', 'approved')
    .not('organization', 'is', null)
    .neq('organization', '')

  const organizations = sortOrgsByFixedOrder([...new Set(
    (userProfiles ?? []).map((p: { organization: string }) => p.organization).filter(Boolean) as string[]
  )])

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] md:h-screen">
        <p className="text-sm text-gray-500">프로필을 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] md:h-screen flex flex-col">
      <CalendarView
        profile={{
          id:           profile.id,
          role:         profile.role,
          organization: profile.organization ?? '',
        }}
        organizations={organizations}
      />
    </div>
  )
}
