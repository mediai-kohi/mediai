'use client'

import type { OrgStatus } from '@/lib/weeklySummary'
import { KPI_LABELS, HEADLINE_KPI_CONFIG, parseNum } from '@/lib/weeklySummary'

const ACTIVITY_LABELS = ['직무교육', '대외협력 및 홍보', '기타'] as const

interface Props {
  org: OrgStatus
  onClose: () => void
}

export default function OrgDetailDrawer({ org, onClose }: Props) {
  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* 드로어 패널 */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{org.org}</h2>
            <p className="text-xs text-gray-500 mt-0.5">운영기관별 세부 실적</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* 제출 상태 */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              org.display_status === '승인'
                ? 'bg-emerald-100 text-emerald-700'
                : org.display_status === '제출'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {org.display_status}
            </span>
            {org.db_status === 'revision_requested' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                정정요청
              </span>
            )}
          </div>

          {org.kpi_rows ? (
            <>
              {/* KPI 정량 지표 */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">정량 지표</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">지표</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">목표</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">실적</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">달성률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {KPI_LABELS.map((label, i) => {
                        const row = org.kpi_rows![i]
                        const targetNum = parseNum(row?.target)
                        const actualNum = parseNum(row?.actual)
                        const rate = targetNum > 0
                          ? `${((actualNum / targetNum) * 100).toFixed(1)}%`
                          : '—'
                        const isHeadline = HEADLINE_KPI_CONFIG.some((c) => c.kpiIndex === i)
                        return (
                          <tr key={label} className={isHeadline ? 'bg-blue-50/40' : ''}>
                            <td className="px-3 py-2.5 text-xs text-gray-700 font-medium">{label}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 text-right">{row?.target || '-'}</td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-gray-900 text-right">{row?.actual || '-'}</td>
                            <td className={`px-3 py-2.5 text-xs text-right font-medium ${
                              rate !== '—' && parseFloat(rate) >= 100
                                ? 'text-emerald-600'
                                : 'text-gray-700'
                            }`}>{rate}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 활동 현황 */}
              {org.activity_rows && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">활동 현황</h3>
                  <div className="space-y-3">
                    {ACTIVITY_LABELS.map((label, i) => {
                      const row = org.activity_rows![i]
                      if (!row) return null
                      return (
                        <div key={label} className="border border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">{label}</p>
                          <div className="space-y-1.5">
                            {row.current_week && (
                              <div>
                                <span className="text-xs text-gray-400">이번주: </span>
                                <span className="text-xs text-gray-700">{row.current_week}</span>
                              </div>
                            )}
                            {row.next_week && (
                              <div>
                                <span className="text-xs text-gray-400">다음주: </span>
                                <span className="text-xs text-gray-700">{row.next_week}</span>
                              </div>
                            )}
                            {row.note && (
                              <div>
                                <span className="text-xs text-gray-400">비고: </span>
                                <span className="text-xs text-gray-500">{row.note}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">아직 제출된 보고서가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
