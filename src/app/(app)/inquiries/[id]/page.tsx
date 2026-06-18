import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import InquiryDetail from './InquiryDetail'

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const admin = createAdminClient()

  const [{ data: inquiry }, { data: profile }] = await Promise.all([
    admin
      .from('inquiries')
      .select('*')
      .eq('id', id)
      .single(),
    admin
      .from('profiles')
      .select('role, organization')
      .eq('id', user.id)
      .single(),
  ])

  if (!inquiry) notFound()

  const isAdmin = profile?.role === 'super_admin'
  const isOwner = inquiry.user_id === user.id

  // 접근 권한 체크: 비공개 글은 본인/관리자만
  if (!isAdmin && !isOwner && !inquiry.is_public) notFound()

  const [{ data: author }, { data: repliesRaw }, { data: attachments }] = await Promise.all([
    admin
      .from('profiles')
      .select('email, organization')
      .eq('id', inquiry.user_id)
      .single(),
    admin
      .from('inquiry_replies')
      .select('id, content, created_at, admin_id')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true }),
    admin
      .from('attachments')
      .select('id, filename, size, created_at')
      .eq('entity_type', 'inquiry')
      .eq('entity_id', id)
      .order('created_at', { ascending: true }),
  ])

  // 답변 작성자 프로필을 별도 쿼리로 조회 (FK join 방식 대신 명시적 lookup)
  const adminIds = [...new Set((repliesRaw ?? []).map((r: { admin_id: string }) => r.admin_id).filter(Boolean))]
  const { data: adminProfiles } = adminIds.length > 0
    ? await admin.from('profiles').select('id, email, organization').in('id', adminIds)
    : { data: [] as { id: string; email: string; organization: string }[] }

  const replies = (repliesRaw ?? []).map((reply: { id: string; content: string; created_at: string; admin_id: string }) => ({
    id: reply.id,
    content: reply.content,
    created_at: reply.created_at,
    admin: adminProfiles?.find(p => p.id === reply.admin_id) ?? null,
  }))

  return (
    <InquiryDetail
      inquiry={{ ...inquiry, author: author ?? null }}
      replies={replies}
      attachments={attachments ?? []}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  )
}
