import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  LogOut,
  Menu,
  Moon,
  RotateCcw,
  Search,
  Sun,
  X,
} from 'lucide-react'
import logo from '../../assets/images/mainlogo_blue.png'
import avatar from '../../assets/images/default-avatar.png'
import { useHrms } from '../state/useHrms.js'
import type { PortalNavigationItem, ThemeMode } from '../types/hrms.js'

interface PortalLayoutProps {
  active: string
  onNavigate: (id: string) => void
  items: readonly PortalNavigationItem[]
  title: string
  children: ReactNode
}

export default function PortalLayout({ active, onNavigate, items, title, children }: PortalLayoutProps) {
  const { user, logout, data, refreshData } = useHrms()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const portal = user?.portal === 'admin' ? 'admin' : 'employee'
  const isAdmin = portal === 'admin'
  const currentDate = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const visibleAlerts = user?.portal === 'admin'
    ? (data?.securityAlerts ?? [])
    : (data?.securityAlerts.filter((alert) => alert.employeeId === user?.id) ?? [])
  const newAlerts = visibleAlerts.filter((alert) => alert.status === 'New').length
  const unreadNotifications = data?.notifications?.filter(
    (notification) => notification.employeeId === user?.id && !notification.readAt,
  ).length ?? 0
  const pendingApprovals = user?.portal === 'admin'
    ? (data?.leaveRequests?.filter((item) => item.status === 'Pending').length ?? 0)
      + (data?.employeeRequests?.filter((item) => ['Submitted', 'Under Review', 'More Information'].includes(item.status)).length ?? 0)
    : 0
  const searchResults = search.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()))
    : []

  const navigate = (id: string) => {
    onNavigate(id)
    setMobileOpen(false)
    setSearch('')
    setSearchOpen(false)
  }

  const searchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && searchResults[0]) {
      event.preventDefault()
      navigate(searchResults[0].id)
    }
    if (event.key === 'Escape') {
      setSearch('')
      setSearchOpen(false)
    }
  }

  return (
    <div className={`portal-shell portal-shell-${portal} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`portal-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-lockup">
            <img src={logo} alt="Quantum HRMS" />
            <span>{isAdmin ? 'Operations Console' : 'People Portal'}</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button>
        </div>

        <div className="profile-card">
          <img src={avatar} alt="Profile" />
          <div>
            <strong>{user?.preferredName || user?.firstName} {user?.lastName}</strong>
            <span>{user?.position}</span>
            <small>{user?.id}</small>
          </div>
        </div>

        <nav className="portal-nav" aria-label="Portal navigation">
          {items.map(({ id, label, icon: Icon, badge, group }, index) => {
            const previousGroup = items[index - 1]?.group
            const badgeValue = badge === 'alerts'
              ? newAlerts
              : badge === 'inbox'
                ? unreadNotifications
                : badge === 'approvals'
                  ? pendingApprovals
                  : badge
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
          <button onClick={logout}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></button>
            <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label="Collapse sidebar"><ChevronLeft /></button>
            <div><span>{isAdmin ? 'Quantum HRMS / Operations' : 'My workspace / Today'}</span><strong>{title}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-date" aria-label={`Today is ${currentDate}`}><CalendarDays size={16} /><span>{currentDate}</span></div>
            <label className="topbar-search" onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}>
              <Search size={17} />
              <input
                type="search"
                placeholder="Find a portal page"
                aria-label="Find a portal page"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={searchKeyDown}
              />
              {searchOpen && search && (
                <div className="portal-search-results" role="listbox" aria-label="Matching portal pages">
                  {searchResults.map(({ id, label, icon: Icon }) => (
                    <button type="button" key={id} onMouseDown={() => navigate(id)}>
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                  {searchResults.length === 0 && <span>No matching page</span>}
                </div>
              )}
            </label>
            <button className="icon-button notification-button" aria-label={`${isAdmin ? pendingApprovals + newAlerts : unreadNotifications} items need attention`} onClick={() => onNavigate(isAdmin ? 'action-center' : 'inbox')}>
              <Bell size={19} />
              {(isAdmin ? pendingApprovals + newAlerts : unreadNotifications) > 0 && (
                <span>{isAdmin ? pendingApprovals + newAlerts : unreadNotifications}</span>
              )}
            </button>
            <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle color theme">
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
        </header>
        <div className="portal-content">{children}</div>
      </main>
    </div>
  )
}
