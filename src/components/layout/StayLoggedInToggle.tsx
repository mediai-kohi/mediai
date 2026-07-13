'use client'

import { useState, useEffect } from 'react'
import { getStayLoggedIn, setStayLoggedIn } from '@/lib/sessionPrefs'

export default function StayLoggedInToggle() {
  const [isOn, setIsOn] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setIsOn(getStayLoggedIn())
    setMounted(true)
  }, [])

  const handleToggle = () => {
    const next = !isOn
    setStayLoggedIn(next)
    setIsOn(next)
  }

  if (!mounted) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700 font-medium">로그인 상태 유지</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isOn ? '자동 로그아웃 없이 로그인이 계속 유지됩니다' : '2시간 미사용 시 자동 로그아웃됩니다'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          onClick={handleToggle}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer ${
            isOn ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isOn ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {isOn && (
        <p className="text-xs text-amber-600">
          공용 기기에서는 사용을 권장하지 않습니다. 이 기기에만 적용됩니다.
        </p>
      )}
    </div>
  )
}
