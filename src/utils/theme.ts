import type { ThemeMode } from '../types/hrms.js'

// A non-sensitive browser preference, deliberately independent of Auth storage
// so signing out does not discard the user's chosen appearance.
export const THEME_STORAGE_KEY = 'quantum-hrms-theme'

export function readThemePreference(): ThemeMode {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveThemePreference(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Appearance still works for this session if browser storage is blocked.
  }
}

export function applyThemePreference(theme: ThemeMode = readThemePreference()): void {
  document.documentElement.dataset.theme = theme
}

// The sidebar width is a per-browser layout preference, like the theme.
export const SIDEBAR_STORAGE_KEY = 'quantum-hrms-sidebar'

export function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded')
  } catch {
    // The layout still works for this session if browser storage is blocked.
  }
}
