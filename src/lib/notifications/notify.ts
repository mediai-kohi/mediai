import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from './push'

export type UserNotificationType =
  | 'signup_approved'
  | 'inquiry_reply'
  | 'report_revision'
  | 'report_reminder'

export type AdminNotificationType = 'new_inquiry' | 'new_report'

export async function notifyUser(
  userId: string,
  type: UserNotificationType,
  title: string,
  body: string,
  referenceId?: string
): Promise<void> {
  const admin = createAdminClient()

  const { error: insertError } = await admin.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    reference_id: referenceId ?? null,
  })

  if (insertError) {
    console.error('[notify] notifications insert error:', insertError)
  }

  try {
    const url = referenceId
      ? type === 'inquiry_reply'
        ? `/inquiries/${referenceId}`
        : `/reports/${referenceId}`
      : type === 'report_reminder'
        ? '/reports'
        : '/'
    await sendPushNotification(userId, { title, body, url })
  } catch (err) {
    console.error('[notify] sendPushNotification failed:', err)
  }
}

export async function notifyAdmins(
  type: AdminNotificationType,
  title: string,
  body: string,
  referenceId?: string
): Promise<void> {
  const admin = createAdminClient()

  const { error: insertError } = await admin.from('admin_notifications').insert({
    type,
    title,
    body,
    reference_id: referenceId ?? null,
  })

  if (insertError) {
    console.error('[notify] admin_notifications insert error:', insertError)
  }

  const url = type === 'new_inquiry' ? '/admin/inquiries' : '/admin/reports'

  const { data: adminUsers } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin')

  if (adminUsers && adminUsers.length > 0) {
    await Promise.all(
      adminUsers.map((u) =>
        sendPushNotification(u.id, { title, body, url }).catch((err) =>
          console.error('[notify] admin push failed:', err)
        )
      )
    )
  }
}
