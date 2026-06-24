import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { admin }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { data, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: id })
  if (listError) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  const totpFactors = data?.factors?.filter((f) => f.factor_type === 'totp') ?? []
  if (totpFactors.length === 0) {
    return NextResponse.json({ error: '등록된 OTP가 없습니다.' }, { status: 404 })
  }

  for (const factor of totpFactors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: id, id: factor.id })
    if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
