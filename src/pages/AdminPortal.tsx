import { useState } from 'react'
import { BarChart3, CalendarClock, ClipboardCheck, FolderLock, Gauge, Megaphone, PhilippinePeso, ShieldCheck, Target, UserCog, Users, Workflow } from 'lucide-react'
import PortalLayout from '../components/PortalLayout.js'
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

const navItems = [
  { id: 'action-center', label: 'Action Center', icon: Gauge, badge: 'approvals', group: 'Workspace' },
  { id: 'people', label: 'People Directory', icon: Users, group: 'People Operations' },
  { id: 'time', label: 'Time & Attendance', icon: CalendarClock, group: 'People Operations' },
  { id: 'approvals', label: 'Approvals', icon: ClipboardCheck, badge: 'approvals', group: 'People Operations' },
  { id: 'lifecycle', label: 'On/Offboarding', icon: Workflow, group: 'People Operations' },
  { id: 'payroll', label: 'Payroll Runs', icon: PhilippinePeso, group: 'Talent & Rewards' },
  { id: 'performance', label: 'Performance', icon: Target, group: 'Talent & Rewards' },
  { id: 'documents', label: 'Documents & Policy', icon: FolderLock, group: 'Governance' },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3, group: 'Governance' },
  { id: 'announcements', label: 'Communications', icon: Megaphone, group: 'Governance' },
  { id: 'security', label: 'Security Center', icon: ShieldCheck, badge: 'alerts', group: 'Governance' },
  { id: 'admin-accounts', label: 'Admin Accounts & Roles', icon: UserCog, group: 'System Administration' },
] as const

type AdminPage = typeof navItems[number]['id']

const titles = Object.fromEntries(navItems.map((item) => [item.id, item.label]))
export default function AdminPortal() {
  const [active, setActive] = useState<AdminPage>('action-center')
  const { data, user } = useHrms()
  if (!data || !user) return null

  const rolePages: Record<string, AdminPage[]> = {
    admin: navItems.map((item) => item.id),
    hr_admin: ['action-center', 'people', 'time', 'approvals', 'lifecycle', 'performance', 'documents', 'analytics', 'announcements'],
    payroll_admin: ['action-center', 'payroll', 'documents', 'analytics'],
    security_admin: ['action-center', 'security', 'analytics'],
    auditor: ['action-center', 'analytics', 'security'],
  }
  const allowedPages = rolePages[user.role ?? ''] || ['action-center']
  const visibleNavItems = navItems.filter((item) => allowedPages.includes(item.id))
  const resolvedActive = allowedPages.includes(active) ? active : visibleNavItems[0]?.id || 'action-center'

  const pages = {
    'action-center': <AdminActionCenter onNavigate={(page) => setActive(page as AdminPage)} />,
    people: <PeopleDirectory onNavigate={(page) => setActive(page as AdminPage)} />,
    time: <AdminTimeOperations />,
    approvals: <AdminApprovals />,
    lifecycle: <AdminLifecycleOperations />,
    payroll: <AdminPayrollOperations />,
    performance: <AdminPerformanceOperations />,
    documents: <AdminDocumentOperations />,
    analytics: <AdminAnalyticsReports />,
    announcements: <AdminCommunications />,
    security: <AdminSecurityCenter readOnly={user.role === 'auditor'} />,
    'admin-accounts': <AdminAccounts />,
  }

  return <PortalLayout active={resolvedActive} onNavigate={(page) => setActive(page as AdminPage)} items={visibleNavItems} title={titles[resolvedActive]}>{pages[resolvedActive]}</PortalLayout>
}
