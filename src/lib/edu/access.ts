import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface EduContext {
  user: { id: string }
  admin: ReturnType<typeof createAdminClient>
  role: 'user' | 'super_admin'
  isSuperAdmin: boolean
}

// edu 모듈은 새 role을 만들지 않는다. status='approved'인 user/super_admin만 통과시키고,
// moh_editor/ministry_viewer는 (이미 미들웨어 CONFINED_ALLOWED로 이 경로 밖에 갇혀 있지만)
// API 라우트 레벨에서도 한 번 더 막는다.
export async function requireEduUser(): Promise<EduContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') return null
  if (profile.role !== 'user' && profile.role !== 'super_admin') return null

  return {
    user: { id: user.id },
    admin,
    role: profile.role,
    isSuperAdmin: profile.role === 'super_admin',
  }
}

// 만족도 문항 관리(전역 설정) 전용 — 소유권 개념 없이 role만 확인
export async function requireEduSuperAdmin(): Promise<EduContext | null> {
  const ctx = await requireEduUser()
  if (!ctx || !ctx.isSuperAdmin) return null
  return ctx
}

// "이 과정을 요청한 사용자가 만들었는가, 아니면 super_admin인가"를 매 요청마다 확인
export async function assertCourseAccess(ctx: EduContext, courseId: string) {
  const { data: course } = await ctx.admin
    .from('edu_courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course) return null
  if (!ctx.isSuperAdmin && course.created_by !== ctx.user.id) return null
  return course
}
