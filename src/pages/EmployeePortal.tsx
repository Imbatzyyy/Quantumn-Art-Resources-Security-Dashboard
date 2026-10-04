import type { ReactNode } from 'react'
import {
  CalendarDays,
  CircleHelp,
  Clock3,
  FileCheck2,
  FolderLock,
  Gauge,
  Inbox,
  ListChecks,
  ShieldCheck,
  TrendingUp,
  UserRound,
  WalletCards,
} from 'lucide-react'
import PortalLayout from '../components/PortalLayout.js'
import FirstLoginPasswordSetup from '../components/FirstLoginPasswordSetup.js'
import { usePortalRoute } from '../components/portalRouting.js'
import { useHrms } from '../state/useHrms.js'
import EmployeeAccountSecurity from './EmployeeAccountSecurity.js'
import { MyDay } from './employee/MyDay.js'
import { TimeAndSchedule } from './employee/TimeAndSchedule.js'
import { EmployeeLeave } from './employee/Leave.js'
import { RequestCenter } from './employee/RequestCenter.js'
import { ActionInbox } from './employee/Inbox.js'
import { PayAndBenefits } from './employee/PayAndBenefits.js'
import { GoalsAndGrowth } from './employee/GoalsAndGrowth.js'
import { DocumentVault } from './employee/Documents.js'
import { HelpCenter } from './employee/HelpCenter.js'
import { EmployeeJourney } from './employee/Journey.js'
import { EmployeeProfile } from './employee/Profile.js'

const employeePages = [
  { id: 'home', path: 'my-day', label: 'My Day', icon: Gauge, group: 'Workspace' },
  { id: 'schedule', path: 'time', label: 'Time & Schedule', icon: Clock3, group: 'My Work' },
  { id: 'leave', path: 'leave', label: 'Leave', icon: CalendarDays, group: 'My Work' },
  { id: 'requests', path: 'requests', label: 'Request Center', icon: FileCheck2, group: 'My Work' },
  { id: 'inbox', path: 'inbox', label: 'Inbox', icon: Inbox, badge: 'inbox', group: 'My Work' },
  { id: 'pay', path: 'pay', label: 'Pay & Benefits', icon: WalletCards, group: 'My Career' },
  { id: 'growth', path: 'growth', label: 'Goals & Growth', icon: TrendingUp, group: 'My Career' },
  { id: 'documents', path: 'documents', label: 'Documents', icon: FolderLock, group: 'Resources' },
  { id: 'help', path: 'help', label: 'HR Help Center', icon: CircleHelp, group: 'Resources' },
  { id: 'journey', path: 'journey', label: 'My Journey', icon: ListChecks, group: 'My Account' },
  { id: 'account-security', path: 'security', label: 'Account Security', icon: ShieldCheck, badge: 'alerts', group: 'My Account' },
  { id: 'profile', path: 'profile', label: 'My Profile', icon: UserRound, group: 'My Account' },
] as const

type EmployeePage = typeof employeePages[number]['id']
const pageIds = employeePages.map((page) => page.id)
const titles = Object.fromEntries(employeePages.map((item) => [item.id, item.label])) as Record<EmployeePage, string>

export default function EmployeePortal() {
  const { data, user } = useHrms()
  const { activeId, searchParams, go } = usePortalRoute('employee', employeePages, 'home')
  if (!data || !user) return null
  const active = activeId as EmployeePage
  const param = (name: string) => searchParams.get(name)
  const setParam = (page: EmployeePage, name: string, value: string | null) => go(value ? `${page}?${name}=${encodeURIComponent(value)}` : page, { replace: true })

  const pages: Record<EmployeePage, ReactNode> = {
    home: <MyDay onNavigate={go} />,
    schedule: <TimeAndSchedule key={param('view') ?? 'history'} onNavigate={go} view={param('view')} />,
    leave: <EmployeeLeave key={param('new') ? 'new' : 'list'} startOpen={Boolean(param('new'))} onCloseRequest={() => param('new') && go('leave', { replace: true })} />,
    requests: <RequestCenter key={param('new') ?? 'list'} selectedId={param('request')} newType={param('new')} onSelect={(id) => setParam('requests', 'request', id)} onCloseNew={() => param('new') && go('requests', { replace: true })} />,
    inbox: <ActionInbox onNavigate={go} pageIds={pageIds} />,
    pay: <PayAndBenefits selectedId={param('payslip')} onSelect={(id) => setParam('pay', 'payslip', id)} />,
    growth: <GoalsAndGrowth />,
    documents: <DocumentVault selectedId={param('doc')} onSelect={(id) => setParam('documents', 'doc', id)} />,
    help: <HelpCenter onNavigate={go} />,
    journey: <EmployeeJourney />,
    'account-security': <EmployeeAccountSecurity />,
    profile: <EmployeeProfile onNavigate={go} />,
  }

  return <>
    <PortalLayout active={active} onNavigate={go} items={employeePages} title={titles[active]}>{pages[active]}</PortalLayout>
    {user.mustChangePassword && <FirstLoginPasswordSetup />}
  </>
}
