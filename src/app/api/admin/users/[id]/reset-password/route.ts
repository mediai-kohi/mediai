import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { insertAuditLog } from '@/lib/audit'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user, admin } = ctx

  const temp_password = randomBytes(9).toString('base64url')

  const { error } = await admin.auth.admin.updateUserById(id, { password: temp_password })
  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  await insertAuditLog({
    action: 'admin.password.reset',
    userId: user.id,
    targetType: 'user',
    targetId: id,
    ipAddress: ip,
  })

  return NextResponse.json({ temp_password })
}
