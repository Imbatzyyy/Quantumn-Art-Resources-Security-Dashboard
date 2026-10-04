/** Calendar date helpers. Dates are YYYY-MM-DD strings; months are YYYY-MM. */

const pad = (value: number) => String(value).padStart(2, '0')

export const monthOf = (date: string) => date.slice(0, 7)

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
}

/** Dates (YYYY-MM-DD) covering a month grid, Sunday first. */
export function monthGrid(month: string): Array<{ date: string; inMonth: boolean }> {
  const [year, monthIndex] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthIndex - 1, 1))
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000)
  const days = []
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start.getTime() + index * 86_400_000)
    const date = current.toISOString().slice(0, 10)
    days.push({ date, inMonth: date.slice(0, 7) === month })
  }
  // Drop a trailing week that is entirely in the next month.
  return days.slice(35).every((day) => !day.inMonth) ? days.slice(0, 35) : days
}

/** Dates (YYYY-MM-DD) from a start date through an end date, inclusive. */
export function datesBetween(startDate: string, endDate: string, limit = 120): string[] {
  const dates: string[] = []
  if (!startDate || !endDate || endDate < startDate) return dates
  for (let cursor = new Date(`${startDate}T00:00:00Z`); dates.length < limit; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const date = cursor.toISOString().slice(0, 10)
    if (date > endDate) break
    dates.push(date)
  }
  return dates
}
