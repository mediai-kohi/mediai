import CourseDetail from './CourseDetail'

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  return <CourseDetail courseId={courseId} />
}
