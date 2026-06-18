import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">계정 발급 안내</h1>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-2">
            의료AI 사업관리시스템의 계정은 <span className="font-semibold text-gray-800">관리자가 직접 발급</span>합니다.
          </p>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            사용자 ID와 임시 비밀번호는 담당 관리자에게 문의하세요.
          </p>
          <Link
            href="/auth/login"
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition text-center"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    </div>
  )
}
