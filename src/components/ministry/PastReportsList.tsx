'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Row {
  id: string
  period_label: string
  period_start: string
  period_end: string
  bio_status: string
  ai_status: string
}

export default function PastReportsList({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false)

  if (rows.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>이전 주간업무보고 ({rows.length})</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {rows.map((r) => (
            <Link key={r.id} href={`/ministry/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.period_label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r.period_start} ~ {r.period_end}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.bio_status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>바이오헬스</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.ai_status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>의료AI</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
