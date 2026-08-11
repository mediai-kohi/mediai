import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CourseList from './CourseList'

export default async function EduPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  const { data: profile } = user
    ? await admin.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  return <CourseList isSuperAdmin={profile?.role === 'super_admin'} />
}
