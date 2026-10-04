/*
 * Philippine national holidays computed from the rules in law (RA 9492 and
 * related acts), so the calendar works for any year without a data feed.
 * Days that are proclaimed one year at a time (for example Eid'l Fitr,
 * Eid'l Adha, Chinese New Year or extra special days) are not guessed here;
 * HR announcements remain the source of truth for those.
 */

export interface Holiday {
  date: string
  name: string
  kind: 'Regular holiday' | 'Special non-working day'
}

const pad = (value: number) => String(value).padStart(2, '0')
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

const shift = (date: Date, days: number) => {
  const next = new Date(date.getTime() + days * 86_400_000)
  return iso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
}

function lastMondayOfAugust(year: number): string {
  const last = new Date(Date.UTC(year, 7, 31))
  const offset = (last.getUTCDay() + 6) % 7
  return iso(year, 8, 31 - offset)
}

const cache = new Map<number, Holiday[]>()

export function philippineHolidays(year: number): Holiday[] {
  const cached = cache.get(year)
  if (cached) return cached
  const easter = easterSunday(year)
  const regular = (date: string, name: string): Holiday => ({ date, name, kind: 'Regular holiday' })
  const special = (date: string, name: string): Holiday => ({ date, name, kind: 'Special non-working day' })
  const list = [
    regular(iso(year, 1, 1), 'New Year’s Day'),
    regular(shift(easter, -3), 'Maundy Thursday'),
    regular(shift(easter, -2), 'Good Friday'),
    special(shift(easter, -1), 'Black Saturday'),
    regular(iso(year, 4, 9), 'Araw ng Kagitingan'),
    regular(iso(year, 5, 1), 'Labor Day'),
    regular(iso(year, 6, 12), 'Independence Day'),
    special(iso(year, 8, 21), 'Ninoy Aquino Day'),
    regular(lastMondayOfAugust(year), 'National Heroes Day'),
    special(iso(year, 11, 1), 'All Saints’ Day'),
    regular(iso(year, 11, 30), 'Bonifacio Day'),
    special(iso(year, 12, 8), 'Feast of the Immaculate Conception'),
    regular(iso(year, 12, 25), 'Christmas Day'),
    regular(iso(year, 12, 30), 'Rizal Day'),
    special(iso(year, 12, 31), 'Last day of the year'),
  ].sort((left, right) => left.date.localeCompare(right.date))
  cache.set(year, list)
  return list
}

export function holidayOn(date: string): Holiday | undefined {
  const year = Number(date.slice(0, 4))
  if (!Number.isFinite(year)) return undefined
  return philippineHolidays(year).find((holiday) => holiday.date === date)
}

export function upcomingHolidays(fromDate: string, count = 3): Holiday[] {
  const year = Number(fromDate.slice(0, 4))
  return [...philippineHolidays(year), ...philippineHolidays(year + 1)]
    .filter((holiday) => holiday.date >= fromDate)
    .slice(0, count)
}

/** Weekend days and holidays inside an inclusive YYYY-MM-DD range. */
export function nonWorkingDaysIn(startDate: string, endDate: string) {
  const weekends: string[] = []
  const holidays: Holiday[] = []
  if (!startDate || !endDate || endDate < startDate) return { weekends, holidays }
  for (let cursor = new Date(`${startDate}T00:00:00Z`); ; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const date = cursor.toISOString().slice(0, 10)
    if (date > endDate) break
    const weekday = cursor.getUTCDay()
    if (weekday === 0 || weekday === 6) weekends.push(date)
    const holiday = holidayOn(date)
    if (holiday) holidays.push(holiday)
    if (weekends.length + holidays.length > 400) break
  }
  return { weekends, holidays }
}
