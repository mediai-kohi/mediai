// 10색 팔레트 (색상환 균등 분포) — CalendarView의 기관별 색상 기준과 동일
const ORG_COLORS = [
  'red', 'amber', 'lime', 'green', 'teal',
  'sky', 'indigo', 'violet', 'fuchsia', 'rose',
] as const

export const COLOR_BG: Record<string, string> = {
  red:     'bg-red-500',
  amber:   'bg-amber-500',
  lime:    'bg-lime-500',
  green:   'bg-green-600',
  teal:    'bg-teal-500',
  sky:     'bg-sky-500',
  indigo:  'bg-indigo-600',
  violet:  'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  rose:    'bg-rose-500',
  orange:  'bg-orange-500',
  blue:    'bg-blue-500',
  purple:  'bg-purple-500',
  pink:    'bg-pink-500',
  emerald: 'bg-emerald-500',
  slate:   'bg-slate-500',
  gray:    'bg-gray-400',
}

export const COLOR_LIGHT: Record<string, string> = {
  red:     'bg-red-100 text-red-800',
  amber:   'bg-amber-100 text-amber-800',
  lime:    'bg-lime-100 text-lime-800',
  green:   'bg-green-100 text-green-800',
  teal:    'bg-teal-100 text-teal-800',
  sky:     'bg-sky-100 text-sky-800',
  indigo:  'bg-indigo-100 text-indigo-800',
  violet:  'bg-violet-100 text-violet-800',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-800',
  rose:    'bg-rose-100 text-rose-800',
  orange:  'bg-orange-100 text-orange-800',
  blue:    'bg-blue-100 text-blue-800',
  purple:  'bg-purple-100 text-purple-800',
  pink:    'bg-pink-100 text-pink-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  slate:   'bg-slate-100 text-slate-700',
  gray:    'bg-gray-100 text-gray-600',
}

// CalendarView의 getOrgColor와 동일한 해시 함수 — 기관명 → 색상 키 결정
export function getOrgColor(orgName: string | null | undefined): string {
  if (!orgName) return 'gray'
  let hash = 5381
  for (let i = 0; i < orgName.length; i++) {
    hash = ((hash << 5) + hash + orgName.charCodeAt(i)) | 0
  }
  return ORG_COLORS[Math.abs(hash) % ORG_COLORS.length]
}
