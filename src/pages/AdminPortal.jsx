import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  FolderLock,
  Gauge,
  Megaphone,
  MessageSquareText,
  PhilippinePeso,
  Plus,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  UserCog,
  UserRoundCheck,
  Users,
  Workflow,
  X,
} from 'lucide-react'
import PortalLayout from '../components/PortalLayout.tsx'
import { Badge, EmptyState, Modal, ProgressBar, SectionHeading, StatCard, TableShell } from '../components/ui.tsx'
import { useHrms } from '../state/useHrms.js'
import { downloadCsv } from '../utils/downloads.js'
import { formatDate, formatDateTime, formatMoney, statusTone } from '../utils/format.js'
import AdminSecurityCenter from './AdminSecurityCenter.js'
import AdminAccounts from './AdminAccounts.js'
import PeopleDirectory from './PeopleDirectory.js'

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
]

const titles = Object.fromEntries(navItems.map((item) => [item.id, item.label]))
const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const payrollNext = { Draft: 'Validation', Validation: 'Approved', Approved: 'Released', Released: 'Paid', Paid: 'Locked' }

const personName = (data, employeeId) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminPortal() {
  const [active, setActive] = useState('action-center')
  const { data, user } = useHrms()
  if (!data) return null

  const rolePages = {
    admin: navItems.map((item) => item.id),
    hr_admin: ['action-center', 'people', 'time', 'approvals', 'lifecycle', 'performance', 'documents', 'analytics', 'announcements'],
    payroll_admin: ['action-center', 'payroll', 'documents', 'analytics'],
    security_admin: ['action-center', 'security', 'analytics'],
    auditor: ['action-center', 'analytics', 'security'],
  }
  const allowedPages = rolePages[user.role] || ['action-center']
  const visibleNavItems = navItems.filter((item) => allowedPages.includes(item.id))
  const resolvedActive = allowedPages.includes(active) ? active : visibleNavItems[0]?.id || 'action-center'

  const pages = {
    'action-center': <ActionCenter onNavigate={setActive} />,
    people: <PeopleDirectory onNavigate={setActive} />,
    time: <TimeOperations />,
    approvals: <ApprovalsCenter />,
    lifecycle: <LifecycleOperations />,
    payroll: <PayrollOperations />,
    performance: <PerformanceOperations />,
    documents: <DocumentOperations />,
    analytics: <AnalyticsReports />,
    announcements: <Communications />,
    security: <AdminSecurityCenter readOnly={user.role === 'auditor'} />,
    'admin-accounts': <AdminAccounts />,
  }

  return <PortalLayout active={resolvedActive} onNavigate={setActive} items={visibleNavItems} title={titles[resolvedActive]}>{pages[resolvedActive]}</PortalLayout>
}

function ActionCenter({ onNavigate }) {
  const { data, user } = useHrms()
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const activeEmployees = data.employees.filter((employee) => employee.status === 'Active' && employee.role === 'employee').length
  const pendingLeaves = data.leaveRequests.filter((request) => request.status === 'Pending')
  const openRequests = data.employeeRequests.filter((request) => openRequestStatuses.includes(request.status))
  const openAlerts = data.securityAlerts.filter((alert) => alert.status !== 'Resolved')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(currentTime)
  const missingClockOut = data.attendance.filter((item) => item.date === today && item.clockIn && !item.clockOut)
  const approvals = pendingLeaves.length + openRequests.length
  const liveDate = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(currentTime)
  const liveTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(currentTime)

  return (
    <div className="page-stack admin-dashboard">
      <section className="admin-command-hero">
        <div className="admin-command-copy">
          <div className="command-status"><i /><span>Live operations</span></div>
          <span className="eyebrow">HR operations center</span>
          <h1>Good day, {user.firstName}.</h1>
          <p>One operational view across your people, approvals, attendance, and security posture.</p>
          <div className="command-hero-meta" aria-label={`Current Philippine date and time: ${liveDate}, ${liveTime}`}>
            <span><CalendarDays />{liveDate}</span>
            <span><Clock3 /><time dateTime={currentTime.toISOString()}>{liveTime}</time><small>PHT</small></span>
          </div>
        </div>
        <div className="admin-command-actions">
          <div className="command-readiness"><ShieldCheck /><span><small>Security readiness</small><strong>{openAlerts.length ? `${openAlerts.length} alerts to review` : 'All controls healthy'}</strong></span></div>
          <button className="button button-primary" onClick={() => onNavigate('approvals')}><ClipboardCheck />Review {approvals} approvals</button>
          <button className="button command-secondary" onClick={() => onNavigate('security')}><ShieldCheck />Open security center</button>
        </div>
      </section>
      <div className="stats-grid stats-grid-4 admin-metric-grid"><StatCard icon={Users} label="Active workforce" value={activeEmployees} detail={`${data.employees.length} total people records`} tone="blue" /><StatCard icon={ClipboardCheck} label="Decisions waiting" value={approvals} detail={`${pendingLeaves.length} leave · ${openRequests.length} HR cases`} tone="amber" /><StatCard icon={CalendarClock} label="Time exceptions" value={missingClockOut.length} detail="Clocked in with no clock-out" tone="purple" /><StatCard icon={ShieldCheck} label="Security exposure" value={openAlerts.length} detail={`${openAlerts.filter((item) => item.severity === 'Critical').length} critical findings`} tone="red" /></div>

      <div className="content-grid dashboard-grid admin-overview-grid">
        <section className="panel admin-priority-panel"><div className="panel-header"><div><span className="panel-kicker">Decision workspace</span><h2>Priority work queue</h2><p>Ranked by impact, urgency, and employee need.</p></div><Badge tone={approvals + openAlerts.length ? 'warning' : 'success'}>{approvals + openAlerts.length} open</Badge></div><div className="admin-action-queue">
          {pendingLeaves.slice(0, 2).map((item) => <button key={`leave-${item.id}`} onClick={() => onNavigate('approvals')}><span className="queue-priority warning">Leave</span><div><strong>{personName(data, item.employeeId)} requested {item.type.toLowerCase()} leave</strong><p>{formatDate(item.startDate)}–{formatDate(item.endDate)} · {item.days} day{item.days === 1 ? '' : 's'}</p></div><ChevronRight /></button>)}
          {openRequests.slice(0, 3).map((item) => <button key={`request-${item.id}`} onClick={() => onNavigate('approvals')}><span className={`queue-priority ${item.priority === 'Urgent' ? 'danger' : 'info'}`}>{item.priority}</span><div><strong>{item.subject}</strong><p>{personName(data, item.employeeId)} · {item.type} · {item.status}</p></div><ChevronRight /></button>)}
          {openAlerts.slice(0, 2).map((item) => <button key={`alert-${item.id}`} onClick={() => onNavigate('security')}><span className={`queue-priority ${item.severity === 'Critical' ? 'danger' : 'warning'}`}>{item.severity}</span><div><strong>{item.title}</strong><p>{item.affected} · {item.recommendedAction}</p></div><ChevronRight /></button>)}
          {!approvals && !openAlerts.length && <EmptyState icon={CheckCircle2} title="Operations are clear" text="New approval, exception, and security work will appear here." />}
        </div></section>

        <section className="panel admin-workforce-panel"><div className="panel-header"><div><span className="panel-kicker">Organization signal</span><h2>Workforce coverage</h2><p>Active people by department</p></div><Badge tone="success">Realtime</Badge></div><div className="bar-chart">{[...new Set(data.employees.map((employee) => employee.department))].map((department) => { const count = data.employees.filter((employee) => employee.department === department && employee.status === 'Active').length; return <div key={department}><span>{department}</span><progress value={count} max={Math.max(activeEmployees, 1)}>{count}</progress><strong>{count}</strong></div> })}</div></section>
      </div>

      <section className="panel admin-audit-panel"><div className="panel-header"><div><span className="panel-kicker">Protected evidence</span><h2>Recent sensitive activity</h2><p>Authenticated database actions preserved for review.</p></div><button className="text-button" onClick={() => onNavigate('analytics')}>Open audit reports</button></div><div className="activity-feed">{data.auditLog.slice(0, 8).map((entry) => <article key={entry.id}><span><Activity /></span><div><strong>{entry.action}</strong><p>{entry.actor} · {entry.target}</p></div><time>{entry.time}</time></article>)}</div></section>
    </div>
  )
}

function TimeOperations() {
  const { data, saveSchedule } = useHrms()
  const [showSchedule, setShowSchedule] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const defaultEmployee = data.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const [form, setForm] = useState({ employeeId: defaultEmployee, date: today, shiftStart: '08:00', shiftEnd: '17:00', location: 'Main Office', workMode: 'On-site', notes: '' })
  const todayRecords = data.attendance.filter((item) => item.date === today)
  const missingOut = todayRecords.filter((item) => item.clockIn && !item.clockOut)
  const exceptionRequests = data.employeeRequests.filter((item) => ['Attendance Correction', 'Overtime', 'Schedule Change'].includes(item.type) && openRequestStatuses.includes(item.status))
  const scheduleCoverage = data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').filter((employee) => data.schedules.some((item) => item.employeeId === employee.id && item.date === today)).length

  const submit = async (event) => {
    event.preventDefault()
    try { await saveSchedule(form); setShowSchedule(false) } catch { /* Keep form open. */ }
  }

  return <div className="page-stack"><SectionHeading eyebrow="Exception-first operations" title="Time & Attendance" description="Monitor live attendance, assigned schedules, and correction requests without silently changing employee records." actions={<button className="button button-primary" onClick={() => setShowSchedule(true)}><Plus />Assign schedule</button>} /><div className="stats-grid stats-grid-4"><StatCard icon={CheckCircle2} label="Clocked in today" value={todayRecords.length} tone="green" /><StatCard icon={Clock3} label="Late arrivals" value={todayRecords.filter((item) => item.status === 'Late').length} tone="amber" /><StatCard icon={CalendarClock} label="Open time records" value={missingOut.length} detail="Clock-in without clock-out" tone="purple" /><StatCard icon={CalendarDays} label="Schedule coverage" value={scheduleCoverage} detail="Active employees today" tone="blue" /></div><div className="content-grid content-grid-2"><section className="panel"><div className="panel-header"><div><h2>Today’s attendance</h2><p>Employee clock events from Supabase</p></div></div><TableShell><thead><tr><th>Employee</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>{todayRecords.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{item.clockIn ?? '—'}</td><td>{item.clockOut ?? 'Open'}</td><td>{item.hours.toFixed(1)}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></TableShell></section><section className="panel"><div className="panel-header"><div><h2>Time exceptions</h2><p>Employee-submitted corrections and schedule changes</p></div><Badge tone={exceptionRequests.length ? 'warning' : 'success'}>{exceptionRequests.length} open</Badge></div><div className="compact-record-list">{exceptionRequests.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><p>{personName(data, item.employeeId)} · {item.type} · {formatDate(item.requestedDate)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}{!exceptionRequests.length && <EmptyState icon={CheckCircle2} title="No time exceptions" text="Correction and schedule requests will appear here and in Approvals." />}</div></section></div><section className="panel"><div className="panel-header"><div><h2>Upcoming schedule roster</h2><p>Next assigned shift per employee</p></div></div><TableShell><thead><tr><th>Employee</th><th>Date</th><th>Shift</th><th>Mode</th><th>Location</th></tr></thead><tbody>{data.schedules.filter((item) => item.date >= today).slice(0, 20).map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong></td><td>{formatDate(item.date)}</td><td>{item.workMode === 'Rest Day' ? 'Rest day' : `${item.shiftStart}–${item.shiftEnd}`}</td><td><Badge tone={item.workMode === 'Rest Day' ? 'neutral' : 'info'}>{item.workMode}</Badge></td><td>{item.location}</td></tr>)}</tbody></TableShell></section>{showSchedule && <Modal title="Assign or update schedule" onClose={() => setShowSchedule(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Employee<select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}</select></label><label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label>Work mode<select value={form.workMode} onChange={(event) => setForm({ ...form, workMode: event.target.value })}><option>On-site</option><option>Remote</option><option>Hybrid</option><option>Rest Day</option></select></label><label>Shift start<input type="time" value={form.shiftStart} onChange={(event) => setForm({ ...form, shiftStart: event.target.value })} disabled={form.workMode === 'Rest Day'} required /></label><label>Shift end<input type="time" value={form.shiftEnd} onChange={(event) => setForm({ ...form, shiftEnd: event.target.value })} disabled={form.workMode === 'Rest Day'} required /></label><label className="span-2">Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} disabled={form.workMode === 'Rest Day'} required /></label><label className="span-2">Notes<textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowSchedule(false)}>Cancel</button><button className="button button-primary">Save schedule</button></div></form></Modal>}</div>
}

function ApprovalsCenter() {
  const { data, reviewLeave, reviewRequest, addRequestComment } = useHrms()
  const [selectedId, setSelectedId] = useState(null)
  const [decision, setDecision] = useState('Under Review')
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [internal, setInternal] = useState(false)
  const pendingLeaves = data.leaveRequests.filter((item) => item.status === 'Pending')
  const requests = data.employeeRequests.filter((item) => openRequestStatuses.includes(item.status))
  const selected = data.employeeRequests.find((item) => item.id === selectedId)
  const comments = data.requestComments.filter((item) => item.requestId === selectedId)

  const decide = async (event) => {
    event.preventDefault()
    try { await reviewRequest(selectedId, decision, reason); setReason(''); if (['Approved', 'Rejected', 'Completed'].includes(decision)) setSelectedId(null) } catch { /* Keep decision form. */ }
  }
  const addComment = async (event) => {
    event.preventDefault()
    try { await addRequestComment(selectedId, comment, internal); setComment(''); setInternal(false) } catch { /* Keep comment. */ }
  }

  return <div className="page-stack"><SectionHeading eyebrow="Explainable decisions" title="Unified Approvals" description="Review leave and HR requests with clear context, decision reasons, comments, and employee notifications." /><div className="stats-grid stats-grid-3"><StatCard icon={CalendarCheck} label="Leave decisions" value={pendingLeaves.length} tone="amber" /><StatCard icon={FileCheck2} label="HR request queue" value={requests.length} tone="blue" /><StatCard icon={MessageSquareText} label="Needs information" value={requests.filter((item) => item.status === 'More Information').length} tone="purple" /></div><section className="panel"><div className="panel-header"><div><h2>Leave requests</h2><p>Dates, duration, and reason before each decision</p></div></div>{pendingLeaves.length ? <TableShell><thead><tr><th>Employee</th><th>Leave</th><th>Dates</th><th>Reason</th><th>Decision</th></tr></thead><tbody>{pendingLeaves.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{item.type} · {item.days} day{item.days === 1 ? '' : 's'}</td><td>{formatDate(item.startDate)}–{formatDate(item.endDate)}</td><td>{item.reason}</td><td><div className="table-actions"><button className="mini-button approve" onClick={() => reviewLeave(item.id, 'Approved')}><Check />Approve</button><button className="mini-button reject" onClick={() => reviewLeave(item.id, 'Rejected')}><X />Reject</button></div></td></tr>)}</tbody></TableShell> : <EmptyState icon={CheckCircle2} title="No leave approvals" text="New leave requests will appear here." />}</section><section className="panel"><div className="panel-header"><div><h2>HR request queue</h2><p>Cross-functional requests with a shared conversation history</p></div></div>{requests.length ? <TableShell><thead><tr><th>Request</th><th>Employee</th><th>Type</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><strong>#{item.id} · {item.subject}</strong><small className="table-subtitle">{item.description}</small></td><td>{personName(data, item.employeeId)}</td><td>{item.type}</td><td><Badge tone={item.priority === 'Urgent' ? 'danger' : item.priority === 'High' ? 'warning' : 'neutral'}>{item.priority}</Badge></td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td><td><button className="text-button" onClick={() => { setSelectedId(item.id); setDecision(item.status === 'Submitted' ? 'Under Review' : item.status); setReason(item.decisionNote || '') }}>Review</button></td></tr>)}</tbody></TableShell> : <EmptyState icon={CheckCircle2} title="No HR request approvals" text="Employee requests will appear here." />}</section>{selected && <Modal title={`Review request #${selected.id}`} onClose={() => setSelectedId(null)} size="large"><div className="request-detail"><div className="request-detail-head"><div><span className="eyebrow">{selected.type} · {personName(data, selected.employeeId)}</span><h2>{selected.subject}</h2><p>{selected.description}</p></div><Badge tone={statusTone(selected.status)}>{selected.status}</Badge></div><dl className="detail-grid"><div><dt>Priority</dt><dd>{selected.priority}</dd></div><div><dt>Related date</dt><dd>{formatDate(selected.requestedDate)}</dd></div><div><dt>Requested value</dt><dd>{selected.requestedValue || '—'}</dd></div><div><dt>Submitted</dt><dd>{formatDateTime(selected.createdAt)}</dd></div></dl><div className="timeline">{comments.map((item) => <article key={item.id}><span>{item.internal ? 'IN' : 'HR'}</span><div><strong>{personName(data, item.authorId)}{item.internal ? ' · Internal note' : ''}</strong><p>{item.body}</p><time>{formatDateTime(item.createdAt)}</time></div></article>)}</div><form className="inline-response admin-response" onSubmit={addComment}><textarea rows="3" minLength="1" maxLength="1000" placeholder="Add a response or private handoff note…" value={comment} onChange={(event) => setComment(event.target.value)} required /><label className="check-label"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Internal note (hidden from employee)</label><button className="button button-secondary"><MessageSquareText />Add note</button></form><form className="decision-form" onSubmit={decide}><label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value)}><option>Under Review</option><option>More Information</option><option>Approved</option><option>Rejected</option><option>Completed</option></select></label><label>Decision reason<textarea rows="3" minLength={['More Information', 'Rejected'].includes(decision) ? 3 : 0} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain impact and the employee’s next step." required={['More Information', 'Rejected'].includes(decision)} /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setSelectedId(null)}>Cancel</button><button className="button button-primary">Save decision & notify</button></div></form></div></Modal>}</div>
}

function LifecycleOperations() {
  const { data, createLifecycleCase, updateLifecycleTask } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const defaultEmployee = data.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const [form, setForm] = useState(() => ({ employeeId: defaultEmployee, type: 'Onboarding', targetDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }))
  const activeCases = data.lifecycleCases.filter((item) => item.status === 'Active')
  const submit = async (event) => {
    event.preventDefault()
    try { await createLifecycleCase(form); setShowCreate(false) } catch { /* Keep form open. */ }
  }

  return <div className="page-stack"><SectionHeading eyebrow="Secure employee lifecycle" title="Onboarding & Offboarding" description="Coordinate people, assets, payroll, compliance, and access deactivation in one accountable checklist." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus />Start checklist</button>} /><div className="stats-grid stats-grid-3"><StatCard icon={UserRoundCheck} label="Active onboarding" value={activeCases.filter((item) => item.type === 'Onboarding').length} tone="blue" /><StatCard icon={Workflow} label="Active offboarding" value={activeCases.filter((item) => item.type === 'Offboarding').length} tone="amber" /><StatCard icon={CheckCircle2} label="Completed cases" value={data.lifecycleCases.filter((item) => item.status === 'Completed').length} tone="green" /></div><div className="lifecycle-grid">{data.lifecycleCases.map((item) => { const employee = data.employees.find((person) => person.id === item.employeeId); const tasks = data.lifecycleTasks.filter((task) => task.caseId === item.id); const done = tasks.filter((task) => task.status !== 'Pending').length; const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0; return <section className="panel lifecycle-card" key={item.id}><div className="lifecycle-card-head"><div><div className="inline-badges"><Badge tone={item.type === 'Offboarding' ? 'warning' : 'info'}>{item.type}</Badge><Badge tone={statusTone(item.status)}>{item.status}</Badge></div><h2>{employee ? `${employee.firstName} ${employee.lastName}` : item.employeeId}</h2><p>{item.employeeId} · Target {formatDate(item.targetDate)}</p></div><strong>{progress}%</strong></div><ProgressBar value={progress} label={`${done} of ${tasks.length} tasks resolved`} />{item.type === 'Offboarding' && item.status === 'Active' && <div className="impact-banner"><ShieldCheck /><p>Completing the final checklist task automatically changes the employee profile to Inactive, blocking HRMS access.</p></div>}<div className="checklist admin-checklist">{tasks.map((task) => <article key={task.id} className={task.status !== 'Pending' ? 'complete' : ''}><button className="task-toggle" aria-label={`Mark ${task.title} ${task.status === 'Pending' ? 'complete' : 'pending'}`} disabled={item.status !== 'Active'} onClick={() => updateLifecycleTask(task.id, task.status === 'Pending' ? 'Complete' : 'Pending')}>{task.status === 'Pending' ? <Clock3 /> : <CheckCircle2 />}</button><div><strong>{task.title}</strong><p>{task.category} · {task.employeeVisible ? 'Employee visible' : 'Internal'}</p></div><Badge tone={statusTone(task.status)}>{task.status}</Badge></article>)}</div></section> })}</div>{!data.lifecycleCases.length && <EmptyState icon={Workflow} title="No lifecycle cases" text="Start an onboarding or offboarding checklist for an employee." />}{showCreate && <Modal title="Start lifecycle checklist" onClose={() => setShowCreate(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Employee<select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.status}</option>)}</select></label><label>Case type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Onboarding</option><option>Offboarding</option></select></label><label>Target date<input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} required /></label>{form.type === 'Offboarding' && <div className="form-warning span-2"><ShieldCheck /><p>Access is not removed when the case starts. It is deactivated only after every clearance task is completed or skipped by an authorized HR administrator.</p></div>}<div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary">Create accountable checklist</button></div></form></Modal>}</div>
}

function PayrollOperations() {
  const { data, generatePayroll, transitionPayrollRun } = useHrms()
  const [showGenerate, setShowGenerate] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [pendingTransition, setPendingTransition] = useState(null)
  const [form, setForm] = useState({ period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), deductionRate: 8.25 })
  const selectedRun = data.payrollRuns.find((item) => item.id === selectedRunId) ?? data.payrollRuns[0]
  const records = selectedRun ? data.payroll.filter((item) => item.runId === selectedRun.id || (!item.runId && item.period === selectedRun.period)) : []

  const submit = async (event) => {
    event.preventDefault()
    try { await generatePayroll({ ...form, deductionRate: Number(form.deductionRate) }); setShowGenerate(false) } catch { /* Keep form open. */ }
  }
  const confirmTransition = async () => {
    if (!pendingTransition) return
    try { await transitionPayrollRun(pendingTransition.id, pendingTransition.next); setPendingTransition(null) } catch { /* Keep confirmation visible. */ }
  }

  return <div className="page-stack"><SectionHeading eyebrow="Controlled payroll workflow" title="Payroll Runs" description="Move each period through Draft → Validation → Approved → Released → Paid → Locked. Employees see a payslip only after release." actions={<button className="button button-primary" onClick={() => setShowGenerate(true)}><PhilippinePeso />Generate payroll</button>} /><div className="stats-grid stats-grid-3"><StatCard icon={PhilippinePeso} label="Latest net total" value={selectedRun ? formatMoney(selectedRun.netTotal) : '—'} tone="green" /><StatCard icon={Users} label="Employees in run" value={selectedRun?.employeeCount ?? 0} tone="blue" /><StatCard icon={ClipboardList} label="Current stage" value={selectedRun?.status ?? 'No run'} tone="amber" /></div><section className="panel payroll-pipeline"><div className="panel-header"><div><h2>Period controls</h2><p>Select a run and advance it one accountable step at a time.</p></div><select value={selectedRun?.id ?? ''} onChange={(event) => setSelectedRunId(Number(event.target.value))}>{data.payrollRuns.map((item) => <option key={item.id} value={item.id}>{item.period} · {item.status}</option>)}</select></div>{selectedRun ? <><div className="pipeline-track">{['Draft', 'Validation', 'Approved', 'Released', 'Paid', 'Locked'].map((stage, index, stages) => { const currentIndex = stages.indexOf(selectedRun.status); return <div key={stage} className={index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}><span>{index < currentIndex ? <Check /> : index + 1}</span><strong>{stage}</strong></div> })}</div><div className="pipeline-summary"><div><span>Gross total</span><strong>{formatMoney(selectedRun.grossTotal)}</strong></div><div><span>Net total</span><strong>{formatMoney(selectedRun.netTotal)}</strong></div><div><span>Deduction rate</span><strong>{selectedRun.deductionRate}%</strong></div>{payrollNext[selectedRun.status] ? <button className="button button-primary" onClick={() => setPendingTransition({ id: selectedRun.id, current: selectedRun.status, next: payrollNext[selectedRun.status], period: selectedRun.period })}>Advance to {payrollNext[selectedRun.status]}<ChevronRight /></button> : <Badge tone="neutral">Run locked</Badge>}</div></> : <EmptyState icon={PhilippinePeso} title="No payroll run" text="Generate the first payroll period to begin validation." />}</section><section className="panel"><div className="panel-header"><div><h2>Employee calculations</h2><p>Base pay, rewards, deductions, and net amount for the selected run</p></div></div>{records.length ? <TableShell><thead><tr><th>Employee</th><th>Base</th><th>Allowances</th><th>Bonuses</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead><tbody>{records.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{formatMoney(item.gross)}</td><td>{formatMoney(item.allowances)}</td><td>{formatMoney(item.bonuses)}</td><td>{formatMoney(item.deductions)}</td><td><strong>{formatMoney(item.net)}</strong></td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></TableShell> : <EmptyState icon={ClipboardList} title="No calculations in this run" text="Regenerate a draft to include active employees." />}</section>{showGenerate && <Modal title="Generate payroll draft" onClose={() => setShowGenerate(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Pay period<input value={form.period} maxLength="60" onChange={(event) => setForm({ ...form, period: event.target.value })} required /></label><label>Deduction rate (%)<input type="number" min="0" max="50" step="0.01" value={form.deductionRate} onChange={(event) => setForm({ ...form, deductionRate: event.target.value })} required /></label><label>Eligible employees<input value={`${data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').length} active employees`} disabled /></label><p className="form-note span-2">Regenerating an unlocked period returns it to Draft. Locked periods cannot be changed.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowGenerate(false)}>Cancel</button><button className="button button-primary">Generate secure draft</button></div></form></Modal>}{pendingTransition && <Modal title={`Advance ${pendingTransition.period}`} onClose={() => setPendingTransition(null)}><div className="confirmation-dialog"><span className="confirmation-icon"><ShieldCheck /></span><h3>{pendingTransition.current} → {pendingTransition.next}</h3><p>{payrollImpact(pendingTransition.next)}</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setPendingTransition(null)}>Cancel</button><button className="button button-primary" onClick={confirmTransition}>Confirm transition</button></div></div></Modal>}</div>
}

function payrollImpact(status) {
  const impacts = {
    Validation: 'The draft becomes the official validation set. Review employee counts and totals before approving.',
    Approved: 'This records the approving administrator and timestamp. Payslips remain hidden from employees.',
    Released: 'This immediately makes each employee’s own payslip visible and sends a notification.',
    Paid: 'This records the payment date for every employee calculation in the run.',
    Locked: 'This makes the period final. A locked payroll run cannot be regenerated or advanced further.',
  }
  return impacts[status]
}

function PerformanceOperations() {
  const { data, savePerformance, publishPerformance, createPerformanceCycle, saveGoal } = useHrms()
  const [reviewForm, setReviewForm] = useState(null)
  const [showCycle, setShowCycle] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const defaultEmployee = data.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const defaultCycle = data.performanceCycles.find((item) => item.status === 'Active')
  const [cycleForm, setCycleForm] = useState({ title: 'Quarterly Performance Cycle', period: `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`, status: 'Active', startDate: '', endDate: '' })
  const [goalForm, setGoalForm] = useState({ employeeId: defaultEmployee, title: '', description: '', category: 'Growth', progress: 0, status: 'Active', dueDate: '' })

  const openReview = (review) => setReviewForm(review ? { ...review } : { employeeId: defaultEmployee, cycleId: defaultCycle?.id ?? '', period: defaultCycle?.period ?? `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`, score: 80, goalProgress: 80, quality: 80, productivity: 80, teamwork: 80, comments: '' })
  const submitReview = async (event) => {
    event.preventDefault()
    const score = Number(reviewForm.score)
    const rating = score >= 90 ? 'Outstanding' : score >= 80 ? 'Exceeds expectations' : score >= 70 ? 'Meets expectations' : 'Needs improvement'
    try { await savePerformance({ ...reviewForm, rating }); setReviewForm(null) } catch { /* Keep form open. */ }
  }
  const submitCycle = async (event) => { event.preventDefault(); try { await createPerformanceCycle(cycleForm); setShowCycle(false) } catch { /* Keep form open. */ } }
  const submitGoal = async (event) => { event.preventDefault(); try { await saveGoal(goalForm); setShowGoal(false); setGoalForm({ ...goalForm, title: '', description: '', progress: 0, dueDate: '' }) } catch { /* Keep form open. */ } }

  return <div className="page-stack"><SectionHeading eyebrow="Draft before disclosure" title="Performance & Growth" description="Run review cycles, save private drafts, publish intentionally, and maintain employee goals." actions={<><button className="button button-secondary" onClick={() => setShowCycle(true)}><CalendarDays />New cycle</button><button className="button button-secondary" onClick={() => setShowGoal(true)}><Target />Add goal</button><button className="button button-primary" onClick={() => openReview()}><Plus />New review</button></>} /><div className="stats-grid stats-grid-3"><StatCard icon={CalendarCheck} label="Active cycles" value={data.performanceCycles.filter((item) => item.status === 'Active').length} tone="blue" /><StatCard icon={FileText} label="Draft reviews" value={data.performance.filter((item) => item.status === 'Draft').length} tone="amber" /><StatCard icon={TrendingUp} label="Active goals" value={data.goals.filter((item) => item.status === 'Active').length} tone="green" /></div><section className="panel"><div className="panel-header"><div><h2>Review records</h2><p>Employees retrieve only Published records through RLS.</p></div></div>{data.performance.length ? <TableShell><thead><tr><th>Employee</th><th>Period</th><th>Score</th><th>Goal progress</th><th>Rating</th><th>Status / Action</th></tr></thead><tbody>{data.performance.map((review) => <tr key={review.id}><td><strong>{personName(data, review.employeeId)}</strong><small className="table-subtitle">{review.employeeId}</small></td><td>{review.period}</td><td><strong>{review.score}/100</strong></td><td>{review.goalProgress}%</td><td>{review.rating}</td><td><div className="table-actions"><Badge tone={statusTone(review.status)}>{review.status}</Badge><button className="mini-button" onClick={() => openReview(review)}>Edit</button>{review.status === 'Draft' && <button className="mini-button approve" onClick={() => publishPerformance(review.id)}><Check />Publish</button>}</div></td></tr>)}</tbody></TableShell> : <EmptyState icon={Star} title="No performance reviews" text="Create a draft, review it, then publish it to the employee." />}</section><section className="panel"><div className="panel-header"><div><h2>Employee goals</h2><p>Shared progress values for coaching conversations</p></div></div><div className="goal-admin-grid">{data.goals.map((goal) => <article key={goal.id}><div><Badge tone={statusTone(goal.status)}>{goal.status}</Badge><h3>{goal.title}</h3><p>{personName(data, goal.employeeId)} · {goal.category} · Due {formatDate(goal.dueDate)}</p></div><strong>{goal.progress}%</strong><ProgressBar value={goal.progress} label="Progress" /></article>)}</div></section>{reviewForm && <Modal title="Save performance review draft" onClose={() => setReviewForm(null)} size="large"><form className="form-grid" onSubmit={submitReview}><label>Employee<select value={reviewForm.employeeId} onChange={(event) => setReviewForm({ ...reviewForm, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><label>Cycle<select value={reviewForm.cycleId ?? ''} onChange={(event) => { const cycle = data.performanceCycles.find((item) => item.id === Number(event.target.value)); setReviewForm({ ...reviewForm, cycleId: event.target.value, period: cycle?.period ?? reviewForm.period }) }}><option value="">No cycle</option>{data.performanceCycles.map((item) => <option value={item.id} key={item.id}>{item.period} · {item.status}</option>)}</select></label><label className="span-2">Review period<input value={reviewForm.period} onChange={(event) => setReviewForm({ ...reviewForm, period: event.target.value })} required /></label>{[['score', 'Overall score'], ['goalProgress', 'Goal progress'], ['quality', 'Quality'], ['productivity', 'Productivity'], ['teamwork', 'Teamwork']].map(([key, label]) => <label key={key}>{label}<input type="number" min="0" max="100" value={reviewForm[key]} onChange={(event) => setReviewForm({ ...reviewForm, [key]: Number(event.target.value) })} required /></label>)}<label className="span-2">Comments<textarea rows="4" maxLength="1000" value={reviewForm.comments} onChange={(event) => setReviewForm({ ...reviewForm, comments: event.target.value })} /></label><p className="form-note span-2">Saving creates a private draft. Use Publish only after the review is complete and approved for employee disclosure.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setReviewForm(null)}>Cancel</button><button className="button button-primary">Save private draft</button></div></form></Modal>}{showCycle && <Modal title="Create performance cycle" onClose={() => setShowCycle(false)}><form className="form-grid" onSubmit={submitCycle}><label className="span-2">Cycle title<input value={cycleForm.title} onChange={(event) => setCycleForm({ ...cycleForm, title: event.target.value })} required /></label><label>Period label<input value={cycleForm.period} onChange={(event) => setCycleForm({ ...cycleForm, period: event.target.value })} required /></label><label>Status<select value={cycleForm.status} onChange={(event) => setCycleForm({ ...cycleForm, status: event.target.value })}><option>Draft</option><option>Active</option><option>Review</option><option>Closed</option></select></label><label>Start date<input type="date" value={cycleForm.startDate} onChange={(event) => setCycleForm({ ...cycleForm, startDate: event.target.value })} /></label><label>End date<input type="date" value={cycleForm.endDate} onChange={(event) => setCycleForm({ ...cycleForm, endDate: event.target.value })} /></label><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowCycle(false)}>Cancel</button><button className="button button-primary">Create cycle</button></div></form></Modal>}{showGoal && <Modal title="Assign employee goal" onClose={() => setShowGoal(false)}><form className="form-grid" onSubmit={submitGoal}><label className="span-2">Employee<select value={goalForm.employeeId} onChange={(event) => setGoalForm({ ...goalForm, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><label className="span-2">Goal title<input value={goalForm.title} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} required /></label><label>Category<input value={goalForm.category} onChange={(event) => setGoalForm({ ...goalForm, category: event.target.value })} required /></label><label>Due date<input type="date" value={goalForm.dueDate} onChange={(event) => setGoalForm({ ...goalForm, dueDate: event.target.value })} required /></label><label className="span-2">Description<textarea rows="4" value={goalForm.description} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} /></label><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowGoal(false)}>Cancel</button><button className="button button-primary">Assign goal</button></div></form></Modal>}</div>
}

function DocumentOperations() {
  const { data, createDocument } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ employeeId: '', title: '', type: 'Policy', period: `${new Date().getFullYear()}`, content: '', filename: '', version: '1.0', requiresAck: true, sensitive: false, expiresOn: '' })
  const acknowledgedPairs = new Set(data.documentAcknowledgements.map((item) => `${item.documentId}:${item.employeeId}`))
  const activeEmployees = data.employees.filter((item) => item.role === 'employee' && item.status !== 'Inactive')
  const requiredCount = data.documents.reduce((count, document) => {
    if (!document.requiresAck) return count
    const targets = document.employeeId ? [document.employeeId] : activeEmployees.map((item) => item.id)
    return count + targets.filter((employeeId) => !acknowledgedPairs.has(`${document.id}:${employeeId}`)).length
  }, 0)
  const submit = async (event) => {
    event.preventDefault()
    try { await createDocument(form); setShowCreate(false); setForm({ ...form, title: '', content: '', filename: '', employeeId: '' }) } catch { /* Keep form open. */ }
  }

  return <div className="page-stack"><SectionHeading eyebrow="Policy lifecycle" title="Documents & Acknowledgements" description="Publish organization policies or employee-specific records and monitor acknowledgement completion." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus />Publish document</button>} /><div className="stats-grid stats-grid-3"><StatCard icon={FileText} label="Documents" value={data.documents.length} tone="blue" /><StatCard icon={BookOpenCheckIcon} label="Acknowledgements due" value={requiredCount} tone="amber" /><StatCard icon={ShieldCheck} label="Sensitive documents" value={data.documents.filter((item) => item.sensitive).length} tone="purple" /></div><section className="panel"><div className="panel-header"><div><h2>Document register</h2><p>Audience, version, sensitivity, and acknowledgement status</p></div></div>{data.documents.length ? <TableShell><thead><tr><th>Document</th><th>Audience</th><th>Version</th><th>Added</th><th>Acknowledgement</th><th>Classification</th></tr></thead><tbody>{data.documents.map((item) => { const targets = item.employeeId ? [item.employeeId] : activeEmployees.map((employee) => employee.id); const acknowledged = targets.filter((employeeId) => acknowledgedPairs.has(`${item.id}:${employeeId}`)).length; return <tr key={item.id}><td><strong>{item.title}</strong><small className="table-subtitle">{item.type} · {item.filename}</small></td><td>{item.employeeId ? personName(data, item.employeeId) : 'All active employees'}</td><td>{item.version}</td><td>{formatDateTime(item.createdAt)}</td><td>{item.requiresAck ? <Badge tone={acknowledged === targets.length ? 'success' : 'warning'}>{acknowledged}/{targets.length} acknowledged</Badge> : <Badge tone="neutral">Not required</Badge>}</td><td><Badge tone={item.sensitive ? 'warning' : 'info'}>{item.sensitive ? 'Sensitive' : 'Standard'}</Badge></td></tr> })}</tbody></TableShell> : <EmptyState icon={FolderLock} title="No documents" text="Publish a policy or employee record to begin." />}</section>{showCreate && <Modal title="Publish HR document" onClose={() => setShowCreate(false)} size="large"><form className="form-grid" onSubmit={submit}><label>Audience<select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}><option value="">All active employees</option>{activeEmployees.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><label>Document type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{['Policy', 'Payslip', 'Certificate', 'Contract', 'Memo', 'Tax', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="span-2">Title<input minLength="3" maxLength="160" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Filename<input placeholder="example-policy.txt" value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} required /></label><label>Version<input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} required /></label><label>Period<input value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} /></label><label>Expiry (optional)<input type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /></label><label className="span-2">Document text<textarea rows="7" minLength="3" maxLength="10000" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label><div className="check-row span-2"><label><input type="checkbox" checked={form.requiresAck} onChange={(event) => setForm({ ...form, requiresAck: event.target.checked })} />Require employee acknowledgement</label><label><input type="checkbox" checked={form.sensitive} onChange={(event) => setForm({ ...form, sensitive: event.target.checked })} />Sensitive employee record</label></div><p className="form-note span-2">The content and metadata are stored in Supabase. The employee download is generated only after an authorized RLS-protected read.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary">Publish & notify</button></div></form></Modal>}</div>
}

function BookOpenCheckIcon(props) {
  return <FileCheck2 {...props} />
}

function AnalyticsReports() {
  const { data, recordActivity } = useHrms()
  const reports = [
    { id: 'workforce', title: 'Workforce directory', text: 'Employment status, department, role, and hire date.', icon: Users },
    { id: 'attendance', title: 'Attendance register', text: 'Dates, clock events, recorded hours, and exceptions.', icon: CalendarClock },
    { id: 'requests', title: 'Request decisions', text: 'Leave and HR request status for operational review.', icon: ClipboardCheck },
    { id: 'payroll', title: 'Payroll control totals', text: 'Authorized run stages, headcount, and aggregate totals.', icon: PhilippinePeso },
    { id: 'audit', title: 'Security audit trail', text: 'Authenticated sensitive actions and affected records.', icon: ShieldCheck },
  ]

  const generate = async (id, title) => {
    let rows
    let columns
    if (id === 'workforce') {
      rows = data.employees
      columns = [{ label: 'Employee ID', key: 'id' }, { label: 'First name', key: 'firstName' }, { label: 'Last name', key: 'lastName' }, { label: 'Department', key: 'department' }, { label: 'Position', key: 'position' }, { label: 'Role', key: 'role' }, { label: 'Status', key: 'status' }, { label: 'Hire date', key: 'hireDate' }]
    } else if (id === 'attendance') {
      rows = data.attendance
      columns = [{ label: 'Employee ID', key: 'employeeId' }, { label: 'Date', key: 'date' }, { label: 'Clock in', key: 'clockIn' }, { label: 'Clock out', key: 'clockOut' }, { label: 'Hours', key: 'hours' }, { label: 'Status', key: 'status' }]
    } else if (id === 'requests') {
      rows = data.employeeRequests
      columns = [{ label: 'Request ID', key: 'id' }, { label: 'Employee ID', key: 'employeeId' }, { label: 'Type', key: 'type' }, { label: 'Subject', key: 'subject' }, { label: 'Priority', key: 'priority' }, { label: 'Status', key: 'status' }, { label: 'Decision note', key: 'decisionNote' }, { label: 'Submitted', key: 'createdAt' }]
    } else if (id === 'payroll') {
      rows = data.payrollRuns
      columns = [{ label: 'Period', key: 'period' }, { label: 'Stage', key: 'status' }, { label: 'Employee count', key: 'employeeCount' }, { label: 'Gross total', key: 'grossTotal' }, { label: 'Net total', key: 'netTotal' }, { label: 'Approved by', key: 'approvedBy' }, { label: 'Released at', key: 'releasedAt' }]
    } else {
      rows = data.auditLog
      columns = [{ label: 'Actor', key: 'actor' }, { label: 'Action', key: 'action' }, { label: 'Target', key: 'target' }, { label: 'Time', key: 'time' }]
    }
    downloadCsv(title.toLowerCase().replaceAll(' ', '-'), columns, rows)
    try { await recordActivity({ action: 'Exported authorized HR report', target: title }) } catch { /* Download succeeded; toast reports audit issue. */ }
  }

  const departments = [...new Set(data.employees.map((item) => item.department))]
  const completedRequests = data.employeeRequests.filter((item) => ['Approved', 'Rejected', 'Completed'].includes(item.status)).length
  const decisionRate = data.employeeRequests.length ? Math.round((completedRequests / data.employeeRequests.length) * 100) : 100

  const maxDepartment = Math.max(1, ...departments.map((department) => data.employees.filter((item) => item.department === department && item.status === 'Active').length))
  return <div className="page-stack"><SectionHeading eyebrow="Decision-ready evidence" title="Analytics & Reports" description="Export authorized fictional records and review operational indicators. Every export is added to the audit trail." /><div className="stats-grid stats-grid-3"><StatCard icon={Users} label="Workforce records" value={data.employees.length} tone="blue" /><StatCard icon={ClipboardCheck} label="Request decision rate" value={`${decisionRate}%`} tone="green" /><StatCard icon={ShieldCheck} label="Audit events" value={data.auditLog.length} tone="purple" /></div><div className="content-grid dashboard-grid"><section className="panel"><div className="panel-header"><div><h2>Workforce distribution</h2><p>Active people by department</p></div></div><div className="bar-chart">{departments.map((department) => { const count = data.employees.filter((item) => item.department === department && item.status === 'Active').length; return <div key={department}><span>{department}</span><progress value={count} max={maxDepartment}>{count}</progress><strong>{count}</strong></div> })}</div></section><section className="panel"><div className="panel-header"><div><h2>Governance snapshot</h2><p>Controls that require administrator attention</p></div></div><div className="governance-list"><article><span><FileCheck2 /></span><div><strong>{data.employeeRequests.filter((item) => openRequestStatuses.includes(item.status)).length} open HR requests</strong><p>Awaiting review, information, or completion</p></div></article><article><span><FolderLock /></span><div><strong>{data.documents.filter((item) => item.requiresAck).length} acknowledgement policies</strong><p>Tracked per employee in Supabase</p></div></article><article><span><ShieldCheck /></span><div><strong>{data.securityAlerts.filter((item) => item.status !== 'Resolved').length} open security alerts</strong><p>Prioritized by plain-language impact</p></div></article></div></section></div><section className="report-grid premium-report-grid">{reports.map(({ id, title, text, icon: Icon }) => <article className="panel report-card" key={id}><span><Icon /></span><h2>{title}</h2><p>{text}</p><button className="button button-secondary" onClick={() => generate(id, title)}><Download size={17} />Download CSV</button></article>)}</section></div>
}

function Communications() {
  const { data, addAnnouncement } = useHrms()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', priority: 'Normal' })
  const submit = async (event) => {
    event.preventDefault()
    try { await addAnnouncement(form); setShowAdd(false); setForm({ title: '', content: '', priority: 'Normal' }) } catch { /* Keep form open. */ }
  }

  return <div className="page-stack"><SectionHeading eyebrow="Clear organization updates" title="Communications" description="Publish concise announcements that also create employee notifications." actions={<button className="button button-primary" onClick={() => setShowAdd(true)}><Plus />New announcement</button>} /><div className="announcement-grid">{data.announcements.map((item) => <article className="panel announcement-card" key={item.id}><div><Badge tone={item.priority === 'High' ? 'warning' : 'info'}>{item.priority}</Badge><time>{formatDate(item.date)}</time></div><h2>{item.title}</h2><p>{item.content}</p></article>)}</div>{!data.announcements.length && <EmptyState icon={BellRing} title="No announcements" text="Publish the first organization update." />}{showAdd && <Modal title="Publish announcement" onClose={() => setShowAdd(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Title<input minLength="3" maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label className="span-2">Message<textarea rows="5" minLength="3" maxLength="1000" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Normal</option><option>High</option></select></label><p className="form-note span-2">Publishing inserts an announcement and creates a notification for every active employee.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="button button-primary">Publish & notify</button></div></form></Modal>}</div>
}
