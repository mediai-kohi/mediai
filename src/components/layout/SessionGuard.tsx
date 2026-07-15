'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStayLoggedIn, STAY_LOGGED_IN_EVENT } from '@/lib/sessionPrefs'

const IDLE_TIMEOUT = 2 * 60 * 60 * 1000  // 2시간
const WARN_BEFORE  = 5 * 60 * 1000        // 만료 5분 전 경고
const LS_KEY = 'eduops_last_activity'

export default function SessionGuard() {
  // 마이페이지에서 "로그인 상태 유지"를 켠 경우 idle 자동로그아웃을 적용하지 않는다.
  // localStorage를 첫 렌더에서 동기적으로 읽어야 한다 — 기본값 false로 시작한 뒤
  // effect에서 비동기로 갱신하면, 앱을 껐다 켰을 때(재마운트) 실제 값을 읽기 전에
  // idle 체크가 먼저 실행되어 ON 상태여도 오탐 로그아웃될 수 있다.
  const [stayLoggedIn, setStayLoggedInState] = useState(() => getStayLoggedIn())
  const [showBanner, setShowBanner] = useState(false)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    setStayLoggedInState(getStayLoggedIn())
    const onChange = (e: Event) => setStayLoggedInState((e as CustomEvent<boolean>).detail)
    window.addEventListener(STAY_LOGGED_IN_EVENT, onChange)
    window.addEventListener('storage', () => setStayLoggedInState(getStayLoggedIn()))
    return () => window.removeEventListener(STAY_LOGGED_IN_EVENT, onChange)
  }, [])

  const applyTimeout = !stayLoggedIn

  const logout = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    const supabase = createClient()
    supabase.auth.signOut({ scope: 'local' }).then(() => {
      window.location.href = '/auth/login?reason=timeout'
    })
  }, [])

  // 사용자 활동 시 타임스탬프 갱신
  useEffect(() => {
    if (!applyTimeout) return
    const update = () => localStorage.setItem(LS_KEY, Date.now().toString())
    if (!localStorage.getItem(LS_KEY)) update()
    const events = ['mousemove', 'click', 'keydown', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, update, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, update))
  }, [applyTimeout])

  // 1분마다 만료 여부 체크
  useEffect(() => {
    if (!applyTimeout) { setShowBanner(false); return }
    const check = () => {
      const last = parseInt(localStorage.getItem(LS_KEY) ?? '0') || Date.now()
      const rem = IDLE_TIMEOUT - (Date.now() - last)
      if (rem <= 0) { logout(); return }
      setShowBanner(rem <= WARN_BEFORE)
    }
    check()
    const id = setInterval(check, 60 * 1000)
    return () => clearInterval(id)
  }, [applyTimeout, logout])

  // 앱 포커스 시 앱 아이콘 배지 초기화
  useEffect(() => {
    const clear = () => { if ('clearAppBadge' in navigator) navigator.clearAppBadge() }
    clear()
    window.addEventListener('focus', clear)
    return () => window.removeEventListener('focus', clear)
  }, [])

  // 배너 표시 중 1초마다 카운트다운 갱신
  useEffect(() => {
    if (!applyTimeout || !showBanner) return
    const id = setInterval(() => {
      const last = parseInt(localStorage.getItem(LS_KEY) ?? '0') || Date.now()
      const rem = IDLE_TIMEOUT - (Date.now() - last)
      if (rem <= 0) { logout(); return }
      if (rem > WARN_BEFORE) { setShowBanner(false); return }
      setRemaining(Math.ceil(rem / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [applyTimeout, showBanner, logout])

  const extendSession = () => {
    localStorage.setItem(LS_KEY, Date.now().toString())
    setShowBanner(false)
  }

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}분 ${s}초` : `${s}초`
  }

  if (!showBanner) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
      <p className="text-sm font-medium">
        <span className="font-bold">{fmt(remaining)}</span> 후 자동 로그아웃됩니다. 계속 이용하시려면 클릭하세요.
      </p>
      <button
        onClick={extendSession}
        className="flex-shrink-0 bg-white text-amber-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
      >
        연장하기
      </button>
    </div>
  )
}
