import { useEffect, useState } from 'react'
import { Activity, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, ShieldCheck, Users } from 'lucide-react'
import { Badge, EmptyState, StatCard } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate } from '../utils/format.js'
import type { HrmsSnapshot } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminActionCenter({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { data, user } = useHrms()
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!data || !user) return null

  const activeEmployees = data.employees.filter((employee) => employee.status === 'Active' && employee.role === 'employee').length
  const pendingLeaves = data.leaveRequests.filter((request) => request.status === 'Pending')
  const openRequests = data.employeeRequests.filter((request) => openRequestStatuses.includes(request.status))
  const openAlerts = data.securityAlerts.filter((alert) => alert.status !== 'Resolved')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(currentTime)
  const missingClockOut = data.attendance.filter((item) => item.date === today && item.clockIn && !item.clockOut)
  const approvals = pendingLeaves.length + openRequests.length
  const liveDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(currentTime)
  const liveTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(currentTime)

  return <div className="page-stack admin-dashboard">
    <section className="admin-command-hero"><div className="admin-command-copy"><div className="command-status"><i /><span>Live operations</span></div><span className="eyebrow">HR operations center</span><h1>Good day, {user.firstName}.</h1><p>One operational view across your people, approvals, attendance, and security posture.</p><div className="command-hero-meta" aria-label={`Current Philippine date and time: ${liveDate}, ${liveTime}`}><span><CalendarDays />{liveDate}</span><span><Clock3 /><time dateTime={currentTime.toISOString()}>{liveTime}</time><small>PHT</small></span></div></div><div className="admin-command-actions"><div className="command-readiness"><ShieldCheck /><span><small>Security readiness</small><strong>{openAlerts.length ? `${openAlerts.length} alerts to review` : 'All controls healthy'}</strong></span></div><button className="button button-primary" onClick={() => onNavigate('approvals')}><ClipboardCheck />Review {approvals} approvals</button><button className="button command-secondary" onClick={() => onNavigate('security')}><ShieldCheck />Open security center</button></div></section>
    <div className="stats-grid stats-grid-4 admin-metric-grid"><StatCard icon={Users} label="Active workforce" value={activeEmployees} detail={`${data.employees.length} total people records`} tone="blue" /><StatCard icon={ClipboardCheck} label="Decisions waiting" value={approvals} detail={`${pendingLeaves.length} leave · ${openRequests.length} HR cases`} tone="amber" /><StatCard icon={CalendarClock} label="Time exceptions" value={missingClockOut.length} detail="Clocked in with no clock-out" tone="purple" /><StatCard icon={ShieldCheck} label="Security exposure" value={openAlerts.length} detail={`${openAlerts.filter((item) => item.severity === 'Critical').length} critical findings`} tone="red" /></div>
    <div className="content-grid dashboard-grid admin-overview-grid"><section className="panel admin-priority-panel"><div className="panel-header"><div><span className="panel-kicker">Decision workspace</span><h2>Priority work queue</h2><p>Ranked by impact, urgency, and employee need.</p></div><Badge tone={approvals + openAlerts.length ? 'warning' : 'success'}>{approvals + openAlerts.length} open</Badge></div><div className="admin-action-queue">{pendingLeaves.slice(0, 2).map((item) => <button key={`leave-${item.id}`} onClick={() => onNavigate('approvals')}><span className="queue-priority warning">Leave</span><div><strong>{personName(data, item.employeeId)} requested {item.type.toLowerCase()} leave</strong><p>{formatDate(item.startDate)}–{formatDate(item.endDate)} · {item.days} day{item.days === 1 ? '' : 's'}</p></div><ChevronRight /></button>)}{openRequests.slice(0, 3).map((item) => <button key={`request-${item.id}`} onClick={() => onNavigate('approvals')}><span className={`queue-priority ${item.priority === 'Urgent' ? 'danger' : 'info'}`}>{item.priority}</span><div><strong>{item.subject}</strong><p>{personName(data, item.employeeId)} · {item.type} · {item.status}</p></div><ChevronRight /></button>)}{openAlerts.slice(0, 2).map((item) => <button key={`alert-${item.id}`} onClick={() => onNavigate('security')}><span className={`queue-priority ${item.severity === 'Critical' ? 'danger' : 'warning'}`}>{item.severity}</span><div><strong>{item.title}</strong><p>{item.affected} · {item.recommendedAction}</p></div><ChevronRight /></button>)}{!approvals && !openAlerts.length && <EmptyState icon={CheckCircle2} title="Operations are clear" text="New approval, exception, and security work will appear here." />}</div></section><section className="panel admin-workforce-panel"><div className="panel-header"><div><span className="panel-kicker">Organization signal</span><h2>Workforce coverage</h2><p>Active people by department</p></div><Badge tone="success">Realtime</Badge></div><div className="bar-chart">{[...new Set(data.employees.map((employee) => employee.department))].map((department) => { const count = data.employees.filter((employee) => employee.department === department && employee.status === 'Active').length; return <div key={department}><span>{department}</span><progress value={count} max={Math.max(activeEmployees, 1)}>{count}</progress><strong>{count}</strong></div> })}</div></section></div>
    <section className="panel admin-audit-panel"><div className="panel-header"><div><span className="panel-kicker">Protected evidence</span><h2>Recent sensitive activity</h2><p>Authenticated database actions preserved for review.</p></div><button className="text-button" onClick={() => onNavigate('analytics')}>Open audit reports</button></div><div className="activity-feed">{data.auditLog.slice(0, 8).map((entry) => <article key={entry.id}><span><Activity /></span><div><strong>{entry.action}</strong><p>{entry.actor} · {entry.target}</p></div><time>{entry.time}</time></article>)}</div></section>
  </div>
}
