'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface User {
  id: string
  user_code: string
  organization: string
  role: string
  status: string
  created_at: string
  memo: string | null
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '대기', approved: '승인', rejected: '거절',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace(/\.$/, '')
}

interface ConfirmState {
  userId: string
  action: 'approve' | 'reject' | 'role' | 'delete'
  label: string
  nextValue: string
}

// 생성된 사용자 정보 모달
function CreatedUserModal({ userCode, tempPassword, onClose }: {
  userCode: string
  tempPassword: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState<'code' | 'pw' | null>(null)

  const copy = (text: string, type: 'code' | 'pw') => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900 mb-1">새 사용자 생성 완료</h2>
        <p className="text-xs text-gray-500 mb-5">아래 정보를 사용자에게 전달하세요. 창을 닫으면 임시 비밀번호를 다시 확인할 수 없습니다.</p>

        <div className="space-y-3 mb-6">
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">사용자 ID</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-lg font-bold text-gray-900 tracking-widest">{userCode}</span>
              <button
                onClick={() => copy(userCode, 'code')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
              >
                {copied === 'code' ? '복사됨!' : '복사'}
              </button>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">임시 비밀번호</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-medium text-gray-900 break-all">{tempPassword}</span>
              <button
                onClick={() => copy(tempPassword, 'pw')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
              >
                {copied === 'pw' ? '복사됨!' : '복사'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition"
        >
          확인했습니다
        </button>
      </div>
    </div>
  )
}

// 비밀번호 초기화 결과 모달
function ResetPasswordModal({ userCode, tempPassword, onClose }: {
  userCode: string
  tempPassword: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900 mb-1">비밀번호 초기화 완료</h2>
        <p className="text-xs text-gray-500 mb-5">사용자 <span className="font-mono font-bold">{userCode}</span>의 임시 비밀번호입니다.</p>

        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs text-gray-500 mb-1">임시 비밀번호</p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-medium text-gray-900 break-all">{tempPassword}</span>
            <button onClick={copy} className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0">
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition">
          확인
        </button>
      </div>
    </div>
  )
}

// 소속기관 인라인 편집 셀 (드롭다운)
function OrgCell({ userId, initialOrg, orgList, onSaved }: {
  userId: string
  initialOrg: string
  orgList: string[]
  onSaved: (next: string) => void
}) {
  const [org, setOrg] = useState(initialOrg)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const save = async (next: string) => {
    if (next === org) { setEditing(false); return }
    setSaving(true)
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization: next }),
    })
    setSaving(false)
    if (res.ok) {
      setOrg(next)
      onSaved(next)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    } else {
      setError(true)
      setEditing(false)
      setTimeout(() => setError(false), 2000)
    }
  }

  if (editing) {
    return (
      <td className="px-4 py-2 min-w-[140px]">
        <select
          value={org}
          autoFocus
          onChange={e => save(e.target.value)}
          onBlur={() => setEditing(false)}
          className="w-full text-xs border border-blue-400 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        >
          {orgList.length === 0 && <option value={org}>{org || '—'}</option>}
          {orgList.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
    )
  }

  return (
    <td
      className="px-4 py-3 min-w-[120px] cursor-pointer group"
      onClick={() => setEditing(true)}
      title="클릭하여 소속기관 변경"
    >
      {saving ? (
        <span className="text-xs text-gray-400">저장 중...</span>
      ) : saved ? (
        <span className="text-xs text-green-600 font-medium">저장됨</span>
      ) : error ? (
        <span className="text-xs text-red-500">실패</span>
      ) : (
        <span className="text-xs text-gray-600 group-hover:underline decoration-dashed underline-offset-2">{org || '—'}</span>
      )}
    </td>
  )
}

// 메모 인라인 편집 셀
function MemoCell({ userId, initialMemo }: { userId: string; initialMemo: string | null }) {
  const [memo, setMemo] = useState(initialMemo ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const save = async () => {
    setSaving(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo }),
    })
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setMemo(initialMemo ?? ''); setEditing(false) }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
  }

  if (editing) {
    return (
      <td className="px-4 py-2 min-w-[180px]">
        <textarea
          ref={textareaRef}
          value={memo}
          onChange={e => setMemo(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          rows={2}
          className="w-full text-xs border border-blue-400 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          autoFocus
        />
      </td>
    )
  }

  return (
    <td
      className="px-4 py-3 min-w-[160px] cursor-pointer group"
      onClick={() => setEditing(true)}
      title="클릭하여 편집"
    >
      {saving ? (
        <span className="text-xs text-gray-400">저장 중...</span>
      ) : saved ? (
        <span className="text-xs text-green-600 font-medium">저장됨</span>
      ) : memo ? (
        <span className="text-xs text-gray-600 whitespace-pre-wrap">{memo}</span>
      ) : (
        <span className="text-xs text-gray-300 group-hover:text-gray-400">클릭하여 입력</span>
      )}
    </td>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [orgFilter, setOrgFilter] = useState('all')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 신규 사용자 생성
  const [creating, setCreating] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createdUser, setCreatedUser] = useState<{ user_code: string; temp_password: string } | null>(null)
  const [selectedOrg, setSelectedOrg] = useState('')

  // 비밀번호 초기화
  const [resetResult, setResetResult] = useState<{ user_code: string; temp_password: string } | null>(null)

  // OTP 초기화
  const [otpResetResult, setOtpResetResult] = useState<{ user_code: string } | null>(null)
  const [otpResetError, setOtpResetError] = useState<string | null>(null)

  // 기관 목록
  const [orgList, setOrgList] = useState<string[]>([])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users?tab=all')
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
    fetch('/api/admin/organizations')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setOrgList(data.map((o: { name: string }) => o.name))
      })
  }, [fetchUsers])

  const orgs = ['all', ...Array.from(new Set(users.map((u) => u.organization))).sort()]

  const filtered = orgFilter !== 'all'
    ? users.filter((u) => u.organization === orgFilter)
    : users

  const doAction = async () => {
    if (!confirm) return
    setActionLoading(true)

    if (confirm.action === 'delete') {
      await fetch(`/api/admin/users/${confirm.userId}`, { method: 'DELETE' })
    } else {
      const body: Record<string, string> = {}
      if (confirm.action === 'approve') body.status = 'approved'
      else if (confirm.action === 'reject') body.status = 'rejected'
      else body.role = confirm.nextValue

      await fetch(`/api/admin/users/${confirm.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    setConfirm(null)
    setActionLoading(false)
    fetchUsers()
  }

  const openCreateModal = () => {
    setSelectedOrg('')
    setCreating(true)
  }

  const handleCreate = async () => {
    setCreateLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization: selectedOrg || '미지정' }),
    })
    const data = await res.json()
    setCreateLoading(false)
    setCreating(false)
    if (res.ok) {
      setCreatedUser({ user_code: data.user_code, temp_password: data.temp_password })
      fetchUsers()
    }
  }

  const handleResetPassword = async (userId: string, userCode: string) => {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setResetResult({ user_code: userCode, temp_password: data.temp_password })
  }

  const handleResetOtp = async (userId: string, userCode: string) => {
    setOtpResetError(null)
    const res = await fetch(`/api/admin/users/${userId}/reset-otp`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setOtpResetResult({ user_code: userCode })
    } else {
      setOtpResetError(data.error ?? 'OTP 초기화에 실패했습니다.')
    }
  }

  const colCount = 7

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">사용자 관리</h1>

      {/* 기관 필터 + 신규 생성 버튼 */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {orgs.map((org) => (
            <button
              key={org}
              onClick={() => setOrgFilter(org)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                orgFilter === org ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {org === 'all' ? '전체' : org}
            </button>
          ))}
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          새 사용자 만들기
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">사용자 ID</th>
<th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">소속 기관</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">가입일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">역할</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">비고 (관리자 메모)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-gray-400">사용자가 없습니다.</td></tr>
              ) : filtered.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">{user.user_code || '—'}</td>
                  <OrgCell
                    userId={user.id}
                    initialOrg={user.organization}
                    orgList={orgList}
                    onSaved={(next) => setUsers(prev => prev.map(u => u.id === user.id ? { ...u, organization: next } : u))}
                  />
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[user.status] ?? user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-medium ${user.role === 'super_admin' ? 'text-purple-700' : 'text-gray-600'}`}>
                      {user.role === 'super_admin' ? '슈퍼관리자' : '일반사용자'}
                    </span>
                  </td>
                  <MemoCell userId={user.id} initialMemo={user.memo} />
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex gap-1.5 justify-end">
                      {user.status === 'pending' && (
                        <>
                          <button
                            onClick={() => setConfirm({ userId: user.id, action: 'approve', label: `${user.user_code}(${user.organization}) 계정을 승인하시겠습니까?`, nextValue: 'approved' })}
                            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >승인</button>
                          <button
                            onClick={() => setConfirm({ userId: user.id, action: 'reject', label: `${user.user_code}(${user.organization}) 계정을 거절하시겠습니까?`, nextValue: 'rejected' })}
                            className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >거절</button>
                        </>
                      )}
                      {user.status === 'approved' && (
                        <>
                          <button
                            onClick={() => setConfirm({
                              userId: user.id,
                              action: 'role',
                              label: user.role === 'super_admin'
                                ? `${user.user_code}(${user.organization}) 계정을 일반사용자로 변경하시겠습니까?`
                                : `${user.user_code}(${user.organization}) 계정을 슈퍼관리자로 변경하시겠습니까?`,
                              nextValue: user.role === 'super_admin' ? 'user' : 'super_admin',
                            })}
                            className="px-2.5 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            {user.role === 'super_admin' ? '→ 일반' : '→ 관리자'}
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.id, user.user_code)}
                            className="px-2.5 py-1 border border-orange-300 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-50 transition-colors"
                          >
                            PW 초기화
                          </button>
                          <button
                            onClick={() => handleResetOtp(user.id, user.user_code)}
                            className="px-2.5 py-1 border border-purple-300 text-purple-600 text-xs font-medium rounded-lg hover:bg-purple-50 transition-colors"
                          >
                            OTP 초기화
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setConfirm({ userId: user.id, action: 'delete', label: `${user.user_code}(${user.organization}) 계정을 삭제하시겠습니까? 모든 데이터가 영구적으로 삭제됩니다.`, nextValue: '' })}
                        className="px-2.5 py-1 border border-red-300 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <p className="text-sm font-medium text-gray-900 mb-5">{confirm.label}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button
                onClick={doAction}
                disabled={actionLoading}
                className={`flex-1 ${confirm.action === 'delete' ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'} text-white font-medium py-2.5 rounded-xl text-sm`}
              >
                {actionLoading ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신규 생성 확인 모달 */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-2">새 사용자 만들기</h2>
            <p className="text-sm text-gray-600 mb-4">사용자 ID와 임시 비밀번호가 자동 생성됩니다. 생성 후 사용자에게 전달하세요.</p>
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">소속 기관</label>
              {orgList.length > 0 ? (
                <select
                  value={selectedOrg}
                  onChange={e => setSelectedOrg(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">기관 선택</option>
                  {orgList.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedOrg}
                  onChange={e => setSelectedOrg(e.target.value)}
                  placeholder="기관명 입력"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button
                onClick={handleCreate}
                disabled={createLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl text-sm"
              >
                {createLoading ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 생성 완료 모달 */}
      {createdUser && (
        <CreatedUserModal
          userCode={createdUser.user_code}
          tempPassword={createdUser.temp_password}
          onClose={() => setCreatedUser(null)}
        />
      )}

      {/* 비밀번호 초기화 완료 모달 */}
      {resetResult && (
        <ResetPasswordModal
          userCode={resetResult.user_code}
          tempPassword={resetResult.temp_password}
          onClose={() => setResetResult(null)}
        />
      )}

      {/* OTP 초기화 완료 모달 */}
      {otpResetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 mb-1">OTP 초기화 완료</h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-mono font-bold">{otpResetResult.user_code}</span> 사용자의 OTP가 초기화되었습니다.<br />
              다음 로그인 시 Google Authenticator를 새로 등록하게 됩니다.
            </p>
            <button
              onClick={() => setOtpResetResult(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* OTP 초기화 오류 모달 */}
      {otpResetError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 mb-1">OTP 초기화 실패</h2>
            <p className="text-sm text-red-600 mb-5">{otpResetError}</p>
            <button
              onClick={() => setOtpResetError(null)}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2.5 rounded-xl text-sm transition"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
