'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/notifications/NotificationBell'

const items = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/users', label: '사용자' },
  { href: '/admin/organizations', label: '기관' },
  { href: '/admin/inquiries', label: '문의' },
  { href: '/admin/reports', label: '리포트' },
  { href: '/admin/documents', label: '문서' },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex items-center md:px-6">
        <div className="flex-1 overflow-x-auto min-w-0">
          <div className="flex">
            {items.map((item) => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 md:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {item.label}
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
