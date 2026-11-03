'use client'

// 11월 1주(마지막 주간보고) 작성 화면 진입 시 LMS 최종 확인 안내
export const LMS_CHECK_NOTICE_WEEK = '2026-11-02'

export default function LmsCheckNoticeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lms-check-notice-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="lms-check-notice-title" className="text-lg font-semibold text-gray-900">
            실적 입력하기 전 잠깐! LMS는 최종 확인하셨나요?
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm leading-6 text-gray-700">
          <p>
            기관 평가를 위해 LMS 최종 확인을{' '}
            <strong className="text-gray-900">11월 6일까지</strong>로 안내하였습니다.
          </p>
          <p>
            이점 확인하시어 <strong className="text-gray-900">LMS 실적 최종확인 후</strong>{' '}
            주간실적 자료를 작성하여 주시기 바랍니다.
          </p>
        </div>
        <div className="flex justify-end border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  )
}
