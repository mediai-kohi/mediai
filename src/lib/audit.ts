import { createAdminClient } from '@/lib/supabase/admin'

interface AuditEntry {
  userId?: string
  action: string
  targetType?: string
  targetId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function insertAuditLog(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('audit_log').insert({
    user_id:     entry.userId ?? null,
    action:      entry.action,
    target_type: entry.targetType ?? null,
    target_id:   entry.targetId ?? null,
    ip_address:  entry.ipAddress ?? null,
    user_agent:  entry.userAgent ?? null,
    metadata:    entry.metadata ?? null,
  })
  if (error) {
    console.error('[audit]', entry.action, error.message)
  }
}
