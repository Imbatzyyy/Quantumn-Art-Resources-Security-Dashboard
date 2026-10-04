import type { BadgeTone } from '../types/hrms.js'

export const BUSINESS_TIME_ZONE = 'Asia/Manila'

export function formatMoney(value?: number | null): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: BUSINESS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/** "Sunday, August 30, 2026" for a calendar date (YYYY-MM-DD). */
export function formatDateLong(value?: string | null, options: { year?: boolean } = {}): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(options.year === false ? {} : { year: 'numeric' }),
  }).format(new Date(`${value}T00:00:00`))
}

/** "Mon" for a calendar date (YYYY-MM-DD). */
export function formatWeekday(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { weekday: 'short' }).format(new Date(`${value}T00:00:00`))
}

/** Clock times are stored as 24-hour "HH:MM"; people read them as "8:58 AM". */
export function formatTime(value?: string | null): string {
  if (!value) return '—'
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour = hours % 12 || 12
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function formatShift(start?: string | null, end?: string | null): string {
  if (!start || !end) return '—'
  return `${formatTime(start)} – ${formatTime(end)}`
}

/** The current time of day in the business time zone, e.g. "9:30 AM". */
export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: BUSINESS_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
}

export function formatMoneyExact(value?: number | null): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

export function greetingFor(date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIME_ZONE, hour: 'numeric', hour12: false }).format(date)) % 24
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Whole months of service, shown as "1 yr 7 mos". */
export function formatTenure(hireDate?: string | null, today = new Date()): string {
  if (!hireDate) return '—'
  const start = new Date(`${hireDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || start > today) return 'Starting soon'
  let months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth()
  if (today.getDate() < start.getDate()) months -= 1
  if (months < 1) return 'Less than a month'
  const years = Math.floor(months / 12)
  const rest = months % 12
  const parts = []
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`)
  if (rest) parts.push(`${rest} mo${rest === 1 ? '' : 's'}`)
  return parts.join(' ')
}

/** Groups timestamps for inbox-style lists: Today, Yesterday, This week, Earlier. */
export function recencyGroup(value: string, now = new Date()): 'Today' | 'Yesterday' | 'This week' | 'Earlier' {
  const day = (input: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(input)
  const target = day(new Date(value))
  if (target === day(now)) return 'Today'
  if (target === day(new Date(now.getTime() - 86_400_000))) return 'Yesterday'
  if (target >= day(new Date(now.getTime() - 6 * 86_400_000))) return 'This week'
  return 'Earlier'
}

export function statusTone(status?: string | null): BadgeTone {
  const tones: Record<string, BadgeTone> = {
    Active: 'success',
    Present: 'success',
    Approved: 'success',
    Processed: 'success',
    Released: 'success',
    Paid: 'success',
    Locked: 'neutral',
    Published: 'success',
    Complete: 'success',
    Completed: 'success',
    Closed: 'neutral',
    Resolved: 'success',
    Remediated: 'success',
    Passed: 'success',
    Confirmed: 'danger',
    Contained: 'warning',
    'False Positive': 'neutral',
    'Accepted Risk': 'warning',
    'Review Needed': 'warning',
    Failed: 'danger',
    Open: 'danger',
    'In Progress': 'warning',
    Pending: 'warning',
    Submitted: 'info',
    'Under Review': 'warning',
    'More Information': 'warning',
    Validation: 'warning',
    Review: 'warning',
    Investigating: 'warning',
    Draft: 'neutral',
    Cancelled: 'neutral',
    Skipped: 'neutral',
    Acknowledged: 'info',
    Late: 'warning',
    Rejected: 'danger',
    'At Risk': 'danger',
    New: 'danger',
    'On Leave': 'info',
  }
  return status ? tones[status] ?? 'neutral' : 'neutral'
}
