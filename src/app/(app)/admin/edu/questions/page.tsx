import QuestionManager from './QuestionManager'

export default function AdminEduQuestionsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-gray-900 mb-1">만족도 문항 관리</h1>
      <p className="text-xs text-gray-400 mb-4">모든 교육 과정이 공유하는 전역 설정입니다. 문항을 삭제해도 과거 응답은 유지됩니다(비활성화 처리).</p>
      <QuestionManager />
    </div>
  )
}
