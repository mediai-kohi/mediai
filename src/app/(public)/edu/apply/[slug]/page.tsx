import { createAdminClient } from '@/lib/supabase/admin'
import ApplyCard from './ApplyCard'

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: course } = await admin
    .from('edu_courses')
    .select('id, title, location, description, capacity')
    .eq('slug', slug)
    .single()

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-600">존재하지 않는 과정입니다.</p>
        </div>
      </div>
    )
  }

  let registrationCount = 0
  if (course.capacity > 0) {
    const { count } = await admin
      .from('edu_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', course.id)
    registrationCount = count ?? 0
  }

  const isFull = course.capacity > 0 && registrationCount >= course.capacity

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{course.title}</h1>
          {course.location && <p className="text-sm text-gray-500 mb-1">{course.location}</p>}
          {course.description && <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap leading-relaxed">{course.description}</p>}

          <div className="mt-6">
            <ApplyCard slug={slug} isFull={isFull} />
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          이름·연락처 등 개인정보는 수집하지 않으며, 신청 즉시 발급되는 코드로만 참여를 확인합니다.
        </p>
      </div>
    </div>
  )
}
