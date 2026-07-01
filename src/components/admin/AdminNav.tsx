'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import NotificationBell from '@/components/notifications/NotificationBell'

interface NavBadges {
  users: number
  inquiries: number
  reports: number
}

const items = [
  { href: '/admin', label: '대시보드', badgeKey: null },
  { href: '/admin/users', label: '사용자', badgeKey: 'users' as keyof NavBadges },
  { href: '/admin/organizations', label: '기관', badgeKey: null },
  { href: '/admin/inquiries', label: '문의', badgeKey: 'inquiries' as keyof NavBadges },
  { href: '/admin/reports', label: '리포트', badgeKey: 'reports' as keyof NavBadges },
  { href: '/admin/documents', label: '문서', badgeKey: null },
]

export default function AdminNav() {
  const pathname = usePathname()
  const [badges, setBadges] = useState<NavBadges>({ users: 0, inquiries: 0, reports: 0 })

  useEffect(() => {
    const fetch_ = () =>
      fetch('/api/admin/stats', { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) return
          setBadges({
            users: d.pendingUsers ?? 0,
            inquiries: d.openInquiries ?? 0,
            reports: d.pendingReports ?? 0,
          })
        })
        .catch(() => {})
    fetch_()
    const id = setInterval(fetch_, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex items-center md:px-6">
        <div className="flex-1 overflow-x-auto min-w-0">
          <div className="flex">
            {items.map((item) => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
              const count = item.badgeKey ? badges[item.badgeKey] : 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 md:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {item.label}
                  {count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
        <div className="px-3 flex-shrink-0">
          <NotificationBell isAdmin />
        </div>
      </div>
    </div>
  )
}
