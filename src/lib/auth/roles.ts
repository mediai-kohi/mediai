import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type Role = 'super_admin' | 'user' | 'moh_editor' | 'ministry_viewer'

export interface RoleContext {
  user: { id: string }
  admin: ReturnType<typeof createAdminClient>
  profile: { role: Role; department: string | null; organization: string }
}

// 신규 주간업무보고 기능 전용 인가 유틸. 기존 requireAdmin() 중복 정의는 건드리지 않음.
export async function requireRole(allowed: Role[]): Promise<RoleContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, department, organization')
    .eq('id', user.id)
    .single()

  if (!profile || !allowed.includes(profile.role as Role)) return null

  return { user: { id: user.id }, admin, profile: profile as RoleContext['profile'] }
}
