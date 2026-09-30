/**
 * Every date in the app is filed under a local `yyyy-mm-dd` key. Sessions,
 * nutrition, weight and the calendar all agree on that key, so a day is a
 * plain string join and never a `Date` boundary bug.
 */

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** `yyyy-mm-dd` in the user's own timezone. */
export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** Parses `yyyy-mm-dd` into a local-midnight Date. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function daysBetween(a: string, b: string): number {
  const ms = fromDateKey(b).getTime() - fromDateKey(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Weekday index 0–6 for a date key. */
export function weekdayOf(key: string): number {
  return fromDateKey(key).getDay()
}

export function dayNameOf(key: string): string {
  return DAY_NAMES[weekdayOf(key)]
}

/** Monday-based week start, matching most training splits. */
export function startOfWeek(key: string): string {
  const weekday = weekdayOf(key)
  return addDays(key, weekday === 0 ? -6 : 1 - weekday)
}

export function weekDays(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(startKey, index))
}

/** "Mon 29 Sep" — unambiguous and short enough for a card. */
export function formatDateKey(key: string): string {
  const date = fromDateKey(key)
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

export function formatLongDate(key: string): string {
  const date = fromDateKey(key)
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** A relative label so history reads like a diary, not a log file. */
export function relativeDay(key: string): string {
  const today = todayKey()
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  if (key === addDays(today, 1)) return 'Tomorrow'
  return formatDateKey(key)
}

/** Seconds → "1h 12m" / "42m" / "45s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** The six-week grid a month view needs, padded so weeks start on Monday. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return toDateKey(date)
  })
}

export function monthTitle(year: number, month: number): string {
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month]} ${year}`
}
