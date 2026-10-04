import type { ReactNode } from 'react'
import { BarChart3, CalendarClock, ClipboardCheck, FolderLock, Gauge, Megaphone, PhilippinePeso, ShieldCheck, Target, UserCog, UserRoundCheck, Users, Workflow } from 'lucide-react'
import PortalLayout from '../components/PortalLayout.js'
import { usePortalRoute } from '../components/portalRouting.js'
import { useHrms } from '../state/useHrms.js'
import AdminSecurityCenter from './AdminSecurityCenter.js'
import AdminAccounts from './AdminAccounts.js'
import PeopleDirectory from './PeopleDirectory.js'
import AdminTimeOperations from './AdminTimeOperations.js'
import AdminApprovals from './AdminApprovals.js'
import AdminLifecycleOperations from './AdminLifecycleOperations.js'
import AdminActionCenter from './AdminActionCenter.js'
import AdminPayrollOperations from './AdminPayrollOperations.js'
import AdminPerformanceOperations from './AdminPerformanceOperations.js'
import AdminDocumentOperations from './AdminDocumentOperations.js'
import AdminAnalyticsReports from './AdminAnalyticsReports.js'
import AdminCommunications from './AdminCommunications.js'
import EmployeeAccountSecurity from './EmployeeAccountSecurity.js'

const adminPages = [
  { id: 'action-center', path: 'dashboard', label: 'Dashboard', icon: Gauge, group: 'Workspace' },
  { id: 'people', path: 'people', label: 'People Directory', icon: Users, group: 'People' },
  { id: 'time', path: 'time', label: 'Time & Attendance', icon: CalendarClock, group: 'People' },
  { id: 'approvals', path: 'approvals', label: 'Approvals', icon: ClipboardCheck, badge: 'approvals', group: 'People' },
  { id: 'lifecycle', path: 'onboarding', label: 'Onboarding & Offboarding', icon: Workflow, group: 'People' },
  { id: 'payroll', path: 'payroll', label: 'Payroll', icon: PhilippinePeso, group: 'Pay & Performance' },
  { id: 'performance', path: 'performance', label: 'Performance', icon: Target, group: 'Pay & Performance' },
  { id: 'documents', path: 'documents', label: 'Documents & Policies', icon: FolderLock, group: 'Company' },
  { id: 'announcements', path: 'announcements', label: 'Announcements', icon: Megaphone, group: 'Company' },
  { id: 'analytics', path: 'reports', label: 'Reports & Analytics', icon: BarChart3, group: 'Company' },
  { id: 'security', path: 'security', label: 'Security Center', icon: ShieldCheck, badge: 'alerts', group: 'Security & Access' },
  { id: 'admin-accounts', path: 'admin-accounts', label: 'Admin Accounts', icon: UserCog, group: 'Security & Access' },
  { id: 'account-security', path: 'my-security', label: 'My Account Security', icon: UserRoundCheck, group: 'My Account' },
] as const

type AdminPage = typeof adminPages[number]['id']

const titles = Object.fromEntries(adminPages.map((item) => [item.id, item.label])) as Record<AdminPage, string>
const rolePages: Record<string, AdminPage[]> = {
  admin: adminPages.map((item) => item.id),
  hr_admin: ['action-center', 'people', 'time', 'approvals', 'lifecycle', 'performance', 'documents', 'analytics', 'announcements'],
  payroll_admin: ['action-center', 'payroll', 'documents', 'analytics'],
  security_admin: ['action-center', 'security', 'analytics'],
  auditor: ['action-center', 'analytics', 'security'],
}

export default function AdminPortal() {
  const { data, user } = useHrms()
  const allowedPages: AdminPage[] = [...new Set<AdminPage>([...(rolePages[user?.role ?? ''] || ['action-center']), 'account-security'])]
  const { activeId, subPath, searchParams, go } = usePortalRoute('admin', adminPages, 'action-center', allowedPages)
  if (!data || !user) return null
  const active = activeId as AdminPage
  const visibleNavItems = adminPages.filter((item) => allowedPages.includes(item.id))
  const param = (name: string) => searchParams.get(name)
  const withParams = (page: AdminPage, changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const query = next.toString()
    // Keep the current sub-page (for example an employee ID) when changing tabs or filters.
    const target = page === active && subPath.length ? `${page}/${subPath.join('/')}` : page
    go(query ? `${target}?${query}` : target, { replace: true })
  }

  const selectedEmployee = active === 'people' && subPath[0] ? data.employees.find((employee) => employee.id === subPath[0] && employee.role === 'employee') : undefined
  const crumbs = selectedEmployee ? [{ label: `${selectedEmployee.preferredName || selectedEmployee.firstName} ${selectedEmployee.lastName}` }] : []

  const pages: Record<AdminPage, ReactNode> = {
    'account-security': <EmployeeAccountSecurity />,
    'action-center': <AdminActionCenter onNavigate={go} allowedPages={allowedPages} />,
    people: <PeopleDirectory
      key={param('new') ? 'new' : 'directory'}
      onNavigate={go}
      employeeId={subPath[0] ?? null}
      tab={param('tab')}
      view={param('view')}
      startCreating={Boolean(param('new'))}
      onTabChange={(tab) => withParams('people', { tab })}
      onViewChange={(view) => withParams('people', { view })}
    />,
    time: <AdminTimeOperations onNavigate={go} />,
    approvals: <AdminApprovals view={param('view')} requestId={param('request')} onViewChange={(view) => withParams('approvals', { view, request: null })} onRequestChange={(request) => withParams('approvals', { request })} />,
    lifecycle: <AdminLifecycleOperations />,
    payroll: <AdminPayrollOperations runId={param('run')} onRunChange={(run) => withParams('payroll', { run })} />,
    performance: <AdminPerformanceOperations />,
    documents: <AdminDocumentOperations documentId={param('doc')} onDocumentChange={(doc) => withParams('documents', { doc })} />,
    analytics: <AdminAnalyticsReports />,
    announcements: <AdminCommunications />,
    security: <AdminSecurityCenter
      key={param('severity') ?? 'all'}
      readOnly={user.role === 'auditor'}
      tab={param('tab')}
      severity={param('severity')}
      onTabChange={(tab) => withParams('security', { tab, severity: null })}
    />,
    'admin-accounts': <AdminAccounts />,
  }

  return <PortalLayout active={active} onNavigate={go} items={visibleNavItems} title={titles[active]} crumbs={crumbs}>{pages[active]}</PortalLayout>
}
