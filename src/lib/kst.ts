const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export const CHAT_HISTORY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000

export function kstDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const shifted = new Date(date.getTime() + KST_OFFSET_MS)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function kstDayRangeUtc(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00+09:00`).getTime())
}
