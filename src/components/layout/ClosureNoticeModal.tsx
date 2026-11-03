'use client'

import { useEffect, useState } from 'react'

// 접속(브라우저 세션)마다 1회 표시
const STORAGE_KEY = 'eduops_closure_notice_v1_seen'

export default function ClosureNoticeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(STORAGE_KEY)
      if (!seen) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [])

  const handleClose = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch { /* 무시 */ }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="closure-notice-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="closure-notice-title" className="text-lg font-semibold text-gray-900">
            주간실적 보고 제출 마감 안내
          </h2>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm leading-6 text-gray-700">
          <p>기관별 교육 운영 종료에 따라 본 시스템을 통한 보고서 제출을 마감합니다.</p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              교육 운영이 종료됨에 따라{' '}
              <strong className="text-gray-900">11월 1주(11.2.~11.9.)</strong>를 마지막으로
              주간실적 보고 제출을 마감합니다.
            </li>
            <li>
              11월 1주 마지막 주간보고 작성 시{' '}
              <strong className="text-gray-900">성과지표 실적, 예상 집행금액</strong> 등
              데이터를 최종 확정하여 입력해 주시기 바랍니다.
            </li>
          </ol>
        </div>
        <div className="flex justify-end border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  )
}
