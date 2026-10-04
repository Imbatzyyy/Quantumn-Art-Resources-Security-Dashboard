import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  LayoutGrid,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  ShieldAlert,
  Sun,
  UserRound,
  X,
} from 'lucide-react'
import logo from '../../assets/images/mainlogo_blue.png'
import { useHrms } from '../state/useHrms.js'
import type { PortalNavigationItem } from '../types/hrms.js'
import { formatClock } from '../utils/format.js'
import { readSidebarCollapsed, readThemePreference, saveSidebarCollapsed, saveThemePreference } from '../utils/theme.js'
import SignOutConfirmation from './SignOutConfirmation.js'

interface Crumb { label: string; target?: string }

interface PortalLayoutProps {
  active: string
  /** Accepts a page id, "pageId/sub/path" or "pageId?query". */
  onNavigate: (target: string) => void
  items: readonly PortalNavigationItem[]
  title: string
  /** Extra breadcrumb levels below the current page, e.g. an employee's name. */
  crumbs?: Crumb[]
  children: ReactNode
}

interface SearchResult {
  key: string
  label: string
  detail: string
  group: string
  icon: LucideIcon
  target: string
}

const roleLabels: Record<string, string> = {
  admin: 'System Administrator',
  hr_admin: 'HR Administrator',
  payroll_admin: 'Payroll Administrator',
  security_admin: 'Security Administrator',
  auditor: 'Compliance Auditor',
  employee: 'Employee',
}

const mobileLabels: Record<string, string> = {
  'action-center': 'Home',
  people: 'People',
  approvals: 'Approvals',
  security: 'Security',
  home: 'Home',
  schedule: 'Time',
  requests: 'Requests',
  inbox: 'Inbox',
  time: 'Time',
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const initialsOf = (first?: string, last?: string) => `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?'

export function UserAvatar({ name, first, last, photo, className = '' }: { name: string; first?: string; last?: string; photo?: string; className?: string }) {
  const [failed, setFailed] = useState<string>()
  return <span className={`user-avatar ${className}`.trim()}>
    {photo && photo !== failed
      ? <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(photo)} />
      : <span aria-hidden="true">{initialsOf(first, last)}</span>}
    <span className="sr-only">{name}</span>
  </span>
}

export default function PortalLayout({ active, onNavigate, items, title, crumbs = [], children }: PortalLayoutProps) {
  const { user, logout, data, refreshData, markNotificationRead, markAllNotificationsRead, lastSyncedAt, syncError } = useHrms()
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobilePageSearch, setMobilePageSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [highlightedResult, setHighlightedResult] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const mobileSearchInput = useRef<HTMLInputElement>(null)
  const mobileSheet = useRef<HTMLElement>(null)
  const mobileCloseButton = useRef<HTMLButtonElement>(null)
  const mobileMoreButton = useRef<HTMLButtonElement>(null)
  const mobileFocusSearch = useRef(false)
  const focusTitleOnRender = useRef(false)
  const [theme, setTheme] = useState(readThemePreference)
  const portal = user?.portal === 'admin' ? 'admin' : 'employee'
  const isAdmin = portal === 'admin'
  const fullName = `${user?.preferredName || user?.firstName || ''} ${user?.lastName || ''}`.trim()
  const roleLabel = isAdmin ? roleLabels[user?.role ?? ''] ?? 'Administrator' : user?.position || 'Employee'
  const activeItem = items.find((item) => item.id === active)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveThemePreference(theme)
  }, [theme])

  useEffect(() => { saveSidebarCollapsed(collapsed) }, [collapsed])

  useEffect(() => {
    const pageName = crumbs.length ? crumbs[crumbs.length - 1].label : title
    document.title = `${pageName} · Quantum HRMS${isAdmin ? ' Admin' : ''}`
  }, [title, crumbs, isAdmin])

  // After a navigation, move focus to the new page heading for keyboard and screen-reader users.
  useEffect(() => {
    if (!focusTitleOnRender.current) return
    const frame = window.requestAnimationFrame(() => {
      focusTitleOnRender.current = false
      window.scrollTo({ top: 0, behavior: 'instant' })
      document.querySelector<HTMLElement>('.shell-content [data-page-title]')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  })

  useEffect(() => {
    const focusPortalSearch = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setNotificationsOpen(false)
        if (window.matchMedia('(max-width: 900px)').matches) {
          mobileFocusSearch.current = true
          setMobileMoreOpen(true)
          window.requestAnimationFrame(() => mobileSearchInput.current?.focus())
        } else {
          setSearchOpen(true)
          searchInput.current?.focus()
        }
      }
    }
    document.addEventListener('keydown', focusPortalSearch)
    return () => document.removeEventListener('keydown', focusPortalSearch)
  }, [])

  useEffect(() => {
    if (!mobileMoreOpen) return
    const previousOverflow = document.body.style.overflow
    const sheetKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileMoreOpen(false)
        setMobilePageSearch('')
        window.requestAnimationFrame(() => mobileMoreButton.current?.focus())
      }
      if (event.key === 'Tab') {
        const controls = [...(mobileSheet.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? [])]
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    const desktopViewport = window.matchMedia('(min-width: 901px)')
    const closeOnDesktop = () => {
      if (!desktopViewport.matches) return
      setMobileMoreOpen(false)
      setMobilePageSearch('')
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', sheetKeys)
    desktopViewport.addEventListener('change', closeOnDesktop)
    // Do not summon a phone's keyboard just to browse navigation.
    const focusFrame = window.requestAnimationFrame(() => (mobileFocusSearch.current ? mobileSearchInput.current : mobileCloseButton.current)?.focus())
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', sheetKeys)
      desktopViewport.removeEventListener('change', closeOnDesktop)
      window.cancelAnimationFrame(focusFrame)
    }
  }, [mobileMoreOpen])

  const visibleAlerts = isAdmin
    ? (data?.securityAlerts ?? [])
    : (data?.securityAlerts.filter((alert) => alert.employeeId === user?.id) ?? [])
  const newAlerts = visibleAlerts.filter((alert) => alert.status === 'New').length
  const employeeNotifications = data?.notifications?.filter((notification) => notification.employeeId === user?.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt)) ?? []
  const unreadNotifications = employeeNotifications.filter((notification) => !notification.readAt).length
  const pendingLeaveCount = isAdmin ? data?.leaveRequests?.filter((item) => item.status === 'Pending').length ?? 0 : 0
  const openRequestCount = isAdmin ? data?.employeeRequests?.filter((item) => ['Submitted', 'Under Review', 'More Information'].includes(item.status)).length ?? 0 : 0
  const pendingApprovals = pendingLeaveCount + openRequestCount
  const canSeeApprovals = items.some((item) => item.id === 'approvals')
  const canSeeSecurity = items.some((item) => item.id === 'security')
  const attentionCount = isAdmin ? (canSeeApprovals ? pendingApprovals : 0) + (canSeeSecurity ? newAlerts : 0) : unreadNotifications
  const resolveBadgeValue = (badge: PortalNavigationItem['badge']) => badge === 'alerts'
    ? newAlerts
    : badge === 'inbox'
      ? unreadNotifications
      : badge === 'approvals'
        ? pendingApprovals
        : badge
  const preferredMobileIds = isAdmin ? ['action-center', 'people', 'approvals', 'security'] : ['home', 'schedule', 'requests', 'inbox']
  const mobilePrimaryItems = preferredMobileIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is PortalNavigationItem => Boolean(item))
  for (const item of items) {
    if (mobilePrimaryItems.length >= 4) break
    if (!mobilePrimaryItems.some((primaryItem) => primaryItem.id === item.id)) mobilePrimaryItems.push(item)
  }
  const mobileMoreActive = !mobilePrimaryItems.some((item) => item.id === active)
  const mobilePageResults = items.filter((item) => {
    const query = mobilePageSearch.trim().toLowerCase()
    if (!query) return !mobilePrimaryItems.some((primary) => primary.id === item.id)
    return item.label.toLowerCase().includes(query) || item.group?.toLowerCase().includes(query)
  })
  const mobilePageGroups = mobilePageResults.reduce<Array<{ name: string; items: PortalNavigationItem[] }>>((groups, item) => {
    const name = item.group || 'More'
    const group = groups.find((candidate) => candidate.name === name)
    if (group) group.items.push(item)
    else groups.push({ name, items: [item] })
    return groups
  }, [])

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    const matches = (...values: Array<string | undefined>) => values.some((value) => value?.toLowerCase().includes(query))
    const allowed = (id: string) => items.some((item) => item.id === id)
    const results: SearchResult[] = items
      .filter((item) => matches(item.label, item.group))
      .slice(0, 5)
      .map((item) => ({ key: `page-${item.id}`, label: item.label, detail: item.group ?? 'Page', group: 'Pages', icon: item.icon, target: item.id }))
    if (!data) return results
    const personName = (id: string) => {
      const person = data.employees.find((employee) => employee.id === id)
      return person ? `${person.firstName} ${person.lastName}` : id
    }
    if (isAdmin) {
      if (allowed('people')) {
        results.push(...data.employees
          .filter((employee) => employee.role === 'employee' && matches(`${employee.firstName} ${employee.lastName}`, employee.preferredName, employee.id, employee.email, employee.department, employee.position))
          .slice(0, 6)
          .map((employee) => ({ key: `person-${employee.id}`, label: `${employee.preferredName || employee.firstName} ${employee.lastName}`, detail: `${employee.position} · ${employee.department} · ${employee.id}`, group: 'People', icon: UserRound, target: `people/${employee.id}` })))
      }
      if (allowed('approvals')) {
        results.push(...data.employeeRequests
          .filter((request) => matches(request.subject, request.id, request.type, personName(request.employeeId)))
          .slice(0, 4)
          .map((request) => ({ key: `request-${request.id}`, label: request.subject, detail: `${request.type} · ${personName(request.employeeId)} · ${request.status}`, group: 'HR requests', icon: FileCheck2, target: `approvals?request=${encodeURIComponent(request.id)}` })))
      }
    } else {
      results.push(...data.employeeRequests
        .filter((request) => request.employeeId === user?.id && matches(request.subject, request.id, request.type))
        .slice(0, 4)
        .map((request) => ({ key: `request-${request.id}`, label: request.subject, detail: `${request.type} · ${request.status}`, group: 'My requests', icon: FileCheck2, target: `requests?request=${encodeURIComponent(request.id)}` })))
    }
    if (allowed('documents')) {
      results.push(...data.documents
        .filter((document) => (isAdmin || !document.employeeId || document.employeeId === user?.id) && matches(document.title, document.type, document.filename))
        .slice(0, 4)
        .map((document) => ({ key: `document-${document.id}`, label: document.title, detail: `${document.type} · Version ${document.version}`, group: 'Documents', icon: FileText, target: `documents?doc=${encodeURIComponent(document.id)}` })))
    }
    return results
  }, [search, items, data, isAdmin, user?.id])
  const searchGroups = searchResults.reduce<Array<{ name: string; results: Array<SearchResult & { index: number }> }>>((groups, result, index) => {
    const group = groups.find((candidate) => candidate.name === result.group)
    if (group) group.results.push({ ...result, index })
    else groups.push({ name: result.group, results: [{ ...result, index }] })
    return groups
  }, [])

  const navigate = (target: string) => {
    focusTitleOnRender.current = true
    onNavigate(target)
    setMobileMoreOpen(false)
    setMobilePageSearch('')
    setSearch('')
    setSearchOpen(false)
    setNotificationsOpen(false)
    setHighlightedResult(0)
  }

  const closeMobileMore = (restoreFocus = true) => {
    setMobileMoreOpen(false)
    setMobilePageSearch('')
    if (restoreFocus) window.setTimeout(() => mobileMoreButton.current?.focus(), 0)
  }

  const refreshWorkspace = async () => {
    if (refreshing) return
    setRefreshing(true)
    setRefreshMessage('')
    try {
      await refreshData()
      setRefreshMessage('Your workspace is up to date.')
    } catch {
      setRefreshMessage('Could not refresh. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const openEmployeeNotification = async (notification: typeof employeeNotifications[number]) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
      } catch {
        return
      }
    }
    const destination = notification.destination && items.some((item) => item.id === notification.destination)
      ? notification.destination
      : 'inbox'
    navigate(destination)
  }

  const searchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && searchResults.length) {
      event.preventDefault()
      setSearchOpen(true)
      setHighlightedResult((value) => (value + 1) % searchResults.length)
    }
    if (event.key === 'ArrowUp' && searchResults.length) {
      event.preventDefault()
      setHighlightedResult((value) => (value - 1 + searchResults.length) % searchResults.length)
    }
    if (event.key === 'Enter' && searchResults[highlightedResult]) {
      event.preventDefault()
      navigate(searchResults[highlightedResult].target)
    }
    if (event.key === 'Escape') {
      setSearch('')
      setSearchOpen(false)
    }
  }

  const syncLabel = syncError ? 'Connection problem' : lastSyncedAt ? 'Up to date' : 'Connecting…'
  const syncDetail = syncError ? 'Changes may not be current' : lastSyncedAt ? `Last updated ${formatClock(new Date(lastSyncedAt))}` : 'Loading your records'
  const breadcrumb: Crumb[] = [
    ...(activeItem?.group && activeItem.group !== 'Workspace' ? [{ label: activeItem.group }] : []),
    { label: title, target: crumbs.length ? active : undefined },
    ...crumbs,
  ]

  return (
    <div className={`shell shell-${portal}${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside id="portal-sidebar" className="shell-sidebar" inert={mobileMoreOpen} aria-label={`${isAdmin ? 'Administrator' : 'Employee'} navigation`}>
        <div className="shell-brand">
          <img className="shell-brand-full" src={logo} alt="Quantumn Art Resources" />
          <img className="shell-brand-mark" src="/favicon.png" alt="" aria-hidden="true" />
          <span className="shell-brand-product">{isAdmin ? 'HR Admin' : 'Employee Portal'}</span>
        </div>

        <nav className="shell-nav" aria-label="Portal navigation">
          {items.map(({ id, label, icon: Icon, badge, group }, index) => {
            const previousGroup = items[index - 1]?.group
            const badgeValue = id === 'action-center' ? undefined : resolveBadgeValue(badge)
            return (
              <div className="shell-nav-entry" key={id}>
                {group && group !== previousGroup && <p className="shell-nav-group">{group}</p>}
                <button
                  type="button"
                  className={active === id ? 'active' : ''}
                  aria-current={active === id ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  onClick={() => navigate(id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="shell-nav-label">{label}</span>
                  {badgeValue ? <em aria-label={`${badgeValue} need attention`}>{typeof badgeValue === 'number' && badgeValue > 99 ? '99+' : badgeValue}</em> : null}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="shell-sidebar-footer">
          <div className={`shell-sync${syncError ? ' has-error' : ''}`} role="status" title={collapsed ? `${syncLabel}. ${syncDetail}` : undefined}>
            <i aria-hidden="true" />
            <span><strong>{syncLabel}</strong><small>{syncDetail}</small></span>
            <button type="button" className="shell-icon-button" onClick={() => void refreshWorkspace()} disabled={refreshing} aria-label={refreshing ? 'Refreshing data' : 'Refresh data'} title="Refresh data"><RotateCcw size={16} /></button>
          </div>
          <div className="shell-user">
            <UserAvatar name={fullName} first={user?.firstName} last={user?.lastName} photo={user?.avatarUrl} />
            <span className="shell-user-text"><strong>{fullName}</strong><small>{roleLabel}</small></span>
            <button type="button" className="shell-icon-button" onClick={() => setShowSignOutConfirm(true)} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="shell-main" inert={mobileMoreOpen}>
        <header className="shell-topbar">
          <div className="shell-topbar-start">
            <button
              type="button"
              className="shell-collapse"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              aria-controls="portal-sidebar"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <nav className="shell-breadcrumb" aria-label="Breadcrumb">
              <ol>
                {breadcrumb.map((crumb, index) => {
                  const last = index === breadcrumb.length - 1
                  return <li key={`${crumb.label}-${index}`}>
                    {crumb.target && !last
                      ? <button type="button" onClick={() => navigate(crumb.target!)}>{crumb.label}</button>
                      : <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>}
                    {!last && <ChevronRight size={14} aria-hidden="true" />}
                  </li>
                })}
              </ol>
            </nav>
            <strong className="shell-mobile-title">{crumbs.length ? crumbs[crumbs.length - 1].label : title}</strong>
          </div>
          <div className="shell-topbar-actions">
            <div className="shell-search" onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}>
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchInput}
                type="search"
                role="combobox"
                placeholder={isAdmin ? 'Search people, requests, pages' : 'Search requests, documents, pages'}
                aria-label={isAdmin ? 'Search people, requests, documents and pages' : 'Search your requests, documents and pages'}
                aria-autocomplete="list"
                aria-controls="portal-search-results"
                aria-expanded={searchOpen && Boolean(search.trim())}
                aria-activedescendant={searchOpen && searchResults[highlightedResult] ? `portal-search-${searchResults[highlightedResult].key}` : undefined}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSearchOpen(true)
                  setNotificationsOpen(false)
                  setHighlightedResult(0)
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={searchKeyDown}
              />
              <kbd aria-hidden="true">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
              {searchOpen && search.trim() && (
                <div id="portal-search-results" className="shell-search-results" role="listbox" aria-label="Search results">
                  {searchGroups.map((group) => <div role="group" aria-label={group.name} key={group.name}>
                    <p aria-hidden="true">{group.name}</p>
                    {group.results.map(({ key, label, detail, icon: Icon, target, index }) => (
                      <button
                        id={`portal-search-${key}`}
                        type="button"
                        role="option"
                        aria-selected={index === highlightedResult}
                        className={index === highlightedResult ? 'active' : ''}
                        key={key}
                        tabIndex={-1}
                        onMouseEnter={() => setHighlightedResult(index)}
                        onMouseDown={(event) => { event.preventDefault(); navigate(target) }}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span><strong>{label}</strong><small>{detail}</small></span>
                      </button>
                    ))}
                  </div>)}
                  {searchResults.length === 0 && <span className="shell-search-empty">No results for “{search.trim()}”</span>}
                </div>
              )}
            </div>
            <div className="shell-notifications" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) window.setTimeout(() => setNotificationsOpen(false), 120) }}>
              <button
                type="button"
                className="icon-button notification-button"
                aria-label={isAdmin ? `Notifications, ${attentionCount} items need attention` : `Notifications, ${attentionCount} unread`}
                aria-expanded={notificationsOpen}
                aria-controls={isAdmin ? 'admin-attention-menu' : 'employee-notification-menu'}
                onClick={() => {
                  setSearchOpen(false)
                  setNotificationsOpen((value) => !value)
                }}
              >
                <Bell size={19} />
                {attentionCount > 0 && <span aria-hidden="true">{attentionCount > 99 ? '99+' : attentionCount}</span>}
              </button>
              {isAdmin && notificationsOpen && (
                <section id="admin-attention-menu" className="shell-popover" aria-label="Items that need attention" onMouseDown={(event) => event.preventDefault()}>
                  <header><strong>Needs attention</strong><em>{attentionCount} open</em></header>
                  <div className="shell-popover-list">
                    {canSeeApprovals && <button type="button" onClick={() => navigate('approvals')}>
                      <span className="shell-popover-icon tone-amber"><ClipboardCheck /></span>
                      <span><strong>Approvals and HR requests</strong><small>{pendingLeaveCount} leave request{pendingLeaveCount === 1 ? '' : 's'} · {openRequestCount} HR request{openRequestCount === 1 ? '' : 's'}</small></span>
                      <em>{pendingApprovals}</em>
                    </button>}
                    {canSeeSecurity && <button type="button" onClick={() => navigate('security?tab=alerts')}>
                      <span className="shell-popover-icon tone-red"><ShieldAlert /></span>
                      <span><strong>New security alerts</strong><small>Not yet reviewed by an administrator</small></span>
                      <em>{newAlerts}</em>
                    </button>}
                    {!canSeeApprovals && !canSeeSecurity && <p className="shell-popover-empty">Nothing needs your attention right now.</p>}
                  </div>
                  <footer><button type="button" onClick={() => navigate('action-center')}>Go to dashboard</button></footer>
                </section>
              )}
              {!isAdmin && notificationsOpen && (
                <section id="employee-notification-menu" className="shell-popover" aria-label="Notifications" onMouseDown={(event) => event.preventDefault()}>
                  <header><strong>Notifications</strong><em>{unreadNotifications} unread</em></header>
                  <div className="shell-popover-list">
                    {employeeNotifications.slice(0, 5).map((notification) => (
                      <button
                        type="button"
                        className={!notification.readAt ? 'unread' : ''}
                        key={notification.id}
                        onClick={() => void openEmployeeNotification(notification)}
                      >
                        <span className="shell-popover-icon tone-blue"><Bell /></span>
                        <span>
                          <small>{notification.category}</small>
                          <strong>{notification.title}</strong>
                          <p>{notification.message}</p>
                        </span>
                        {!notification.readAt && <i className="unread-dot" aria-label="Unread" />}
                      </button>
                    ))}
                    {employeeNotifications.length === 0 && <p className="shell-popover-empty">You’re all caught up.</p>}
                  </div>
                  <footer>
                    <button type="button" onClick={() => navigate('inbox')}>View all notifications</button>
                    {unreadNotifications > 0 && <button type="button" onClick={() => void markAllNotificationsRead()}><CheckCircle2 aria-hidden="true" />Mark all read</button>}
                  </footer>
                </section>
              )}
            </div>
            <button type="button" className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Dark mode" aria-pressed={theme === 'dark'} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
        </header>
        <main id="main-content" className="shell-content" tabIndex={-1}>{children}</main>
      </div>

      <nav className="shell-bottom-nav" inert={mobileMoreOpen} aria-label={`${isAdmin ? 'Administrator' : 'Employee'} mobile navigation`}>
        {mobilePrimaryItems.map(({ id, label, icon: Icon, badge }) => {
          const badgeValue = id === 'action-center' ? undefined : resolveBadgeValue(badge)
          return (
            <button
              type="button"
              className={active === id ? 'active' : ''}
              aria-label={mobileLabels[id] || label}
              aria-description={badgeValue ? `${badgeValue} items need attention` : undefined}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => navigate(id)}
              key={id}
            >
              <span className="shell-bottom-icon" aria-hidden="true"><Icon />{badgeValue ? <em>{typeof badgeValue === 'number' && badgeValue > 99 ? '99+' : badgeValue}</em> : null}</span>
              <span>{mobileLabels[id] || label}</span>
            </button>
          )
        })}
        <button
          ref={mobileMoreButton}
          type="button"
          className={mobileMoreActive ? 'active' : ''}
          aria-label="Open more navigation"
          aria-haspopup="dialog"
          aria-expanded={mobileMoreOpen}
          aria-controls="mobile-more-navigation"
          aria-current={mobileMoreActive ? 'page' : undefined}
          onClick={() => {
            setNotificationsOpen(false)
            setSearchOpen(false)
            mobileFocusSearch.current = false
            setRefreshMessage('')
            setMobileMoreOpen(true)
          }}
        >
          <span className="shell-bottom-icon"><LayoutGrid /></span>
          <span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="shell-more-layer">
          <button className="shell-more-scrim" type="button" tabIndex={-1} aria-hidden="true" onClick={() => closeMobileMore()} />
          <section ref={mobileSheet} id="mobile-more-navigation" className="shell-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
            <div className="shell-more-handle" aria-hidden="true" />
            <header className="shell-more-header">
              <h2 id="mobile-more-title">All pages</h2>
              <button ref={mobileCloseButton} type="button" className="icon-button" aria-label="Close more navigation" onClick={() => closeMobileMore()}><X /></button>
            </header>

            <div className="shell-more-profile">
              <UserAvatar name={fullName} first={user?.firstName} last={user?.lastName} photo={user?.avatarUrl} />
              <span>
                <strong>{fullName}</strong>
                <small>{roleLabel} · {user?.id}</small>
              </span>
            </div>

            <label className="shell-more-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Search portal pages</span>
              <input
                ref={mobileSearchInput}
                type="search"
                value={mobilePageSearch}
                placeholder="Search pages"
                onChange={(event) => setMobilePageSearch(event.target.value)}
              />
              {mobilePageSearch && <button type="button" aria-label="Clear page search" onClick={() => setMobilePageSearch('')}><X /></button>}
            </label>

            <nav className="shell-more-pages" aria-label="All portal pages">
              {mobilePageGroups.map((group) => (
                <section key={group.name} aria-labelledby={`mobile-nav-group-${group.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
                  <h3 id={`mobile-nav-group-${group.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>{group.name}</h3>
                  <div>
                    {group.items.map(({ id, label, icon: Icon, badge }) => {
                      const badgeValue = id === 'action-center' ? undefined : resolveBadgeValue(badge)
                      return (
                        <button type="button" aria-label={label} aria-description={badgeValue ? `${badgeValue} items need attention` : undefined} className={active === id ? 'active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => navigate(id)} key={id}>
                          <span aria-hidden="true"><Icon /></span>
                          <strong>{label}</strong>
                          {badgeValue ? <em aria-hidden="true">{typeof badgeValue === 'number' && badgeValue > 99 ? '99+' : badgeValue}</em> : active === id ? <CheckCircle2 aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
              {mobilePageGroups.length === 0 && <p className="shell-more-empty" role="status">{mobilePageSearch.trim() ? `No page matches “${mobilePageSearch}”.` : 'All your pages are in the bottom bar.'}</p>}
            </nav>

            {refreshMessage && <p className="shell-refresh-message" role="status">{refreshMessage}</p>}
            <footer className="shell-more-utilities">
              <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? <Moon /> : <Sun />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
              </button>
              <button type="button" disabled={refreshing} onClick={() => void refreshWorkspace()}><RotateCcw /><span>{refreshing ? 'Refreshing…' : 'Refresh'}</span></button>
              <button type="button" className="danger" onClick={() => { closeMobileMore(false); setShowSignOutConfirm(true) }}><LogOut /><span>Sign out</span></button>
            </footer>
          </section>
        </div>
      )}
      <SignOutConfirmation open={showSignOutConfirm} portal={portal} onCancel={() => {
        setShowSignOutConfirm(false)
        if (window.matchMedia('(max-width: 900px)').matches) window.requestAnimationFrame(() => mobileMoreButton.current?.focus())
      }} onConfirm={logout} />
    </div>
  )
}
