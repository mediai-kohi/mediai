import { MOH_DEPARTMENTS, deriveMohWeekLabels, type MohDeptKey } from '@/lib/mohWeeklyReport'

interface AttachmentRow {
  id: string
  filename: string
  size: number
  section: string | null
}

interface MohReportRowData {
  period_start: string
  period_end: string
  bio_status: string
  bio_prev_week: string
  bio_next_week: string
  ai_status: string
  ai_prev_week: string
  ai_next_week: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// 주간업무보고 PDF 인쇄 구성(사업명/담당부서/이번주 실적/다음주 계획 4단 표)을 화면에도 동일하게 재현
export default function MohReportTable({
  row,
  attachments,
  maskUnsubmitted,
}: {
  row: MohReportRowData
  attachments: AttachmentRow[]
  maskUnsubmitted: boolean
}) {
  const { thisWeekLabel, nextWeekLabel } = deriveMohWeekLabels(row.period_start, row.period_end)
  const attachmentsFor = (section: string) => attachments.filter((a) => a.section === section)
  const statusFor = (key: MohDeptKey) => (key === 'bio' ? row.bio_status : row.ai_status)
  const visibleFor = (key: MohDeptKey) => !maskUnsubmitted || statusFor(key) === 'submitted'
  const textFor = (key: MohDeptKey, cell: 'prev' | 'next') =>
    key === 'bio'
      ? (cell === 'prev' ? row.bio_prev_week : row.bio_next_week)
      : (cell === 'prev' ? row.ai_prev_week : row.ai_next_week)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="border border-gray-700 px-3 py-2.5 text-xs font-semibold w-[14%]">사업명</th>
            <th className="border border-gray-700 px-3 py-2.5 text-xs font-semibold w-[12%]">담당부서</th>
            <th className="border border-gray-700 px-3 py-2.5 text-xs font-semibold w-[37%]">이번주({thisWeekLabel}) 추진 실적</th>
            <th className="border border-gray-700 px-3 py-2.5 text-xs font-semibold w-[37%]">다음주({nextWeekLabel}) 추진 계획</th>
          </tr>
        </thead>
        <tbody>
          {MOH_DEPARTMENTS.map((d) => (
            <tr key={d.key} className="align-top">
              <td className="border border-gray-200 px-3 py-3 text-xs font-semibold text-gray-700 bg-gray-50">{d.majorCategory}</td>
              <td className="border border-gray-200 px-3 py-3 text-xs font-semibold text-gray-900 bg-gray-50">
                {d.department}
                <span className={`block mt-1 text-[10px] font-medium ${statusFor(d.key) === 'submitted' ? 'text-green-600' : 'text-gray-400'}`}>
                  {statusFor(d.key) === 'submitted' ? '제출완료' : '작성중'}
                </span>
              </td>
              {(['prev', 'next'] as const).map((cell) => (
                <td key={cell} className="border border-gray-200 px-3 py-3 align-top">
                  {!visibleFor(d.key) ? (
                    <span className="text-xs text-gray-300">(미제출)</span>
                  ) : (
                    <>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{textFor(d.key, cell)}</div>
                      {attachmentsFor(`${d.key}_${cell}`).map((f) => (
                        <a
                          key={f.id}
                          href={`/api/attachments/${f.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 mt-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-blue-600 hover:underline"
                        >
                          [별첨] {f.filename}
                          <span className="text-[10px] text-gray-400 ml-auto">{formatSize(f.size)}</span>
                        </a>
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
  )
}
