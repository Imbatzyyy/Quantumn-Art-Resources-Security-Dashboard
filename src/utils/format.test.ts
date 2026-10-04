import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney, formatShift, formatTenure, formatTime, greetingFor, recencyGroup, statusTone } from './format.js'

describe('display formatting', () => {
  it('formats Philippine peso values and safe empty dates', () => {
    expect(formatMoney(12500)).toContain('12,500')
    expect(formatDate()).toBe('—')
  })

  it('maps unknown or missing workflow status to the neutral tone', () => {
    expect(statusTone('Approved')).toBe('success')
    expect(statusTone('Unrecognized state')).toBe('neutral')
    expect(statusTone(undefined)).toBe('neutral')
  })
})

describe('consistent date and time display', () => {
  it('shows stored 24-hour clock values as 12-hour times', () => {
    expect(formatTime('08:58')).toBe('8:58 AM')
    expect(formatTime('18:00')).toBe('6:00 PM')
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatShift('09:00', '18:00')).toBe('9:00 AM – 6:00 PM')
    expect(formatTime(null)).toBe('—')
  })

  it('greets by Philippine time of day', () => {
    expect(greetingFor(new Date('2026-08-30T01:00:00Z'))).toBe('Good morning')
    expect(greetingFor(new Date('2026-08-30T06:00:00Z'))).toBe('Good afternoon')
    expect(greetingFor(new Date('2026-08-30T12:00:00Z'))).toBe('Good evening')
  })

  it('describes tenure in years and months', () => {
    expect(formatTenure('2025-02-10', new Date('2026-09-30T00:00:00'))).toBe('1 yr 7 mos')
    expect(formatTenure('2026-09-01', new Date('2026-09-20T00:00:00'))).toBe('Less than a month')
    expect(formatTenure(undefined)).toBe('—')
  })

  it('groups inbox items by recency', () => {
    const now = new Date('2026-08-30T04:00:00Z')
    expect(recencyGroup('2026-08-30T01:00:00Z', now)).toBe('Today')
    expect(recencyGroup('2026-08-29T01:00:00Z', now)).toBe('Yesterday')
    expect(recencyGroup('2026-08-26T01:00:00Z', now)).toBe('This week')
    expect(recencyGroup('2026-08-01T01:00:00Z', now)).toBe('Earlier')
  })
})
