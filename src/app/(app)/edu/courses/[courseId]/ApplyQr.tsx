'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'
import type { EduCourse } from './CourseDetail'

export default function ApplyQr({ course, onUpdated }: { course: EduCourse; onUpdated: () => void }) {
  const router = useRouter()
  const qrRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [title, setTitle] = useState(course.title)
  const [location, setLocation] = useState(course.location)
  const [capacity, setCapacity] = useState(course.capacity > 0 ? String(course.capacity) : '')
  const [description, setDescription] = useState(course.description)
  const [completionThreshold, setCompletionThreshold] = useState(String(course.completion_threshold_percent))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 서버 렌더링 시점엔 접속 주소(휴대폰이 실제로 접근 중인 origin)를 알 수 없으므로,
  // NEXT_PUBLIC_APP_URL(예: localhost) 같은 잘못된 값으로 QR을 그렸다가 클라이언트에서
  // window.location.origin으로 다시 그리며 깜빡이는 것을 막기 위해 마운트 후에만 값을 채운다.
  const [applyUrl, setApplyUrl] = useState('')
  useEffect(() => {
    setApplyUrl(`${window.location.origin}/edu/apply/${course.slug}`)
  }, [course.slug])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(applyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${course.title}-신청QR.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleSave = async () => {
    const threshold = Number(completionThreshold)
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
      setError('수료 기준은 1~100 사이의 숫자로 입력해주세요.')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/edu/courses/${course.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        location,
        description,
        capacity: capacity === '' ? 0 : Number(capacity),
        completion_threshold_percent: threshold,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    setEditing(false)
    onUpdated()
  }

  const handleDelete = async () => {
    if (!confirm(`'${course.title}' 과정을 삭제하시겠습니까?\n회차, 신청자, 출석, 만족도 응답 기록이 모두 함께 삭제되며 되돌릴 수 없습니다.`)) return
    setDeleting(true)
    const res = await fetch(`/api/edu/courses/${course.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setDeleting(false)
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '처리 중 오류가 발생했습니다.')
      return
    }
    router.push('/edu')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center text-center">
        {applyUrl ? (
          <>
            <div ref={qrRef} className="p-3 bg-white rounded-lg border border-gray-100">
              <QRCodeCanvas value={applyUrl} size={200} />
            </div>
            <p className="mt-3 text-xs text-gray-500 break-all">{applyUrl}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCopy} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                {copied ? '복사됨' : '링크 복사'}
              </button>
              <button onClick={handleDownload} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
                QR 다운로드
              </button>
            </div>
          </>
        ) : (
          <div className="w-[200px] h-[200px] flex items-center justify-center text-xs text-gray-300">불러오는 중...</div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">과정 정보</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-blue-600">수정</button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="과정명"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="장소"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="정원 (비우면 무제한)"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="설명"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            <div>
              <label className="block text-xs text-gray-400 mb-1">수료 기준 (%) — 전체 교육시간 대비 출석 인정 비율</label>
              <input type="number" min={1} max={100} value={completionThreshold} onChange={(e) => setCompletionThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 text-sm text-gray-500">취소</button>
            </div>
          </div>
        ) : (
          <dl className="text-sm space-y-2">
            <div className="flex gap-2"><dt className="text-gray-400 w-14 flex-shrink-0">장소</dt><dd className="text-gray-700">{course.location || '-'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-14 flex-shrink-0">정원</dt><dd className="text-gray-700">{course.capacity > 0 ? `${course.capacity}명` : '무제한'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-14 flex-shrink-0">설명</dt><dd className="text-gray-700 whitespace-pre-wrap">{course.description || '-'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-14 flex-shrink-0">수료 기준</dt><dd className="text-gray-700">{course.completion_threshold_percent}% 이상</dd></div>
          </dl>
        )}
      </div>

      <div className="bg-white border border-red-100 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-red-600 mb-2">위험 구역</h2>
        <p className="text-xs text-gray-500 mb-3">과정을 삭제하면 회차, 신청자, 출석, 만족도 응답 기록이 모두 함께 삭제되며 되돌릴 수 없습니다.</p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 px-4 py-2 rounded-lg"
        >
          {deleting ? '삭제 중...' : '과정 삭제'}
        </button>
      </div>
    </div>
  )
}
