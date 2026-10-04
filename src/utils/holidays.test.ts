import { describe, expect, it } from 'vitest'
import { holidayOn, nonWorkingDaysIn, philippineHolidays, upcomingHolidays } from './holidays.js'

describe('Philippine holiday calendar', () => {
  it('computes movable holidays from their legal rules', () => {
    const holidays = philippineHolidays(2026)
    expect(holidays.find((item) => item.name === 'Maundy Thursday')?.date).toBe('2026-04-02')
    expect(holidays.find((item) => item.name === 'Good Friday')?.date).toBe('2026-04-03')
    expect(holidays.find((item) => item.name === 'National Heroes Day')?.date).toBe('2026-08-31')
    expect(philippineHolidays(2027).find((item) => item.name === 'Good Friday')?.date).toBe('2027-03-26')
  })

  it('finds fixed holidays and upcoming dates across the new year', () => {
    expect(holidayOn('2026-12-25')?.name).toBe('Christmas Day')
    expect(holidayOn('2026-10-05')).toBeUndefined()
    expect(upcomingHolidays('2026-12-26', 3).map((item) => item.date)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('reports weekends and holidays inside a leave range', () => {
    const result = nonWorkingDaysIn('2026-12-24', '2026-12-28')
    expect(result.weekends).toEqual(['2026-12-26', '2026-12-27'])
    expect(result.holidays.map((item) => item.name)).toEqual(['Christmas Day'])
  })
})
