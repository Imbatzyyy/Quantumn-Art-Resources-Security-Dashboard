import AdminSecurityOverview from './AdminSecurityOverview.js'
import { isOpenSecurityAlert, isUnclosedPastShift, securitySeverityOrder, businessDate } from '../utils/securityMetrics.js'
import { Activity, CalendarClock, CalendarHeart, CalendarOff, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, PartyPopper, PhilippinePeso, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { Badge, EmptyState, SectionHeading, StatCard } from '../components/ui.js'
import { BarList } from '../components/charts.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateLong, formatMoney, greetingFor, statusTone } from '../utils/format.js'
import { upcomingHolidays } from '../utils/holidays.js'
import type { HrmsSnapshot } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const payrollStages = ['Draft', 'Validation', 'Approved', 'Released', 'Paid', 'Locked']
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.preferredName || employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminActionCenter({ onNavigate, allowedPages }: { onNavigate: (target: string) => void; allowedPages: readonly string[] }) {
  const { data, user } = useHrms()
  if (!data || !user) return null
  const can = (page: string) => allowedPages.includes(page)
  const today = businessDate()
  const now = new Date()
  const thisMonth = today.slice(0, 7)
  const employees = data.employees.filter((employee) => employee.role === 'employee')
  const activeEmployees = employees.filter((employee) => employee.status === 'Active')
  const pendingLeaves = data.leaveRequests.filter((request) => request.status === 'Pending')
  const openRequests = data.employeeRequests.filter((request) => openRequestStatuses.includes(request.status))
  const openAlerts = data.securityAlerts.filter((alert) => isOpenSecurityAlert(alert.status)).sort((a, b) => securitySeverityOrder(a.severity) - securitySeverityOrder(b.severity))
  const approvals = pendingLeaves.length + openRequests.length
  const outToday = data.leaveRequests.filter((request) => request.status === 'Approved' && request.startDate <= today && request.endDate >= today)
  const scheduledToday = data.schedules.filter((item) => item.date === today && item.workMode !== 'Rest Day')
  const clockedToday = data.attendance.filter((item) => item.date === today && item.clockIn)
  const missingClockOut = data.attendance.filter((item) => isUnclosedPastShift(item, now))
  const lateToday = clockedToday.filter((item) => item.status === 'Late')
  const newHires = employees.filter((employee) => employee.hireDate && employee.hireDate >= new Date(new Date(`${today}T00:00:00Z`).getTime() - 30 * 86_400_000).toISOString().slice(0, 10)).sort((a, b) => (b.hireDate ?? '').localeCompare(a.hireDate ?? ''))
  const anniversaries = activeEmployees.filter((employee) => employee.hireDate && employee.hireDate.slice(5, 7) === thisMonth.slice(5, 7) && employee.hireDate.slice(0, 4) < thisMonth.slice(0, 4))
  const holidays = upcomingHolidays(today, 2)
  const latestRun = data.payrollRuns[0]
  const departments = [...new Set(activeEmployees.map((employee) => employee.department))]
    .map((department) => ({ label: department, value: activeEmployees.filter((employee) => employee.department === department).length }))
    .sort((left, right) => right.value - left.value)
  const securityFirst = ['security_admin', 'auditor'].includes(user.role ?? '')
  const showSecurity = can('security')
  const queue = [
    ...(can('approvals') ? pendingLeaves.slice(0, 3).map((item) => ({ key: `leave-${item.id}`, tone: 'warning', tag: 'Leave', title: `${personName(data, item.employeeId)} requested ${item.type.toLowerCase()} leave`, detail: `${formatDate(item.startDate)} – ${formatDate(item.endDate)} · ${item.days} day${item.days === 1 ? '' : 's'}`, target: 'approvals?view=leave' })) : []),
    ...(can('approvals') ? openRequests.slice(0, 3).map((item) => ({ key: `request-${item.id}`, tone: item.priority === 'Urgent' ? 'danger' : 'info', tag: item.priority === 'Normal' ? 'Request' : item.priority, title: item.subject, detail: `${personName(data, item.employeeId)} · ${item.type} · ${item.status}`, target: `approvals?request=${encodeURIComponent(item.id)}` })) : []),
    ...(showSecurity ? openAlerts.slice(0, 2).map((item) => ({ key: `alert-${item.id}`, tone: item.severity === 'Critical' ? 'danger' : 'warning', tag: item.severity, title: item.title, detail: item.affected, target: 'security?tab=alerts' })) : []),
  ]
  const stageIndex = latestRun ? payrollStages.indexOf(latestRun.status) : -1

  const securityBlock = showSecurity && <AdminSecurityOverview onNavigate={onNavigate} />

  return <div className="page-stack admin-dashboard">
    <SectionHeading
      title={`${greetingFor(now)}, ${user.preferredName || user.firstName}`}
      description={formatDateLong(today)}
      actions={<>
        {can('people') && <button className="button button-secondary" onClick={() => onNavigate('people?new=1')}><UserPlus aria-hidden="true" />Add employee</button>}
        {can('approvals') && <button className="button button-primary" onClick={() => onNavigate('approvals')}><ClipboardCheck aria-hidden="true" />{approvals ? `Review ${approvals} ${approvals === 1 ? 'approval' : 'approvals'}` : 'Approvals'}</button>}
      </>}
    />

    {securityFirst && securityBlock}

    {(can('people') || can('time') || can('approvals')) && <div className="stats-grid stats-grid-4">
      {can('people') && <StatCard icon={Users} label="Active employees" value={activeEmployees.length} detail={newHires.length ? `${newHires.length} joined in the last 30 days` : `${departments.length} department${departments.length === 1 ? '' : 's'}`} tone="blue" onClick={() => onNavigate('people')} />}
      {can('approvals') && <StatCard icon={ClipboardCheck} label="Waiting for approval" value={approvals} detail={`${pendingLeaves.length} leave · ${openRequests.length} HR request${openRequests.length === 1 ? '' : 's'}`} tone="amber" onClick={() => onNavigate('approvals')} />}
      {can('time') && <StatCard icon={Clock3} label="Clocked in today" value={scheduledToday.length ? `${clockedToday.length} of ${scheduledToday.length}` : clockedToday.length} detail={lateToday.length ? `${lateToday.length} late arrival${lateToday.length === 1 ? '' : 's'}` : scheduledToday.length ? 'Scheduled shifts today' : 'No shifts scheduled today'} tone="green" onClick={() => onNavigate('time')} />}
      {can('people') && <StatCard icon={CalendarOff} label="On leave today" value={outToday.length} detail={outToday.length ? outToday.slice(0, 2).map((item) => personName(data, item.employeeId).split(' ')[0]).join(', ') + (outToday.length > 2 ? ` +${outToday.length - 2}` : '') : 'Everyone is in'} tone="purple" onClick={() => onNavigate('approvals?view=history')} />}
    </div>}

    <div className="content-grid dashboard-grid">
      <section className="panel" aria-labelledby="queue-title">
        <div className="panel-header"><div><h2 id="queue-title">Priority work</h2><p>The oldest and most urgent items first</p></div><Badge tone={queue.length ? 'warning' : 'success'}>{queue.length ? `${approvals + (showSecurity ? openAlerts.length : 0)} open` : 'All clear'}</Badge></div>
        <div className="action-list">
          {queue.map((item) => <button key={item.key} onClick={() => onNavigate(item.target)}><span className={`queue-tag tone-${item.tone}`}>{item.tag}</span><span className="action-text"><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight aria-hidden="true" /></button>)}
          {!queue.length && <EmptyState compact icon={CheckCircle2} title="Nothing waiting" text="New leave requests, HR requests, and alerts will appear here." />}
        </div>
      </section>

      <div className="side-stack">
        {can('people') && <section className="panel" aria-labelledby="out-title">
          <div className="panel-header"><div><h2 id="out-title">Who’s out today</h2></div><CalendarOff className="panel-header-icon" aria-hidden="true" /></div>
          {outToday.length ? <ul className="people-list">{outToday.map((item) => <li key={item.id}><span><strong>{personName(data, item.employeeId)}</strong><small>{item.type} leave · back {formatDate(new Date(new Date(`${item.endDate}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10))}</small></span></li>)}</ul> : <p className="panel-empty-line">No one is on approved leave today.</p>}
        </section>}

        <section className="panel" aria-labelledby="upcoming-title">
          <div className="panel-header"><div><h2 id="upcoming-title">Coming up</h2></div><CalendarHeart className="panel-header-icon" aria-hidden="true" /></div>
          <ul className="people-list">
            {can('people') && newHires.slice(0, 3).map((employee) => <li key={`hire-${employee.id}`}><span className="people-list-icon tone-green"><UserPlus aria-hidden="true" /></span><span><strong>{employee.preferredName || employee.firstName} {employee.lastName}</strong><small>{employee.hireDate! > today ? 'Starts' : 'Joined'} {formatDate(employee.hireDate)} · {employee.position}</small></span></li>)}
            {can('people') && anniversaries.slice(0, 3).map((employee) => { const years = Number(thisMonth.slice(0, 4)) - Number(employee.hireDate!.slice(0, 4)); return <li key={`anniversary-${employee.id}`}><span className="people-list-icon tone-purple"><PartyPopper aria-hidden="true" /></span><span><strong>{employee.preferredName || employee.firstName} {employee.lastName}</strong><small>{years} year{years === 1 ? '' : 's'} on {formatDate(`${thisMonth}-${employee.hireDate!.slice(8, 10)}`)}</small></span></li> })}
            {holidays.map((holiday) => <li key={holiday.date}><span className="people-list-icon tone-blue"><CalendarHeart aria-hidden="true" /></span><span><strong>{holiday.name}</strong><small>{formatDate(holiday.date)} · {holiday.kind}</small></span></li>)}
          </ul>
        </section>
      </div>
    </div>

    <div className="content-grid content-grid-3">
      {can('people') && <section className="panel" aria-labelledby="dept-title">
        <div className="panel-header"><div><h2 id="dept-title">Headcount by department</h2><p>Active employees</p></div><button type="button" className="text-button" onClick={() => onNavigate('analytics')}>Reports</button></div>
        <div className="panel-body"><BarList label="Active employees by department" data={departments} empty="No active employees yet." /></div>
      </section>}

      {can('payroll') && <section className="panel" aria-labelledby="payroll-title">
        <div className="panel-header"><div><h2 id="payroll-title">Payroll</h2><p>{latestRun ? latestRun.period : 'No payroll run yet'}</p></div>{latestRun && <Badge tone={statusTone(latestRun.status)}>{latestRun.status}</Badge>}</div>
        <div className="panel-body">
          {latestRun ? <>
            <ol className="mini-stages" aria-label="Payroll stages">{payrollStages.map((stage, index) => <li key={stage} className={index < stageIndex ? 'is-done' : index === stageIndex ? 'is-current' : undefined}><span className="sr-only">{index < stageIndex ? 'Done: ' : index === stageIndex ? 'Current: ' : ''}</span>{stage}</li>)}</ol>
            <dl className="key-values"><div><dt>Employees</dt><dd>{latestRun.employeeCount}</dd></div><div><dt>Net total</dt><dd>{formatMoney(latestRun.netTotal)}</dd></div></dl>
            <button type="button" className="button button-secondary button-small" onClick={() => onNavigate('payroll')}><PhilippinePeso aria-hidden="true" />Open payroll</button>
          </> : <EmptyState compact icon={PhilippinePeso} title="No payroll run yet" text="Generate the first pay period to start." action={<button type="button" className="button button-secondary button-small" onClick={() => onNavigate('payroll')}>Open payroll</button>} />}
        </div>
      </section>}

      {can('time') && <section className="panel" aria-labelledby="exceptions-title">
        <div className="panel-header"><div><h2 id="exceptions-title">Time exceptions</h2><p>Records that need a closer look</p></div><CalendarClock className="panel-header-icon" aria-hidden="true" /></div>
        <dl className="key-values key-values-list">
          <div><dt>Missing clock-out (over 24 hours)</dt><dd>{missingClockOut.length}</dd></div>
          <div><dt>Late arrivals today</dt><dd>{lateToday.length}</dd></div>
          <div><dt>Correction requests open</dt><dd>{openRequests.filter((item) => ['Attendance Correction', 'Overtime', 'Schedule Change'].includes(item.type)).length}</dd></div>
        </dl>
        <div className="panel-body"><button type="button" className="button button-secondary button-small" onClick={() => onNavigate('time')}>Open Time & Attendance</button></div>
      </section>}

      {showSecurity && !securityFirst && <section className="panel" aria-labelledby="security-mini-title">
        <div className="panel-header"><div><h2 id="security-mini-title">Security</h2><p>Open alerts</p></div><ShieldAlert className="panel-header-icon" aria-hidden="true" /></div>
        <dl className="key-values key-values-list">{['Critical', 'High', 'Medium', 'Low'].map((severity) => <div key={severity}><dt>{severity}</dt><dd>{openAlerts.filter((alert) => alert.severity === severity).length}</dd></div>)}</dl>
        <div className="panel-body"><button type="button" className="button button-secondary button-small" onClick={() => onNavigate('security')}>Open Security Center</button></div>
      </section>}
    </div>

    <section className="panel" aria-labelledby="activity-title">
      <div className="panel-header"><div><h2 id="activity-title">Recent activity</h2><p>Sensitive changes recorded in the audit log</p></div>{(can('analytics') || can('security')) && <button className="text-button" onClick={() => onNavigate(can('security') ? 'security?tab=audit' : 'analytics')}>View audit log</button>}</div>
      {data.auditLog.length ? <div className="activity-feed">{data.auditLog.slice(0, 6).map((entry) => <article key={entry.id}><span aria-hidden="true"><Activity /></span><div><strong>{entry.action}</strong><p>{entry.actor} · {entry.target}</p></div><time>{entry.time}</time></article>)}</div> : <EmptyState compact icon={Activity} title="No recorded activity" text="Sensitive changes will appear here." />}
    </section>

    {!securityFirst && securityBlock}
  </div>
}
