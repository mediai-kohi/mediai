'use client'

export default function PrintButtons() {
  return (
    <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-700"
      >
        인쇄 / PDF 저장
      </button>
      <button
        onClick={() => window.close()}
        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg shadow hover:bg-gray-300"
      >
        닫기
      </button>
    </div>
  )
}
