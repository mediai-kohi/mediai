'use client'

import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import type { EduCourse } from './CourseDetail'

export default function ApplyQr({ course, onUpdated }: { course: EduCourse; onUpdated: () => void }) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(course.title)
  const [location, setLocation] = useState(course.location)
  const [capacity, setCapacity] = useState(course.capacity > 0 ? String(course.capacity) : '')
  const [description, setDescription] = useState(course.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const applyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/edu/apply/${course.slug}`
    : `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/edu/apply/${course.slug}`

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

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center text-center">
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
          </dl>
        )}
      </div>
    </div>
  )
}
