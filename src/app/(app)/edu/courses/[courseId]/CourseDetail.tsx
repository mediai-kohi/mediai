'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import ApplyQr from './ApplyQr'
import SessionManager from './SessionManager'
import CheckinScanner from './CheckinScanner'
import ParticipantList from './ParticipantList'
import CourseDashboard from './CourseDashboard'

export interface EduSession {
  id: string
  label: string
  session_date: string | null
  checkpoint_start_enabled: boolean
  checkpoint_mid_enabled: boolean
  checkpoint_end_enabled: boolean
}

export interface EduCourse {
  id: string
  slug: string
  title: string
  location: string
  capacity: number
  description: string
  course_type: 'single' | 'series'
  created_by: string
  created_at: string
}

type Tab = 'overview' | 'sessions' | 'checkin' | 'participants' | 'dashboard'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'sessions', label: '회차 관리' },
  { key: 'checkin', label: '체크인' },
  { key: 'participants', label: '참가자' },
  { key: 'dashboard', label: '대시보드' },
]

export default function CourseDetail({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<EduCourse | null>(null)
  const [sessions, setSessions] = useState<EduSession[]>([])
  const [registrationCount, setRegistrationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')

  const load = useCallback(async () => {
    const res = await fetch(`/api/edu/courses/${courseId}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '과정을 찾을 수 없습니다.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setCourse(data.course)
    setSessions(data.sessions ?? [])
    setRegistrationCount(data.registrationCount ?? 0)
    setLoading(false)
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray-400">불러오는 중...</div>
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <p className="text-sm text-gray-500 mb-3">{error || '과정을 찾을 수 없습니다.'}</p>
        <Link href="/edu" className="text-sm text-blue-600 font-medium">과정 목록으로</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="px-4 pt-4">
        <Link href="/edu" className="text-xs text-gray-400 mb-2 inline-block">← 과정 목록</Link>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{course.title}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {course.location || '장소 미정'} · 신청 {registrationCount}{course.capacity > 0 ? ` / ${course.capacity}` : ''}명
            </p>
          </div>
          <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            course.course_type === 'series' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {course.course_type === 'series' ? '다회차' : '단일'}
          </span>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-gray-50 mt-3 px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4">
        {tab === 'overview' && <ApplyQr course={course} onUpdated={load} />}
        {tab === 'sessions' && <SessionManager courseId={courseId} courseType={course.course_type} sessions={sessions} onChanged={load} />}
        {tab === 'checkin' && <CheckinScanner courseId={courseId} sessions={sessions} />}
        {tab === 'participants' && <ParticipantList courseId={courseId} />}
        {tab === 'dashboard' && <CourseDashboard courseId={courseId} />}
      </div>
    </div>
  )
}
