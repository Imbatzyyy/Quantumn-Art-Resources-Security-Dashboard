export const PASSWORD_MIN_LENGTH = 15
export const PASSWORD_MAX_LENGTH = 128

const commonPasswords = new Set([
  '123456789012345',
  'letmeinletmein',
  'passwordpassword',
  'password123456',
  'qwertyqwerty123',
  'welcome12345678',
  'adminadminadmin',
  'iloveyouiloveyou',
  'changemechangeme',
])

const canonical = (value) => value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '')

export function passwordChecks(password, context = {}) {
  const value = typeof password === 'string' ? password : ''
  const normalized = canonical(value)
  const contextTokens = [
    'quantumnhr',
    'quantumnartresources',
    context.firstName,
    context.lastName,
    context.email?.split('@')[0],
  ]
    .map((item) => canonical(item || ''))
    .filter((item) => item.length >= 4)

  return {
    length: Array.from(value).length >= PASSWORD_MIN_LENGTH,
    maximum: Array.from(value).length <= PASSWORD_MAX_LENGTH,
    notCurrent: !context.currentPassword || value !== context.currentPassword,
    notCommon: !commonPasswords.has(normalized),
    notPersonal: !contextTokens.some((token) => normalized.includes(token)),
  }
}

export function validatePermanentPassword(password, context = {}) {
  const checks = passwordChecks(password, context)
  if (!checks.length) return `Use at least ${PASSWORD_MIN_LENGTH} characters. A memorable passphrase works well.`
  if (!checks.maximum) return `Use no more than ${PASSWORD_MAX_LENGTH} characters.`
  if (!checks.notCurrent) return 'Choose a new password instead of reusing the temporary password.'
  if (!checks.notCommon) return 'This password is commonly used and is too easy to guess.'
  if (!checks.notPersonal) return 'Do not include your name, email username, or the Quantum HRMS name.'
  return ''
}

export function passwordStrength(password, context = {}) {
  const length = Array.from(password || '').length
  const checks = passwordChecks(password, context)
  if (!password || !checks.notCommon || !checks.notPersonal) return { score: 0, label: 'Start typing' }
  if (length < PASSWORD_MIN_LENGTH) return { score: 1, label: 'Too short' }
  if (length < 20) return { score: 2, label: 'Good' }
  if (length < 25) return { score: 3, label: 'Strong' }
  return { score: 4, label: 'Very strong' }
}
