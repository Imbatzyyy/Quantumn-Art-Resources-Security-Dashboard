import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LayoutGrid,
  LogOut,
  Moon,
  RotateCcw,
  Search,
  ShieldAlert,
  Sun,
  X,
} from 'lucide-react'
import logo from '../../assets/images/mainlogo_blue.png'
import avatar from '../../assets/images/default-avatar.png'
import { useHrms } from '../state/useHrms.js'
import type { PortalNavigationItem } from '../types/hrms.js'
import { readThemePreference, saveThemePreference } from '../utils/theme.js'
import SignOutConfirmation from './SignOutConfirmation.js'

interface PortalLayoutProps {
  active: string
  onNavigate: (id: string) => void
  items: readonly PortalNavigationItem[]
  title: string
  children: ReactNode
}

export default function PortalLayout({ active, onNavigate, items, title, children }: PortalLayoutProps) {
  const { user, logout, data, refreshData, markNotificationRead, markAllNotificationsRead } = useHrms()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobilePageSearch, setMobilePageSearch] = useState('')
  const [mobileRefreshing, setMobileRefreshing] = useState(false)
  const [mobileRefreshMessage, setMobileRefreshMessage] = useState('')
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
  const pageTitle = useRef<HTMLElement>(null)
  const [theme, setTheme] = useState(readThemePreference)
  const portal = user?.portal === 'admin' ? 'admin' : 'employee'
  const isAdmin = portal === 'admin'
  const currentDate = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveThemePreference(theme)
  }, [theme])

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

  const visibleAlerts = user?.portal === 'admin'
    ? (data?.securityAlerts ?? [])
    : (data?.securityAlerts.filter((alert) => alert.employeeId === user?.id) ?? [])
  const newAlerts = visibleAlerts.filter((alert) => alert.status === 'New').length
  const employeeNotifications = data?.notifications?.filter(
    (notification) => notification.employeeId === user?.id,
  ).sort((left, right) => right.createdAt.localeCompare(left.createdAt)) ?? []
  const unreadNotifications = employeeNotifications.filter(
    (notification) => notification.employeeId === user?.id && !notification.readAt,
  ).length ?? 0
  const pendingApprovals = user?.portal === 'admin'
    ? (data?.leaveRequests?.filter((item) => item.status === 'Pending').length ?? 0)
      + (data?.employeeRequests?.filter((item) => ['Submitted', 'Under Review', 'More Information'].includes(item.status)).length ?? 0)
    : 0
  const pendingLeaveCount = isAdmin
    ? data?.leaveRequests?.filter((item) => item.status === 'Pending').length ?? 0
    : 0
  const openRequestCount = isAdmin
    ? data?.employeeRequests?.filter((item) => ['Submitted', 'Under Review', 'More Information'].includes(item.status)).length ?? 0
    : 0
  const attentionCount = isAdmin ? pendingApprovals + newAlerts : unreadNotifications
  const resolveBadgeValue = (badge: PortalNavigationItem['badge']) => badge === 'alerts'
    ? newAlerts
    : badge === 'inbox'
      ? unreadNotifications
      : badge === 'approvals'
        ? pendingApprovals
        : badge
  const preferredMobileIds = isAdmin
    ? ['action-center', 'people', 'approvals', 'security']
    : ['home', 'schedule', 'requests', 'inbox']
  const mobileLabels: Record<string, string> = {
    'action-center': 'Center',
    people: 'People',
    approvals: 'Approvals',
    security: 'Security',
    home: 'My Day',
    schedule: 'Time',
    requests: 'Requests',
    inbox: 'Inbox',
    time: 'Time',
    payroll: 'Payroll',
    analytics: 'Reports',
    documents: 'Documents',
    performance: 'Growth',
    lifecycle: 'Journey',
    announcements: 'Updates',
    'admin-accounts': 'Accounts',
  }
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
  const searchResults = search.trim()
    ? items.filter((item) => {
      const query = search.trim().toLowerCase()
      return item.label.toLowerCase().includes(query) || item.group?.toLowerCase().includes(query)
    })
    : []

  const navigate = (id: string) => {
    onNavigate(id)
    setMobileMoreOpen(false)
    setMobilePageSearch('')
    setSearch('')
    setSearchOpen(false)
    setNotificationsOpen(false)
    setHighlightedResult(0)
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => {
        if (id !== active) window.scrollTo({ top: 0, behavior: 'instant' })
        pageTitle.current?.focus({ preventScroll: true })
      })
    }
  }

  const closeMobileMore = (restoreFocus = true) => {
    setMobileMoreOpen(false)
    setMobilePageSearch('')
    if (restoreFocus) window.setTimeout(() => mobileMoreButton.current?.focus(), 0)
  }

  const refreshMobileData = async () => {
    if (mobileRefreshing) return
    setMobileRefreshing(true)
    setMobileRefreshMessage('')
    try {
      await refreshData()
      setMobileRefreshMessage('Your workspace is up to date.')
    } catch {
      setMobileRefreshMessage('Could not refresh. Please try again.')
    } finally {
      setMobileRefreshing(false)
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
      setHighlightedResult((value) => (value + 1) % searchResults.length)
    }
    if (event.key === 'ArrowUp' && searchResults.length) {
      event.preventDefault()
      setHighlightedResult((value) => (value - 1 + searchResults.length) % searchResults.length)
    }
    if (event.key === 'Enter' && searchResults[highlightedResult]) {
      event.preventDefault()
      navigate(searchResults[highlightedResult].id)
    }
    if (event.key === 'Escape') {
      setSearch('')
      setSearchOpen(false)
    }
  }

  return (
    <div className={`portal-shell portal-shell-${portal} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="portal-sidebar" inert={mobileMoreOpen}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-lockup">
            <img className="sidebar-brand-full" src={logo} alt="Quantum HRMS" />
            <img className="sidebar-brand-mark" src="/favicon.png" alt="" aria-hidden="true" />
            <span>{isAdmin ? 'Operations Console' : 'People Portal'}</span>
          </div>
        </div>

        <div className="profile-card">
          <img className={user?.avatarUrl ? 'uploaded-profile-photo' : undefined} src={user?.avatarUrl || avatar} alt="Profile" />
          <div>
            <strong>{user?.preferredName || user?.firstName} {user?.lastName}</strong>
            <span>{user?.position}</span>
            <small>{user?.id}</small>
          </div>
        </div>

        <nav className="portal-nav" aria-label="Portal navigation">
          {items.map(({ id, label, icon: Icon, badge, group }, index) => {
            const previousGroup = items[index - 1]?.group
            const badgeValue = resolveBadgeValue(badge)
            return (
              <div className="nav-entry" key={id}>
                {group && group !== previousGroup && <p className="nav-group-label">{group}</p>}
                <button
                  className={active === id ? 'active' : ''}
                  onClick={() => navigate(id)}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {badgeValue ? <em>{badgeValue}</em> : null}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="workspace-status"><i /><span><strong>Live workspace</strong><small>Supabase synchronized</small></span></div>
          <button onClick={refreshData}><RotateCcw size={18} /><span>Refresh Supabase data</span></button>
          <button onClick={() => setShowSignOutConfirm(true)}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>

      <main className="portal-main" inert={mobileMoreOpen}>
        <header className="topbar">
          <div className="topbar-title">
            <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label="Collapse sidebar"><ChevronLeft /></button>
            <div><span>{isAdmin ? 'Quantum HRMS / Operations' : 'My workspace / Today'}</span><strong ref={pageTitle} tabIndex={-1}>{title}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-date" aria-label={`Today is ${currentDate}`}><CalendarDays size={16} /><span>{currentDate}</span></div>
            <div className="topbar-search" onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}>
              <Search size={17} />
              <input
                ref={searchInput}
                type="search"
                role="combobox"
                placeholder="Find a portal page"
                aria-label="Find a portal page"
                aria-autocomplete="list"
                aria-controls="portal-search-results"
                aria-expanded={searchOpen && Boolean(search.trim())}
                aria-activedescendant={searchResults[highlightedResult] ? `portal-search-${searchResults[highlightedResult].id}` : undefined}
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
              <kbd aria-hidden="true">⌘K</kbd>
              {searchOpen && search && (
                <div id="portal-search-results" className="portal-search-results" role="listbox" aria-label="Matching portal pages">
                  {searchResults.map(({ id, label, icon: Icon, group }, index) => (
                    <button
                      id={`portal-search-${id}`}
                      type="button"
                      role="option"
                      aria-selected={index === highlightedResult}
                      className={index === highlightedResult ? 'active' : ''}
                      key={id}
                      onMouseEnter={() => setHighlightedResult(index)}
                      onMouseDown={() => navigate(id)}
                    >
                      <Icon size={16} />
                      <span><strong>{label}</strong><small>{group}</small></span>
                    </button>
                  ))}
                  {searchResults.length === 0 && <span>No matching page</span>}
                </div>
              )}
            </div>
            <div className="notification-control" onBlur={() => window.setTimeout(() => setNotificationsOpen(false), 120)}>
              <button
                className="icon-button notification-button"
                aria-label={isAdmin ? `Open admin notifications, ${attentionCount} items need attention` : `Open employee notifications, ${attentionCount} unread`}
                aria-expanded={notificationsOpen}
                aria-controls={isAdmin ? 'admin-attention-menu' : 'employee-notification-menu'}
                onClick={() => {
                  setSearchOpen(false)
                  setNotificationsOpen((value) => !value)
                }}
              >
                <Bell size={19} />
                {attentionCount > 0 && <span>{attentionCount > 99 ? '99+' : attentionCount}</span>}
              </button>
              {isAdmin && notificationsOpen && (
                <section id="admin-attention-menu" className="admin-attention-menu" aria-label="Administrator attention center">
                  <header><div><small>Live work queue</small><strong>Administrator attention</strong></div><em>{attentionCount} open</em></header>
                  <div className="admin-attention-list">
                    <button type="button" onMouseDown={() => navigate('approvals')}>
                      <span className="attention-icon attention-approvals"><ClipboardCheck /></span>
                      <span><strong>Approvals and HR cases</strong><small>{pendingLeaveCount} leave request{pendingLeaveCount === 1 ? '' : 's'} · {openRequestCount} employee case{openRequestCount === 1 ? '' : 's'}</small></span>
                      <em>{pendingApprovals}</em>
                    </button>
                    <button type="button" onMouseDown={() => navigate('security')}>
                      <span className="attention-icon attention-security"><ShieldAlert /></span>
                      <span><strong>New security alerts</strong><small>Untriaged events requiring administrator review</small></span>
                      <em>{newAlerts}</em>
                    </button>
                  </div>
                  <footer><button type="button" onMouseDown={() => navigate('action-center')}>Open full Action Center</button><small>Updated through Supabase realtime</small></footer>
                </section>
              )}
              {!isAdmin && notificationsOpen && (
                <section id="employee-notification-menu" className="admin-attention-menu employee-notification-menu" aria-label="Employee notification center">
                  <header><div><small>Personal updates</small><strong>Notifications</strong></div><em>{unreadNotifications} unread</em></header>
                  <div className="employee-notification-list">
                    {employeeNotifications.slice(0, 4).map((notification) => (
                      <button
                        type="button"
                        className={!notification.readAt ? 'unread' : ''}
                        key={notification.id}
                        onClick={() => openEmployeeNotification(notification)}
                      >
                        <span className="employee-notification-icon"><Bell /></span>
                        <span>
                          <small>{notification.category}</small>
                          <strong>{notification.title}</strong>
                          <p>{notification.message}</p>
                        </span>
                        <em>{notification.readAt ? 'Read' : 'New'}</em>
                      </button>
                    ))}
                    {employeeNotifications.length === 0 && <p className="employee-notification-empty">Your notification inbox is clear.</p>}
                  </div>
                  <footer>
                    <button type="button" onClick={() => navigate('inbox')}>Open Action Inbox</button>
                    {unreadNotifications > 0 && <button type="button" onClick={() => markAllNotificationsRead()}><CheckCircle2 />Mark all read</button>}
                  </footer>
                </section>
              )}
            </div>
            <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color theme" aria-pressed={theme === 'dark'} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
        </header>
        <div className="portal-content">{children}</div>
      </main>

      <nav className="mobile-bottom-nav" inert={mobileMoreOpen} aria-label={`${isAdmin ? 'Administrator' : 'Employee'} mobile navigation`}>
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
              <span className="mobile-nav-icon" aria-hidden="true"><Icon />{badgeValue ? <em>{typeof badgeValue === 'number' && badgeValue > 99 ? '99+' : badgeValue}</em> : null}</span>
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
            setMobileRefreshMessage('')
            setMobileMoreOpen(true)
          }}
        >
          <span className="mobile-nav-icon"><LayoutGrid /></span>
          <span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="mobile-more-layer">
          <button className="mobile-more-scrim" type="button" tabIndex={-1} aria-hidden="true" onClick={() => closeMobileMore()} />
          <section ref={mobileSheet} id="mobile-more-navigation" className="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
            <div className="mobile-more-handle" aria-hidden="true" />
            <header className="mobile-more-header">
              <div>
                <small>{isAdmin ? 'Administrator workspace' : 'Employee workspace'}</small>
                <h2 id="mobile-more-title">Explore your portal</h2>
              </div>
              <button ref={mobileCloseButton} type="button" aria-label="Close more navigation" onClick={() => closeMobileMore()}><X /></button>
            </header>

            <div className="mobile-more-profile">
              <img className={user?.avatarUrl ? 'uploaded-profile-photo' : undefined} src={user?.avatarUrl || avatar} alt="" />
              <span>
                <strong>{user?.preferredName || user?.firstName} {user?.lastName}</strong>
                <small>{user?.position || (isAdmin ? 'Administrator' : 'Employee')} · {user?.id}</small>
              </span>
            </div>

            <label className="mobile-more-search">
              <Search />
              <span className="sr-only">Search portal pages</span>
              <input
                ref={mobileSearchInput}
                type="search"
                value={mobilePageSearch}
                placeholder="Search portal pages"
                onChange={(event) => setMobilePageSearch(event.target.value)}
              />
              {mobilePageSearch && <button type="button" aria-label="Clear portal page search" onClick={() => setMobilePageSearch('')}><X /></button>}
            </label>

            <nav className="mobile-more-pages" aria-label="All portal pages">
              {mobilePageGroups.map((group) => (
                <section key={group.name} aria-labelledby={`mobile-nav-group-${group.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
                  <h3 id={`mobile-nav-group-${group.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>{group.name}</h3>
                  <div>
                    {group.items.map(({ id, label, icon: Icon, badge }) => {
                      const badgeValue = resolveBadgeValue(badge)
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
              {mobilePageGroups.length === 0 && <p className="mobile-more-empty" role="status">{mobilePageSearch.trim() ? `No portal page matches “${mobilePageSearch}”.` : 'All your pages are available in the bottom navigation.'}</p>}
            </nav>

            {mobileRefreshMessage && <p className="mobile-refresh-message" role="status">{mobileRefreshMessage}</p>}
            <footer className="mobile-more-utilities">
              <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                {theme === 'light' ? <Moon /> : <Sun />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
              </button>
              <button type="button" disabled={mobileRefreshing} onClick={refreshMobileData}><RotateCcw /><span>{mobileRefreshing ? 'Refreshing…' : 'Refresh'}</span></button>
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
