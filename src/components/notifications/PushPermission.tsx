'use client'

import { useState, useEffect } from 'react'

type PermissionStatus = 'unsupported' | 'loading' | 'waiting-permission' | 'default' | 'granted' | 'denied'

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i)
  }
  return buffer
}

export default function PushPermission() {
  const [status, setStatus] = useState<PermissionStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setStatus('unsupported')
      return
    }

    const browserPerm = Notification.permission as PermissionStatus
    if (browserPerm !== 'granted') {
      setStatus(browserPerm)
      return
    }

    const timer = setTimeout(() => setStatus('default'), 5000)
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        clearTimeout(timer)
        setStatus(sub ? 'granted' : 'default')
      })
      .catch(() => {
        clearTimeout(timer)
        setStatus(browserPerm)
      })
    return () => clearTimeout(timer)
  }, [])

  const handleSubscribe = async () => {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      setStatus('default')
      setErrorMsg('푸시 설정이 누락되었습니다. 관리자에게 문의하세요.')
      return
    }
    setStatus('waiting-permission')
    setErrorMsg('')
    try {
      const permission = await Notification.requestPermission()
      setStatus('loading')
      if (permission !== 'granted') {
        setStatus(permission as PermissionStatus)
        return
      }
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('서비스 워커 준비 시간 초과')), 10000)
        ),
      ])
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[push] subscribe API error:', data)
        await sub.unsubscribe()
        setStatus('default')
        setErrorMsg('구독 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setStatus('granted')
    } catch (err) {
      console.error('[push] subscribe error:', err)
      setStatus('default')
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('push service not available') || msg.includes('Registration failed')) {
        setErrorMsg('푸시 서비스에 연결할 수 없습니다. 네트워크 또는 방화벽 설정을 확인해 주세요.')
      } else {
        setErrorMsg('푸시 구독 중 오류가 발생했습니다.')
      }
    }
  }

  const handleUnsubscribe = async () => {
    setStatus('loading')
    setErrorMsg('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('default')
    } catch (err) {
      console.error('[push] unsubscribe error:', err)
      setStatus('granted')
    }
  }

  const handleToggle = () => {
    if (status === 'loading') return
    if (status === 'granted') handleUnsubscribe()
    else handleSubscribe()
  }

  if (status === 'unsupported') return null

  const isOn = status === 'granted'
  const isLoading = status === 'loading' || status === 'waiting-permission'
  const isWaitingPermission = status === 'waiting-permission'

  if (status === 'denied') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700 font-medium">푸시 알림</p>
          <p className="text-xs text-gray-400 mt-0.5">브라우저 설정에서 알림을 허용해 주세요</p>
        </div>
        <div className="w-11 h-6 rounded-full bg-gray-200 flex items-center px-0.5 cursor-not-allowed opacity-50">
          <div className="w-5 h-5 rounded-full bg-white shadow translate-x-0 transition-transform" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700 font-medium">푸시 알림</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isWaitingPermission ? '브라우저 주소창 근처의 알림 허용 팝업을 확인해 주세요' : isLoading ? '처리 중...' : isOn ? '알림이 활성화되어 있습니다' : '알림이 꺼져 있습니다'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${isOn ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isOn ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  )
}
