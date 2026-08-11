'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface Course {
  id: string
  slug: string
  title: string
  location: string
  capacity: number
  course_type: 'single' | 'series'
  created_by: string
  created_at: string
  registration_count: number
  creator_label?: string
}

export default function CourseList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [viewAll, setViewAll] = useState(false)

  const fetchCourses = useCallback(async (all: boolean) => {
    setLoading(true)
    const res = await fetch(`/api/edu/courses${all ? '?all=1' : ''}`)
    const data = await res.json()
    setCourses(data.courses ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCourses(viewAll)
  }, [fetchCourses, viewAll])

  return (
    <div className="max-w-2xl mx-auto md:max-w-3xl pb-24">
      <div className="sticky top-0 z-10 bg-gray-50 pt-4 pb-2 px-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-gray-900">교육 관리</h1>
          {isSuperAdmin && (
            <button
              onClick={() => setViewAll((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewAll ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {viewAll ? '전체 보기' : '내 과정만'}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">신청·출석·만족도 조사를 관리합니다.</p>
      </div>

      <div className="px-4 mt-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-gray-400">불러오는 중...</div>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-gray-500">아직 개설한 과정이 없습니다</p>
          </div>
        ) : (
          courses.map((course) => (
            <Link
              key={course.id}
              href={`/edu/courses/${course.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    course.course_type === 'series' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {course.course_type === 'series' ? '다회차' : '단일'}
                  </span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  신청 {course.registration_count}{course.capacity > 0 ? ` / ${course.capacity}` : ''}명
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">{course.title}</p>
              <p className="mt-1 text-xs text-gray-400">
                {course.location || '장소 미정'}
                {course.creator_label ? ` · ${course.creator_label}` : ''}
              </p>
            </Link>
          ))
        )}
      </div>

      <Link
        href="/edu/courses/new"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-20"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </Link>
    </div>
  )
}
