import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MohReportForm from './MohReportForm'

export default async function MohReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, department')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'moh_editor'].includes(profile.role)) redirect('/')

  return <MohReportForm role={profile.role} department={profile.department} />
}
