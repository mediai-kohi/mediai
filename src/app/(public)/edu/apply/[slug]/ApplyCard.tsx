'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { participantCodeStorageKey } from '@/lib/edu/participantStorage'

export default function ApplyCard({ slug, courseId, isFull }: { slug: string; courseId: string; isFull: boolean }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [existingCode, setExistingCode] = useState<string | null>(null)
  const [forceNew, setForceNew] = useState(false)

  useEffect(() => {
    setExistingCode(localStorage.getItem(participantCodeStorageKey(courseId)))
  }, [courseId])

  const handleApply = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/edu/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '처리 중 오류가 발생했습니다.')
        setSubmitting(false)
        return
      }
      localStorage.setItem(participantCodeStorageKey(courseId), data.code)
      router.push(`/edu/t/${data.code}`)
    } catch {
      setError('처리 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  if (isFull) {
    return (
      <div className="bg-gray-100 text-gray-500 text-sm font-medium py-3 rounded-xl">
        정원이 마감되었습니다.
      </div>
    )
  }

  // 같은 기기에서 이미 신청한 흔적(참가자 코드)이 있으면, 실수로 중복 신청하는 것을 막고
  // 기존 코드로 안내한다. (개인정보 없이 기기 단위로만 판단 — 강제 차단은 아니며 우회 가능)
  if (existingCode && !forceNew) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-700">이 기기로 이미 신청하셨습니다.</p>
          <p className="mt-1 text-lg font-mono font-bold text-gray-900 tracking-widest">{existingCode}</p>
        </div>
        <Link
          href={`/edu/t/${existingCode}`}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm text-center transition-colors"
        >
          신청 확인증 보기
        </Link>
        <button onClick={() => setForceNew(true)} className="w-full text-xs text-gray-400">
          다른 분이 신청하시나요? 새로 신청하기
        </button>
      </div>
    )
  }

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button
        onClick={handleApply}
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm transition-colors"
      >
        {submitting ? '신청 중...' : '신청하기'}
      </button>
    </>
  )
}
