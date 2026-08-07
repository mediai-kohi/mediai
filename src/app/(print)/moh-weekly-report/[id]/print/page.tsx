import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MOH_DEPARTMENTS, deriveMohWeekLabels, type MohDeptKey } from '@/lib/mohWeeklyReport'
import PrintTrigger from './PrintTrigger'
import PrintButtons from './PrintButtons'

interface AttachmentRow {
  id: string
  filename: string
  section: string | null
}

export default async function MohWeeklyReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !['super_admin', 'moh_editor', 'ministry_viewer'].includes(p.role)) redirect('/')

  const { data: row } = await admin.from('moh_weekly_reports').select('*').eq('id', id).single()
  if (!row) notFound()

  const isMinistry = p.role === 'ministry_viewer'
  const bioVisible = row.bio_status === 'submitted' || !isMinistry
  const aiVisible = row.ai_status === 'submitted' || !isMinistry
  if (isMinistry && !bioVisible && !aiVisible) notFound()

  const { data: attachmentRows } = await admin
    .from('attachments')
    .select('id, filename, section')
    .eq('entity_type', 'moh_weekly_report')
    .eq('entity_id', id)

  const attachments = (attachmentRows ?? []) as AttachmentRow[]
  const attachmentsFor = (section: string) => attachments.filter((a) => a.section === section)

  const visibleFor = (key: MohDeptKey) => (key === 'bio' ? bioVisible : aiVisible)
  const textFor = (key: MohDeptKey, cell: 'prev' | 'next') =>
    key === 'bio'
      ? (cell === 'prev' ? row.bio_prev_week : row.bio_next_week)
      : (cell === 'prev' ? row.ai_prev_week : row.ai_next_week)

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const { thisWeekLabel, nextWeekLabel } = deriveMohWeekLabels(row.period_start, row.period_end)

  const th: React.CSSProperties = {
    border: '1px solid #cbd5e1', padding: '8px 10px', background: '#1f2937', color: 'white',
    fontSize: 11, fontWeight: 700, textAlign: 'center',
  }
  const td: React.CSSProperties = {
    border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: 11, verticalAlign: 'top',
  }

  return (
    <>
      <PrintTrigger />
      <style>{`
        @page { margin: 12mm 14mm; size: A4 landscape; }
        * { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', Arial, sans-serif !important; box-sizing: border-box; }
        body { background: white !important; color: #111 !important; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-break { page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>

      <PrintButtons />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 28px' }}>
        <div className="no-break" style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>&lt;바이오헬스전문인력양성기반구축&gt;</p>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{row.period_label} 주간 업무 보고</h1>
          <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>한국보건복지인재원 · 출력일: {today}</p>
        </div>

        <table className="no-break" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '14%' }}>사업명</th>
              <th style={{ ...th, width: '12%' }}>담당부서</th>
              <th style={{ ...th, width: '37%' }}>이번주({thisWeekLabel}) 추진 실적</th>
              <th style={{ ...th, width: '37%' }}>다음주({nextWeekLabel}) 추진 계획</th>
            </tr>
          </thead>
          <tbody>
            {MOH_DEPARTMENTS.map((d) => (
              <tr key={d.key}>
                <td style={{ ...td, fontWeight: 600, background: '#f8fafc' }}>{d.majorCategory}</td>
                <td style={{ ...td, fontWeight: 600, background: '#f8fafc' }}>{d.department}</td>
                {(['prev', 'next'] as const).map((cell) => (
                  <td key={cell} style={td}>
                    {!visibleFor(d.key) ? (
                      <span style={{ color: '#9ca3af' }}>(미제출)</span>
                    ) : (
                      <>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{textFor(d.key, cell)}</div>
                        {attachmentsFor(`${d.key}_${cell}`).map((f) => (
                          <p key={f.id} style={{ fontSize: 10, color: '#2563eb', margin: '4px 0 0' }}>[별첨] {f.filename}</p>
                        ))}
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
