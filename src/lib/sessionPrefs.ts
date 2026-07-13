'use client'

// 로그인 상태 유지(idle 자동로그아웃 미적용) 사용자 설정 — 기기(브라우저)별 localStorage에 저장
export const STAY_LOGGED_IN_KEY = 'eduops_stay_logged_in'
export const STAY_LOGGED_IN_EVENT = 'eduops:stay-logged-in-change'

export function getStayLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STAY_LOGGED_IN_KEY) === 'true'
}

export function setStayLoggedIn(value: boolean): void {
  localStorage.setItem(STAY_LOGGED_IN_KEY, value ? 'true' : 'false')
  window.dispatchEvent(new CustomEvent(STAY_LOGGED_IN_EVENT, { detail: value }))
}
