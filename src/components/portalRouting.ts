import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { PortalKind } from '../types/hrms.js'

export interface RoutedPage {
  id: string
  path: string
}

const RETURN_KEY = 'quantum-hrms-return-to'

/** Remember a deep link that needed a sign-in, so the portal can reopen it afterwards. */
export function rememberReturnPath(portal: PortalKind, path: string) {
  if (!path.startsWith(`/${portal}/`) || /\/(login|verify-email|forgot-password|reset-password|setup-password)\b/.test(path)) return
  try { window.sessionStorage.setItem(RETURN_KEY, path) } catch { /* Optional convenience. */ }
}

function takeReturnPath(portal: PortalKind): string | null {
  try {
    const path = window.sessionStorage.getItem(RETURN_KEY)
    window.sessionStorage.removeItem(RETURN_KEY)
    return path?.startsWith(`/${portal}/`) ? path : null
  } catch {
    return null
  }
}

/**
 * Portal pages live at real URLs (/admin/people/EMP001, /employee/leave) so
 * refresh, Back, bookmarks and shared links all work. Targets are written as
 * "pageId", "pageId/sub/path" or "pageId?query".
 */
export function usePortalRoute(portal: PortalKind, pages: readonly RoutedPage[], fallbackId: string, allowedIds?: readonly string[]) {
  const location = useLocation()
  const navigate = useNavigate()
  const segments = location.pathname.split('/').filter(Boolean)
  const inPortal = segments[0] === portal
  const pagePath = inPortal ? segments[1] : undefined
  const matched = pages.find((page) => page.path === pagePath)
  const allowed = !matched || !allowedIds || allowedIds.includes(matched.id)
  const activeId = matched && allowed ? matched.id : fallbackId
  const subPath = matched && allowed ? segments.slice(2).map(decodeURIComponent) : []
  const searchParams = new URLSearchParams(location.search)

  const hrefFor = useCallback((target: string) => {
    const [pathPart, query] = target.split('?')
    const [id, ...rest] = pathPart.split('/')
    const page = pages.find((item) => item.id === id) ?? pages.find((item) => item.id === fallbackId)
    const sub = rest.filter(Boolean).map(encodeURIComponent).join('/')
    return `/${portal}/${page?.path ?? ''}${sub ? `/${sub}` : ''}${query ? `?${query}` : ''}`
  }, [pages, portal, fallbackId])

  const go = useCallback((target: string, options: { replace?: boolean } = {}) => {
    navigate(hrefFor(target), { replace: options.replace })
  }, [navigate, hrefFor])

  // Unknown or unauthorized addresses fall back to the portal home page.
  useEffect(() => {
    if (inPortal && pagePath && (!matched || !allowed)) navigate(`/${portal}`, { replace: true })
  }, [inPortal, pagePath, matched, allowed, navigate, portal])

  // Reopen a deep link that was requested before signing in.
  useEffect(() => {
    if (!inPortal || pagePath) return
    const path = takeReturnPath(portal)
    if (path) navigate(path, { replace: true })
  }, [inPortal, pagePath, navigate, portal])

  return { activeId, subPath, searchParams, go, hrefFor }
}
