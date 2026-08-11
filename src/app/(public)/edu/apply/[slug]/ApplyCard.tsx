'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ApplyCard({ slug, isFull }: { slug: string; isFull: boolean }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
