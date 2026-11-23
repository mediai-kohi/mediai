'use client'

const START_HOURS = Array.from({ length: 24 }, (_, i) => i) // 00 ~ 23시
const END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1) // 01 ~ 24시

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export default function HourRangeSelect({
  startHour, endHour, onChange,
}: {
  startHour: number
  endHour: number
  onChange: (next: { startHour: number; endHour: number }) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={startHour}
        onChange={(e) => onChange({ startHour: Number(e.target.value), endHour })}
        className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
      >
        {START_HOURS.map((h) => <option key={h} value={h}>{pad2(h)}시</option>)}
      </select>
      <span className="text-xs text-gray-400">~</span>
      <select
        value={endHour}
        onChange={(e) => onChange({ startHour, endHour: Number(e.target.value) })}
        className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
      >
        {END_HOURS.map((h) => <option key={h} value={h}>{pad2(h)}시</option>)}
      </select>
    </div>
  )
}
