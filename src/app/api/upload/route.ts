import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(user.id, 'upload', 20)
  if (!rl.allowed) return rateLimitResponse(rl)

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })

  const clientType = file.type || ''
  if (!ALLOWED_MIME.has(clientType)) {
    return NextResponse.json({ error: '허용되지 않는 파일 형식입니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // magic bytes 기반 서버 측 MIME 검증
  const { fileTypeFromBuffer } = await import('file-type')
  const detected = await fileTypeFromBuffer(buffer)
  if (detected) {
    const isOfficeXml = clientType.includes('openxmlformats')
    const detectedIsZip = detected.mime === 'application/zip'
    const typesMatch = detected.mime === clientType || (isOfficeXml && detectedIsZip)
    if (!typesMatch) {
      return NextResponse.json({ error: '파일 형식이 일치하지 않습니다.' }, { status: 400 })
    }
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`
  const storagePath = `${user.id}/${uniqueName}`

  const admin = createAdminClient()

  const { error } = await admin.storage
    .from('attachments')
    .upload(storagePath, buffer, { contentType: clientType || 'application/octet-stream', upsert: false })

  if (error) return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })

  return NextResponse.json({ path: storagePath, filename: file.name, size: file.size })
}
