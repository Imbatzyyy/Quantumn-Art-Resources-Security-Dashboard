import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney, statusTone } from './format.js'

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
