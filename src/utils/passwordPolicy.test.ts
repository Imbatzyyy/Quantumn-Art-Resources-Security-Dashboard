import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordChecks,
  passwordStrength,
  validatePermanentPassword,
} from './passwordPolicy.js'

describe('permanent password policy', () => {
  it('accepts a long unique passphrase without requiring arbitrary composition rules', () => {
    const password = 'Harbor-lanterns-cross-safely-at-dawn'
    expect(validatePermanentPassword(password)).toBe('')
    expect(passwordChecks(password)).toMatchObject({ length: true, maximum: true, notCommon: true, notPersonal: true })
    expect(passwordStrength(password).label).toBe('Very strong')
  })

  it('rejects short, reused, common, personal, and oversized values', () => {
    expect(validatePermanentPassword('too-short')).toContain(`${PASSWORD_MIN_LENGTH}`)
    expect(validatePermanentPassword('same temporary password', { currentPassword: 'same temporary password' })).toContain('temporary password')
    expect(validatePermanentPassword('passwordpassword')).toContain('commonly used')
    expect(validatePermanentPassword('Prince-secure-passphrase', { firstName: 'Prince' })).toContain('name')
    expect(validatePermanentPassword('x'.repeat(PASSWORD_MAX_LENGTH + 1))).toContain(`${PASSWORD_MAX_LENGTH}`)
  })
})
