import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readThemePreference, saveThemePreference, THEME_STORAGE_KEY } from './theme.js'

beforeEach(() => vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('persistent appearance preference', () => {
  it.each([null, '', 'system', 'invalid', 'light'])('defaults to light for %s', (value) => {
    vi.spyOn(window.localStorage, 'getItem').mockReturnValue(value)
    expect(readThemePreference()).toBe('light')
  })

  it('restores an explicitly saved dark preference', () => {
    vi.spyOn(window.localStorage, 'getItem').mockReturnValue('dark')
    expect(readThemePreference()).toBe('dark')
  })

  it.each(['light', 'dark'] as const)('stores %s independently of authentication', (theme) => {
    const save = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {})
    saveThemePreference(theme)
    expect(save).toHaveBeenCalledWith(THEME_STORAGE_KEY, theme)
  })

  it('keeps the interface usable when storage is blocked', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    expect(readThemePreference()).toBe('light')
    expect(() => saveThemePreference('dark')).not.toThrow()
  })
})
