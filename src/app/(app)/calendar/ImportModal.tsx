'use client'

import { useRef, useState } from 'react'
import ExcelJS from 'exceljs'

interface RowError {
  row: number
  reason: string
}

interface ImportResult {
  imported: number
  errors: RowError[]
}

interface Props {
  onImported: () => void
  onClose: () => void
}

async function downloadTemplate() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('일정')
  ;[16, 18, 14, 10, 14, 10, 6, 8, 8, 14, 24].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.addRow(['기관', '제목', '시작일', '시작시간', '종료일', '종료시간', '종일', '반복', '요일', '반복종료일', '설명'])
  ws.addRow(['한국대학교', '팀 회의', '2026-06-10', '10:00', '2026-06-10', '11:00', 'N', '매주', '수', '2026-08-31', '주간 팀 미팅'])
  ws.addRow(['서울교육원', '교육 세미나', '2026-06-15', '09:00', '2026-06-16', '18:00', 'N', '없음', '', '', '연수원 세미나'])
  ws.addRow(['한국대학교', '격주 회의', '2026-06-10', '14:00', '2026-06-10', '15:00', 'N', '격주', '금', '2026-08-31', '격주 금요 회의'])
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '캘린더_일정_템플릿.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ImportModal({ onImported, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResult(null)
    setErrorMsg(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    setErrorMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/events/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? '업로드에 실패했습니다.')
      } else {
        setResult(data as ImportResult)
        if ((data as ImportResult).imported > 0) {
          onImported()
        }
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const canUpload = !!file && !loading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">파일로 일정 가져오기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-5">
          {/* 안내 + 템플릿 */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 space-y-2">
            <p className="font-medium">Excel(.xlsx, .xls) 또는 CSV 파일을 업로드하세요.</p>
            <p>필수 컬럼: <span className="font-mono">제목, 시작일, 종료일</span></p>
            <p>선택 컬럼: <span className="font-mono">기관, 시작시간, 종료시간, 종일(Y/N), 반복(없음/매주/격주), 요일(월~일, 매주·격주 시 필수), 반복종료일, 설명</span></p>
            <button
              type="button"
              onClick={() => { void downloadTemplate() }}
              className="inline-flex items-center gap-1.5 mt-1 text-blue-700 font-medium hover:underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              템플릿 다운로드
            </button>
          </div>

          {/* 파일 선택 */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-gray-500">
                {file ? file.name : '파일을 클릭하여 선택하세요'}
              </span>
            </div>
            {file && (
              <p className="mt-1 text-xs text-gray-400 text-right">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          {/* 오류 메시지 */}
          {errorMsg && (
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          {/* 결과 */}
          {result && (
            <div className="space-y-2">
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                result.imported > 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
              }`}>
                {result.imported > 0
                  ? `✓ ${result.imported}건의 일정이 등록되었습니다.`
                  : '등록된 일정이 없습니다.'}
                {result.errors.length > 0 && ` (오류 ${result.errors.length}건 제외)`}
              </div>
              {result.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    처리되지 않은 행
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-gray-100">
                    {result.errors.map(e => (
                      <div key={e.row} className="flex items-start gap-3 px-3 py-2 text-xs">
                        <span className="text-gray-400 shrink-0">{e.row}행</span>
                        <span className="text-red-600">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '업로드 중...' : '일정 가져오기'}
          </button>
        </div>
      </div>
    </div>
  )
}
