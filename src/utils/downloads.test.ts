import { describe, expect, it } from 'vitest'
import { inclusiveDays } from './downloads.js'

describe('inclusiveDays', () => {
  it('counts both the start and end date', () => {
    expect(inclusiveDays('2026-08-30', '2026-09-01')).toBe(3)
    expect(inclusiveDays('2026-08-30', '2026-08-30')).toBe(1)
  })

  it('rejects missing, invalid, and reversed ranges', () => {
    expect(inclusiveDays('', '2026-08-30')).toBe(0)
    expect(inclusiveDays('invalid', '2026-08-30')).toBe(0)
    expect(inclusiveDays('2026-09-01', '2026-08-30')).toBe(0)
  })
})
