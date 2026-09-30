import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { businessDate, attendanceForClock } from '../utils/securityMetrics.js'
import { requireSupabase } from '../services/supabaseClient.js'
import {
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  Camera,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  FolderLock,
  Gauge,
  Inbox,
  Info,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  MapPin,
  Mail,
  MessageSquareText,
  PhilippinePeso,
  Pencil,
  Plus,
  Phone,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react'
import PortalLayout from '../components/PortalLayout.js'
import FirstLoginPasswordSetup from '../components/FirstLoginPasswordSetup.js'
import ProfilePhotoEditor from '../components/ProfilePhotoEditor.js'
import {
  Badge,
  EmptyState,
  Modal,
  ProgressBar,
  SectionHeading,
  StatCard,
  TableShell,
} from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { downloadCsv, inclusiveDays } from '../utils/downloads.js'
import { formatDate, formatDateTime, formatMoney, statusTone } from '../utils/format.js'
import EmployeeAccountSecurity from './EmployeeAccountSecurity.js'
import type { GoalRecord, LeaveRequestRecord, NotificationSummary, PayrollRecord } from '../types/hrms.js'

const navItems = [
  { id: 'home', label: 'My Day', icon: Gauge, group: 'Workspace' },
  { id: 'schedule', label: 'Time & Schedule', icon: Clock3, group: 'My Work' },
  { id: 'leave', label: 'Leave', icon: CalendarDays, group: 'My Work' },
  { id: 'requests', label: 'Request Center', icon: FileCheck2, group: 'My Work' },
  { id: 'inbox', label: 'Action Inbox', icon: Inbox, badge: 'inbox', group: 'My Work' },
  { id: 'pay', label: 'Pay & Benefits', icon: WalletCards, group: 'My Career' },
  { id: 'growth', label: 'Goals & Growth', icon: TrendingUp, group: 'My Career' },
  { id: 'documents', label: 'Documents', icon: FolderLock, group: 'Resources' },
  { id: 'help', label: 'HR Help Center', icon: CircleHelp, group: 'Resources' },
  { id: 'journey', label: 'My Journey', icon: ListChecks, group: 'My Account' },
  { id: 'account-security', label: 'Account Security', icon: ShieldCheck, badge: 'alerts', group: 'My Account' },
  { id: 'profile', label: 'My Profile', icon: UserRound, group: 'My Account' },
] as const

type EmployeePage = typeof navItems[number]['id']
interface NavigateProps { onNavigate: (page: EmployeePage) => void }

const titles = Object.fromEntries(navItems.map((item) => [item.id, item.label]))
const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const requestTypes = [
  'Attendance Correction', 'Overtime', 'Schedule Change', 'Profile Correction',
  'Document Request', 'Payroll Concern', 'General HR',
] as const
const requestRouting: Record<string, { team: string; guidance: string }> = {
  'Attendance Correction': { team: 'Time & Attendance', guidance: 'Include the date, expected time, and what appears incorrectly.' },
  Overtime: { team: 'Time & Attendance', guidance: 'Include the work date, total hours, and approving supervisor.' },
  'Schedule Change': { team: 'People Operations', guidance: 'State the requested schedule and when it should take effect.' },
  'Profile Correction': { team: 'People Operations', guidance: 'Describe the current value and the correct employee information.' },
  'Document Request': { team: 'HR Services', guidance: 'Name the document, intended recipient, and required delivery date.' },
  'Payroll Concern': { team: 'Payroll Operations', guidance: 'Identify the pay period and the amount or item that needs review.' },
  'General HR': { team: 'People Operations', guidance: 'Give HR enough context to route and resolve the request correctly.' },
}
const requestPriorities = [
  { value: 'Normal', label: 'Normal', detail: 'Standard HR review' },
  { value: 'High', label: 'High', detail: 'Time-sensitive issue' },
  { value: 'Urgent', label: 'Urgent', detail: 'Immediate work impact' },
] as const

const availableLeave = (requests: LeaveRequestRecord[]) => Math.max(
  0,
  12 - requests
    .filter((request) => request.status === 'Approved')
    .reduce((total, request) => total + request.days, 0),
)

const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function EmployeePortal() {
  const [active, setActive] = useState<EmployeePage>('home')
  const { data, user } = useHrms()
  if (!data || !user) return null

  const pages = {
    home: <MyDay onNavigate={setActive} />,
    schedule: <TimeAndSchedule onNavigate={setActive} />,
    leave: <EmployeeLeave />,
    requests: <RequestCenter />,
    inbox: <ActionInbox onNavigate={setActive} />,
    pay: <PayAndBenefits />,
    growth: <GoalsAndGrowth />,
    documents: <DocumentVault />,
    help: <HelpCenter onNavigate={setActive} />,
    journey: <EmployeeJourney />,
    'account-security': <EmployeeAccountSecurity />,
    profile: <EmployeeProfile />,
  }

  return <><PortalLayout active={active} onNavigate={(page) => setActive(page as EmployeePage)} items={navItems} title={titles[active]}>{pages[active]}</PortalLayout>{user.mustChangePassword && <FirstLoginPasswordSetup />}</>
}

function MyDay({ onNavigate }: NavigateProps) {
  const { data, user, clock } = useHrms()
  if (!data || !user) return null
  const today = businessDate()
  const attendance = attendanceForClock(data.attendance, user.id)
  const schedule = data.schedules.find((item) => item.employeeId === user.id && item.date === today)
  const leaves = data.leaveRequests.filter((item) => item.employeeId === user.id)
  const requests = data.employeeRequests.filter((item) => item.employeeId === user.id)
  const unread = data.notifications.filter((item) => item.employeeId === user.id && !item.readAt)
  const acknowledgements = new Set(data.documentAcknowledgements.filter((item) => item.employeeId === user.id).map((item) => item.documentId))
  const requiredDocuments = data.documents.filter((item) => item.requiresAck && !acknowledgements.has(item.id))
  const needsInfo = requests.filter((item) => item.status === 'More Information')
  const actionCount = unread.length + requiredDocuments.length + needsInfo.length

  const clockNow = async () => {
    try { await clock(user.id) } catch { /* The shared toast explains the database response. */ }
  }

  return (
    <div className="page-stack employee-dashboard">
      <section className="employee-day-hero">
        <div className="employee-day-copy"><span className="employee-date-pill"><CalendarDays />{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</span><span className="eyebrow">Your workday, clearly organized</span><h1>Good day, {user.preferredName || user.firstName}.</h1><p>Everything you need for today—without digging through HR menus.</p><div className="employee-schedule-line"><span><BriefcaseBusiness />{schedule?.workMode || 'Schedule pending'}</span><span><Clock3 />{schedule ? `${schedule.shiftStart}–${schedule.shiftEnd}` : 'No shift assigned'}</span><span><MapPin />{schedule?.location || 'Contact HR'}</span></div></div>
        <div className="employee-day-card"><div className={`day-status ${attendance?.clockIn && !attendance?.clockOut ? 'is-working' : ''}`}><span><Clock3 /></span><div><small>Today’s attendance</small><strong>{attendance?.clockIn && !attendance?.clockOut ? 'You are clocked in' : attendance?.clockOut ? 'Workday complete' : 'Ready when you are'}</strong><p>{attendance?.clockIn ? `Started ${attendance.clockIn}${attendance.clockOut ? ` · Ended ${attendance.clockOut}` : ''}` : 'Your attendance record updates securely.'}</p></div></div><button className="button employee-clock-button" onClick={clockNow} disabled={Boolean(attendance?.clockOut) || schedule?.workMode === 'Rest Day'}><Clock3 size={18} />{attendance?.clockIn && !attendance?.clockOut ? 'Clock out' : attendance?.clockOut ? 'Day complete' : 'Clock in securely'}</button><button className="employee-inbox-link" onClick={() => onNavigate('inbox')}><Inbox size={17} /><span>{actionCount} action{actionCount === 1 ? '' : 's'} need attention</span></button></div>
      </section>

      <div className="stats-grid stats-grid-4 employee-metric-grid">
        <StatCard icon={Clock3} label="Attendance" value={attendance?.status ?? 'Not started'} detail={attendance?.clockIn ? `In ${attendance.clockIn}${attendance.clockOut ? ` · Out ${attendance.clockOut}` : ''}` : 'Secure time record'} tone="blue" />
        <StatCard icon={CalendarDays} label="Leave available" value={`${availableLeave(leaves)} days`} detail={`${leaves.filter((item) => item.status === 'Pending').length} pending`} tone="green" />
        <StatCard icon={FileCheck2} label="Open requests" value={requests.filter((item) => openRequestStatuses.includes(item.status)).length} detail="Shared with HR" tone="amber" />
        <StatCard icon={Bell} label="Unread updates" value={unread.length} detail={`${requiredDocuments.length} acknowledgement${requiredDocuments.length === 1 ? '' : 's'} due`} tone="purple" />
      </div>

      <div className="content-grid dashboard-grid employee-home-grid">
        <section className="panel employee-attention-panel">
          <div className="panel-header"><div><span className="panel-kicker">Personal action list</span><h2>What needs your attention</h2><p>Only the requests and updates relevant to you.</p></div><Badge tone={actionCount ? 'warning' : 'success'}>{actionCount ? `${actionCount} open` : 'All clear'}</Badge></div>
          <div className="action-list">
            {needsInfo.map((item) => <button key={`request-${item.id}`} onClick={() => onNavigate('requests')}><span className="action-icon tone-amber"><MessageSquareText /></span><div><strong>HR needs more information</strong><p>{item.subject}</p></div><Badge tone="warning">Respond</Badge></button>)}
            {requiredDocuments.map((item) => <button key={`document-${item.id}`} onClick={() => onNavigate('documents')}><span className="action-icon tone-blue"><BookOpenCheck /></span><div><strong>Acknowledge a policy</strong><p>{item.title} · Version {item.version}</p></div><Badge tone="info">Review</Badge></button>)}
            {unread.slice(0, 3).map((item) => <button key={`notification-${item.id}`} onClick={() => onNavigate('inbox')}><span className="action-icon tone-purple"><Bell /></span><div><strong>{item.title}</strong><p>{item.message}</p></div><Badge tone="neutral">New</Badge></button>)}
            {actionCount === 0 && <EmptyState icon={CheckCircle2} title="You are up to date" text="New HR actions, decisions, and policy acknowledgements will appear here." />}
          </div>
        </section>
        <section className="panel employee-quick-panel"><div className="panel-header"><div><span className="panel-kicker">Self-service</span><h2>Quick actions</h2><p>Common tasks in one tap</p></div><Sparkles /></div><div className="employee-quick-links premium-quick-links"><button onClick={() => onNavigate('leave')}><CalendarDays /><span><strong>Request leave</strong><small>Submit and track</small></span></button><button onClick={() => onNavigate('requests')}><FileCheck2 /><span><strong>Ask HR</strong><small>Private request center</small></span></button><button onClick={() => onNavigate('pay')}><ReceiptText /><span><strong>Open payslip</strong><small>Private pay details</small></span></button><button onClick={() => onNavigate('documents')}><FolderLock /><span><strong>Documents</strong><small>Policies and records</small></span></button></div></section>
      </div>

      <section className="panel employee-updates-panel"><div className="panel-header"><div><span className="panel-kicker">Inside Quantum</span><h2>Company updates</h2><p>Recent announcements from HR</p></div></div><div className="announcement-list horizontal-announcements">{data.announcements.slice(0, 3).map((announcement) => <article key={announcement.id}><div><Badge tone={announcement.priority === 'High' ? 'warning' : 'info'}>{announcement.priority}</Badge><time>{formatDate(announcement.date)}</time></div><strong>{announcement.title}</strong><p>{announcement.content}</p></article>)}</div></section>
    </div>
  )
}

function TimeAndSchedule({ onNavigate }: NavigateProps) {
  const { data, user, clock } = useHrms()
  if (!data || !user) return null
  const today = businessDate()
  const current = attendanceForClock(data.attendance, user.id)
  const history = data.attendance.filter((item) => item.employeeId === user.id)
  const schedule = data.schedules.filter((item) => item.employeeId === user.id)
  const currentSchedule = schedule.find((item) => item.date === today)
  const totalHours = history.reduce((sum, item) => sum + item.hours, 0)
  const clockNow = async () => { try { await clock(user.id) } catch { /* Toast handles it. */ } }

  return <div className="page-stack employee-feature-page employee-time-page"><SectionHeading eyebrow="My work" title="Time & Schedule" description="Clock securely, review assigned shifts, and report exceptions without editing official records." actions={<button className="button button-secondary" onClick={() => onNavigate('requests')}><MessageSquareText />Request correction</button>} /><section className="clock-panel premium-clock-panel"><div><span>Current time</span><strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><p>{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div><div className="clock-state"><span className={current?.clockIn && !current?.clockOut ? 'working' : ''}><Clock3 /></span><div><strong>{current?.clockIn && !current?.clockOut ? 'You are clocked in' : current?.clockOut ? 'Workday completed' : currentSchedule?.workMode === 'Rest Day' ? 'Rest day' : 'Ready to start?'}</strong><p>{current?.clockIn ? `Clock-in: ${current.clockIn}${current.clockOut ? ` · Clock-out: ${current.clockOut}` : ''}` : currentSchedule ? `${currentSchedule.shiftStart}–${currentSchedule.shiftEnd} · ${currentSchedule.location}` : 'No assigned shift for today.'}</p></div></div><button className={`button ${current?.clockIn && !current?.clockOut ? 'button-danger' : 'button-primary'} button-large`} onClick={clockNow} disabled={Boolean(current?.clockOut) || (currentSchedule?.workMode === 'Rest Day' && !current?.clockIn)}>{current?.clockIn && !current?.clockOut ? 'Clock out' : current?.clockOut ? 'Workday completed' : 'Clock in now'}</button></section><div className="stats-grid stats-grid-3"><StatCard icon={Clock3} label="Recorded hours" value={`${totalHours.toFixed(1)} hrs`} detail="Visible attendance history" tone="blue" /><StatCard icon={CalendarDays} label="Upcoming shifts" value={schedule.filter((item) => item.date >= today && item.workMode !== 'Rest Day').length} detail="All upcoming assignments" tone="green" /><StatCard icon={MapPin} label="Today’s work mode" value={currentSchedule?.workMode ?? 'Unassigned'} detail={currentSchedule?.location ?? 'Contact HR if incorrect'} tone="purple" /></div><section className="panel"><div className="panel-header"><div><h2>Upcoming schedule</h2><p>Assigned shifts from the administrator workspace</p></div></div><div className="schedule-strip">{schedule.filter((item) => item.date >= today).slice(0, 7).map((item) => <article key={item.id} className={item.date === today ? 'today' : ''}><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' })}</span><strong>{new Date(`${item.date}T00:00:00`).getDate()}</strong><Badge tone={item.workMode === 'Rest Day' ? 'neutral' : item.workMode === 'Remote' ? 'info' : 'success'}>{item.workMode}</Badge><small>{item.workMode === 'Rest Day' ? 'No shift' : `${item.shiftStart}–${item.shiftEnd}`}</small></article>)}</div></section><section className="panel"><div className="panel-header"><div><h2>Attendance history</h2><p>Official records; corrections are handled through Request Center</p></div></div><TableShell><thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th>Status</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{formatDate(item.date)}</td><td>{item.clockIn ?? '—'}</td><td>{item.clockOut ?? '—'}</td><td>{item.hours.toFixed(1)}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></TableShell></section></div>
}

function EmployeeLeave() {
  const { data, user, submitLeave } = useHrms()
  const [showRequest, setShowRequest] = useState(false)
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [form, setForm] = useState({ type: 'Vacation', startDate: '', endDate: '', reason: '' })
  if (!data || !user) return null
  const requests = data.leaveRequests.filter((item) => item.employeeId === user.id)
  const days = inclusiveDays(form.startDate, form.endDate)
  const today = businessDate()
  const balance = availableLeave(requests)
  const requestReady = days > 0 && days <= 30 && form.reason.trim().length >= 3
  const remainingBalance = Math.max(0, balance - days)
  const leaveGuidance: Record<string, string> = {
    Vacation: 'Plan ahead when possible so your team can arrange coverage.',
    Sick: 'Use this when illness or recovery prevents you from working.',
    Emergency: 'For urgent, unexpected circumstances that require time away.',
    Other: 'Explain the leave purpose clearly so HR can route it correctly.',
  }

  const closeLeaveRequest = () => {
    if (leaveSaving) return
    setShowRequest(false)
    setForm({ type: 'Vacation', startDate: '', endDate: '', reason: '' })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requestReady) return
    setLeaveSaving(true)
    try {
      await submitLeave({ ...form, employeeId: user.id })
      setShowRequest(false)
      setForm({ type: 'Vacation', startDate: '', endDate: '', reason: '' })
    } catch { /* Keep the form open for correction. */ }
    finally { setLeaveSaving(false) }
  }

  return <div className="page-stack employee-feature-page employee-leave-page"><SectionHeading eyebrow="My work" title="Leave" description="Plan time away and follow each database-backed approval." actions={<button className="button button-primary" onClick={() => setShowRequest(true)}><Plus />New leave request</button>} /><div className="stats-grid stats-grid-3"><StatCard icon={CalendarDays} label="Available balance" value={`${balance} days`} tone="green" /><StatCard icon={CheckCircle2} label="Approved" value={requests.filter((item) => item.status === 'Approved').length} tone="blue" /><StatCard icon={Clock3} label="Pending" value={requests.filter((item) => item.status === 'Pending').length} tone="amber" /></div><section className="panel"><div className="panel-header"><div><h2>Leave history</h2><p>Administrator decisions synchronize here automatically.</p></div></div><TableShell><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.type}</strong></td><td>{formatDate(request.startDate)} – {formatDate(request.endDate)}</td><td>{request.days}</td><td>{request.reason}</td><td><Badge tone={statusTone(request.status)}>{request.status}</Badge></td></tr>)}</tbody></TableShell></section>{showRequest && <Modal title="Request leave" onClose={closeLeaveRequest} size="large">
    <form className="rf-form" onSubmit={submit} aria-busy={leaveSaving}>
      <div className="rf-intro">
        <p>Choose a leave type and your dates, then tell your approver why you need the time off. HR reviews every request before it is approved.</p>
        <div className="rf-balance"><span>Available balance</span><strong>{balance} days</strong></div>
      </div>

      <div className="rf-layout">
        <div className="rf-fields">
          <section className="rf-section">
            <h3><span className="rf-step" aria-hidden="true">1</span>Choose a leave type</h3>
            <label className="rf-field">
              <span className="rf-label">Leave type</span>
              <select aria-label="Leave type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Vacation</option><option>Sick</option><option>Emergency</option><option>Other</option></select>
              <span className="rf-help">{leaveGuidance[form.type]}</span>
            </label>
          </section>

          <section className="rf-section">
            <h3><span className="rf-step" aria-hidden="true">2</span>Pick your dates</h3>
            <div className="rf-grid">
              <label className="rf-field"><span className="rf-label">Start date</span><input aria-label="Start date" type="date" min={today} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value, endDate: event.target.value > form.endDate ? '' : form.endDate })} required /></label>
              <label className="rf-field"><span className="rf-label">End date</span><input aria-label="End date" type="date" min={form.startDate || today} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label>
            </div>
            <div className="rf-duration">
              <label><span>Duration</span><input aria-label="Calculated duration" value={days ? `${days} day${days === 1 ? '' : 's'}` : 'Select valid dates'} readOnly /></label>
              <Badge tone={days > 30 ? 'danger' : days ? 'success' : 'neutral'}>{days > 30 ? 'Over limit' : days ? 'Ready' : 'Waiting for dates'}</Badge>
            </div>
            {days > 30 && <p className="rf-error" role="alert">A single request may cover at most 30 calendar days. Please shorten the date range.</p>}
          </section>

          <section className="rf-section">
            <h3><span className="rf-step" aria-hidden="true">3</span>Add a reason</h3>
            <label className="rf-field">
              <span className="rf-label-row"><span className="rf-label">Reason</span><span className="rf-count">{form.reason.length}/500</span></span>
              <textarea aria-label="Reason" minLength={3} maxLength={500} rows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="For example: Family event out of town" required />
            </label>
          </section>
        </div>

        <aside className="rf-summary" aria-label="Leave request preview">
          <h3>Request summary</h3>
          <dl>
            <div><dt>Leave type</dt><dd>{form.type}</dd></div>
            <div><dt>Dates</dt><dd>{form.startDate && form.endDate ? `${formatDate(form.startDate)} – ${formatDate(form.endDate)}` : form.startDate ? `From ${formatDate(form.startDate)}` : 'Not selected yet'}</dd></div>
            <div><dt>Duration</dt><dd>{days ? `${days} day${days === 1 ? '' : 's'}` : '—'}</dd></div>
            <div><dt>Requested by</dt><dd>{user.firstName} {user.lastName}</dd></div>
            <div><dt>Current balance</dt><dd>{balance} days</dd></div>
            <div><dt>Balance after approval</dt><dd>{days ? `${remainingBalance} days` : '—'}</dd></div>
            <div><dt>Status after sending</dt><dd><Badge tone="warning">Pending review</Badge></dd></div>
          </dl>
          <p className="rf-note"><ShieldCheck aria-hidden="true" /><span>Only you and authorized HR approvers can see this request. The decision appears in your leave history.</span></p>
        </aside>
      </div>

      <footer className="rf-footer">
        <p><Info aria-hidden="true" /><span>Approved leave is deducted from your available balance.</span></p>
        <div className="rf-actions"><button type="button" className="button button-secondary" onClick={closeLeaveRequest} disabled={leaveSaving}>Cancel</button><button className="button button-primary" disabled={!requestReady || leaveSaving}>{leaveSaving ? 'Submitting…' : 'Submit leave request'}</button></div>
      </footer>
    </form>
  </Modal>}</div>
}

function RequestCenter() {
  const { data, user, submitRequest, addRequestComment, cancelRequest } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const requestKey = useRef<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const emptyForm = { type: 'Attendance Correction', subject: '', description: '', requestedDate: '', requestedValue: '', priority: 'Normal' }
  const [form, setForm] = useState(emptyForm)
  if (!data || !user) return null
  const requests = data.employeeRequests.filter((item) => item.employeeId === user.id)
  const selected = requests.find((item) => item.id === selectedId)
  const comments = data.requestComments.filter((item) => item.requestId === selectedId)
  const routing = requestRouting[form.type] ?? requestRouting['General HR']
  const subjectLength = form.subject.length
  const detailsLength = form.description.length
  const requestReady = form.subject.trim().length >= 3 && form.description.trim().length >= 3

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    requestKey.current ||= crypto.randomUUID()
    try { await submitRequest({ ...form, idempotencyKey: requestKey.current }); requestKey.current = null; setForm(emptyForm); setShowCreate(false) } catch { /* Retain the request key for a safe retry. */ }
  }
  const respond = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!comment.trim()) return
    if (!selectedId) return
    try { await addRequestComment(selectedId, comment, false); setComment('') } catch { /* Keep response text. */ }
  }

  return (
    <div className="page-stack employee-feature-page employee-requests-page">
      <SectionHeading eyebrow="One place for every HR need" title="Request Center" description="Submit, discuss, and track attendance, overtime, schedule, profile, document, payroll, and general HR requests." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus />New request</button>} />
      <div className="stats-grid stats-grid-3"><StatCard icon={Send} label="Submitted" value={requests.filter((item) => item.status === 'Submitted').length} tone="blue" /><StatCard icon={Clock3} label="In progress" value={requests.filter((item) => ['Under Review', 'More Information'].includes(item.status)).length} tone="amber" /><StatCard icon={CheckCircle2} label="Resolved" value={requests.filter((item) => ['Approved', 'Rejected', 'Completed'].includes(item.status)).length} tone="green" /></div>
      <section className="panel"><div className="panel-header"><div><h2>My requests</h2><p>Open a row to see the full decision timeline.</p></div></div>{requests.length ? <TableShell><thead><tr><th>Request</th><th>Type</th><th>Priority</th><th>Updated</th><th>Status</th><th></th></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><strong>#{item.id} · {item.subject}</strong><small className="table-subtitle">{item.description}</small></td><td>{item.type}</td><td><Badge tone={item.priority === 'Urgent' ? 'danger' : item.priority === 'High' ? 'warning' : 'neutral'}>{item.priority}</Badge></td><td>{formatDateTime(item.updatedAt)}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td><td><button className="text-button" onClick={() => setSelectedId(item.id)}>View</button></td></tr>)}</tbody></TableShell> : <EmptyState icon={FileCheck2} title="No HR requests yet" text="Use New request when you need a correction, document, answer, or HR decision." />}</section>
      {showCreate && <Modal title="Create an HR request" onClose={() => setShowCreate(false)} size="large">
        <form className="rf-form" onSubmit={submit}>
          <div className="rf-intro">
            <p>Tell HR what you need. Your request, HR’s replies, and the final decision stay together in one private case. All fields are required unless marked optional.</p>
          </div>

          <div className="rf-layout">
            <div className="rf-fields">
              <div className="rf-grid">
                <label className="rf-field rf-span-2">
                  <span className="rf-label">Request type</span>
                  <select aria-label="Request type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{requestTypes.map((type) => <option key={type}>{type}</option>)}</select>
                  <span className="rf-help rf-tip"><Lightbulb aria-hidden="true" />{routing.guidance}</span>
                </label>

                <fieldset className="rf-field rf-span-2 rf-choices">
                  <legend className="rf-label">Priority</legend>
                  <div>{requestPriorities.map((priority) => <label className={`rf-choice${form.priority === priority.value ? ' is-selected' : ''}`} key={priority.value}><input type="radio" name="request-priority" value={priority.value} checked={form.priority === priority.value} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><strong>{priority.label}</strong><small>{priority.detail}</small></span></label>)}</div>
                </fieldset>

                <label className="rf-field rf-span-2">
                  <span className="rf-label-row"><span className="rf-label">Subject</span><span className="rf-count">{subjectLength}/120</span></span>
                  <input aria-label="Subject" minLength={3} maxLength={120} placeholder="Summarize your request in one sentence" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required />
                </label>

                <label className="rf-field">
                  <span className="rf-label">Related date <span className="rf-optional">(optional)</span></span>
                  <input aria-label="Related date (optional)" type="date" value={form.requestedDate} onChange={(event) => setForm({ ...form, requestedDate: event.target.value })} />
                </label>

                <label className="rf-field">
                  <span className="rf-label">Requested value <span className="rf-optional">(optional)</span></span>
                  <input aria-label="Requested value (optional)" maxLength={240} placeholder="Example: Correct clock-out to 5:06 PM" value={form.requestedValue} onChange={(event) => setForm({ ...form, requestedValue: event.target.value })} />
                </label>

                <label className="rf-field rf-span-2">
                  <span className="rf-label-row"><span className="rf-label">Details</span><span className="rf-count">{detailsLength}/1000</span></span>
                  <textarea aria-label="Details" rows={6} minLength={3} maxLength={1000} placeholder="What happened, what the record shows now, and what you would like HR to do." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
                </label>
              </div>
            </div>

            <aside className="rf-summary" aria-label="HR request summary">
              <h3>Request summary</h3>
              <dl aria-live="polite">
                <div><dt>Request type</dt><dd>{form.type}</dd></div>
                <div><dt>Handled by</dt><dd>{routing.team}</dd></div>
                <div><dt>Priority</dt><dd><Badge tone={form.priority === 'Urgent' ? 'danger' : form.priority === 'High' ? 'warning' : 'neutral'}>{form.priority}</Badge></dd></div>
                <div><dt>Related date</dt><dd>{form.requestedDate ? formatDate(form.requestedDate) : 'Not specified'}</dd></div>
              </dl>
              <div className="rf-preview"><span>Preview</span><strong>{form.subject.trim() || 'Your subject will appear here'}</strong><p>{form.description.trim() || 'Clear, specific details help HR resolve your request without follow-up questions.'}</p></div>
              <p className="rf-note"><ShieldCheck aria-hidden="true" /><span>Only you and authorized HR staff can see this request. Every submission and case update is logged.</span></p>
            </aside>
          </div>

          <footer className="rf-footer">
            <p><Info aria-hidden="true" /><span><strong>{requestReady ? 'Ready to submit.' : 'Complete the required fields.'}</strong> Your request is created once it is securely saved.</span></p>
            <div className="rf-actions"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" disabled={!requestReady}><Send aria-hidden="true" />Submit request</button></div>
          </footer>
        </form>
      </Modal>}
      {selected && <Modal title={`Request #${selected.id}`} onClose={() => setSelectedId(null)} size="large"><div className="request-detail"><div className="request-detail-head"><div><span className="eyebrow">{selected.type}</span><h2>{selected.subject}</h2><p>{selected.description}</p></div><Badge tone={statusTone(selected.status)}>{selected.status}</Badge></div><dl className="detail-grid"><div><dt>Priority</dt><dd>{selected.priority}</dd></div><div><dt>Submitted</dt><dd>{formatDateTime(selected.createdAt)}</dd></div><div><dt>Related date</dt><dd>{formatDate(selected.requestedDate)}</dd></div><div><dt>Requested value</dt><dd>{selected.requestedValue || '—'}</dd></div></dl>{selected.decisionNote && <div className="decision-note"><ShieldCheck /><div><strong>Latest HR decision</strong><p>{selected.decisionNote}</p></div></div>}<div><h3>Conversation & timeline</h3><div className="timeline">{comments.map((item) => { const author = data.employees.find((employee) => employee.id === item.authorId); return <article key={item.id}><span>{author ? `${author.firstName[0]}${author.lastName[0]}` : 'HR'}</span><div><strong>{author ? `${author.firstName} ${author.lastName}` : 'HR team'}</strong><p>{item.body}</p><time>{formatDateTime(item.createdAt)}</time></div></article> })}{comments.length === 0 && <p className="form-note">No responses yet. HR updates will appear here.</p>}</div></div>{!['Cancelled', 'Completed', 'Rejected'].includes(selected.status) && <form className="inline-response" onSubmit={respond}><label className="sr-only" htmlFor="request-response">Add a response</label><textarea id="request-response" rows={3} maxLength={1000} placeholder="Add information or reply to HR…" value={comment} onChange={(event) => setComment(event.target.value)} required /><button className="button button-primary"><Send size={17} />Send response</button></form>}<div className="modal-actions">{['Submitted', 'More Information'].includes(selected.status) && <button className="button button-secondary danger-text" onClick={async () => { try { await cancelRequest(selected.id); setSelectedId(null) } catch { /* Toast explains failure. */ } }}><XCircle size={17} />Cancel request</button>}<button className="button button-secondary" onClick={() => setSelectedId(null)}>Close</button></div></div></Modal>}
    </div>
  )
}

function ActionInbox({ onNavigate }: NavigateProps) {
  const { data, user, markNotificationRead, markAllNotificationsRead } = useHrms()
  if (!data || !user) return null
  const notifications = data.notifications.filter((item) => item.employeeId === user.id)
  const unread = notifications.filter((item) => !item.readAt)
  const open = async (item: NotificationSummary) => {
    if (!item.readAt) {
      try { await markNotificationRead(item.id) } catch { return }
    }
    if (item.destination && item.destination in titles) onNavigate(item.destination as EmployeePage)
  }

  return <div className="page-stack employee-feature-page employee-inbox-page"><SectionHeading eyebrow="Prioritized updates" title="Action Inbox" description="Decisions, documents, pay releases, security notices, and required actions in one place." actions={unread.length > 0 && <button className="button button-secondary" onClick={() => markAllNotificationsRead()}><CheckCircle2 />Mark all read</button>} /><section className="panel notification-feed">{notifications.map((item) => <button key={item.id} className={!item.readAt ? 'unread' : ''} onClick={() => open(item)}><span className="notification-icon"><Bell /></span><div><div><Badge tone={!item.readAt ? 'info' : 'neutral'}>{item.category}</Badge><time>{formatDateTime(item.createdAt)}</time></div><strong>{item.title}</strong><p>{item.message}</p></div>{item.actionLabel && <span className="notification-action">{item.actionLabel}</span>}</button>)}{notifications.length === 0 && <EmptyState icon={Inbox} title="Your inbox is clear" text="New actions and decisions from HR will appear here." />}</section></div>
}

function PayAndBenefits() {
  const { data, user, recordActivity } = useHrms()
  if (!data || !user) return null
  const records = data.payroll.filter((item) => item.employeeId === user.id)
  const benefits = data.benefits.filter((item) => item.employeeId === user.id)
  const latest = records[0]
  const employerBenefits = benefits.reduce((sum, item) => sum + item.employerShare, 0)

  const download = async (record: PayrollRecord) => {
    downloadCsv(`payslip-${user.id}-${record.period}`, [{ label: 'Employee ID', value: () => user.id }, { label: 'Employee', value: () => `${user.firstName} ${user.lastName}` }, { label: 'Period', key: 'period' }, { label: 'Gross pay', key: 'gross' }, { label: 'Allowances', key: 'allowances' }, { label: 'Bonuses', key: 'bonuses' }, { label: 'Deductions', key: 'deductions' }, { label: 'Net pay', key: 'net' }, { label: 'Status', key: 'status' }], [record])
    try { await recordActivity({ action: 'Downloaded own payslip', target: record.period }) } catch { /* The export is complete; toast reports the audit issue. */ }
  }

  return <div className="page-stack employee-feature-page employee-pay-page"><SectionHeading eyebrow="Private total rewards" title="Pay & Benefits" description="Understand salary, employer-paid benefits, and released payslips in one secure view." /><div className="privacy-banner"><ShieldCheck /><div><strong>Protected by Supabase Row-Level Security</strong><p>Only you and authorized payroll roles can retrieve these records. Payslip downloads are audited.</p></div></div><div className="stats-grid stats-grid-3"><StatCard icon={PhilippinePeso} label="Latest net pay" value={latest ? formatMoney(latest.net) : '—'} detail={latest?.period ?? 'No released payslip'} tone="green" /><StatCard icon={BriefcaseBusiness} label="Employer benefits" value={formatMoney(employerBenefits)} detail="Monthly contribution estimate" tone="blue" /><StatCard icon={WalletCards} label="Active plans" value={benefits.filter((item) => item.status === 'Active').length} detail="Benefits in your profile" tone="purple" /></div>{records.map((record) => <section className="panel payslip-card" key={record.id}><div className="payslip-head"><div><span>Payslip</span><h2>{record.period}</h2></div><Badge tone={statusTone(record.status)}>{record.status}</Badge></div><div className="payslip-summary payslip-summary-5"><div><span>Base pay</span><strong>{formatMoney(record.gross)}</strong></div><div><span>Allowances</span><strong>{formatMoney(record.allowances)}</strong></div><div><span>Bonuses</span><strong>{formatMoney(record.bonuses)}</strong></div><div><span>Deductions</span><strong>-{formatMoney(record.deductions)}</strong></div><div className="net"><span>Net pay</span><strong>{formatMoney(record.net)}</strong></div></div><button className="button button-secondary" onClick={() => download(record)}><Download size={17} />Download payslip CSV</button></section>)}{!records.length && <EmptyState icon={ReceiptText} title="No released payslip" text="Draft and validation records stay hidden until payroll authorizes release." />}<section className="panel"><div className="panel-header"><div><h2>Benefits coverage</h2><p>Your active plans and contribution breakdown</p></div></div><div className="benefit-grid">{benefits.map((item) => <article key={item.id}><span><BriefcaseBusiness /></span><div><Badge tone={statusTone(item.status)}>{item.status}</Badge><h3>{item.planName}</h3><p>{item.type} · {item.provider}</p><dl><div><dt>Your share</dt><dd>{formatMoney(item.employeeShare)}</dd></div><div><dt>Employer share</dt><dd>{formatMoney(item.employerShare)}</dd></div></dl></div></article>)}</div></section></div>
}

function GoalsAndGrowth() {
  const { data, user } = useHrms()
  if (!data || !user) return null
  const reviews = data.performance.filter((item) => item.employeeId === user.id && item.status === 'Published')
  const goals = data.goals.filter((item) => item.employeeId === user.id)
  const latest = reviews[0]

  return <div className="page-stack employee-feature-page employee-growth-page"><SectionHeading eyebrow="My career" title="Goals & Growth" description="Track agreed goals and review feedback that HR has explicitly published." />{latest ? <section className="performance-hero premium-performance"><div><span>Latest performance score</span><strong>{latest.score}<small>/100</small></strong><Badge tone="success">{latest.rating}</Badge></div><div><ProgressBar value={latest.goalProgress} label="Goal completion" /><p>Review period: {latest.period}</p>{latest.comments && <p>{latest.comments}</p>}</div></section> : <EmptyState icon={Target} title="No published review" text="Draft reviews remain private to HR until they are intentionally published." />}{latest && <div className="performance-metrics"><article className="panel"><span><Star /></span><strong>{latest.quality}</strong><p>Quality</p></article><article className="panel"><span><Target /></span><strong>{latest.productivity}</strong><p>Productivity</p></article><article className="panel"><span><UserRound /></span><strong>{latest.teamwork}</strong><p>Teamwork</p></article></div>}<section className="panel"><div className="panel-header"><div><h2>Active goals</h2><p>Update progress; HR sees the same saved value</p></div></div><div className="goal-list">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}{!goals.length && <EmptyState icon={Target} title="No active goals" text="Your manager or HR can add an agreed goal." />}</div></section></div>
}

function GoalCard({ goal }: { goal: GoalRecord }) {
  const { updateGoalProgress } = useHrms()
  const [progress, setProgress] = useState(goal.progress)
  return <article><div className="goal-head"><div><Badge tone={statusTone(goal.status)}>{goal.status}</Badge><h3>{goal.title}</h3><p>{goal.description}</p></div><strong>{progress}%</strong></div><input className="goal-slider" aria-label={`${goal.title} progress`} type="range" min={0} max={100} step={5} value={progress} onChange={(event) => setProgress(Number(event.target.value))} /><div className="goal-foot"><span>{goal.category} · Due {formatDate(goal.dueDate)}</span><button className="button button-secondary" disabled={progress === goal.progress} onClick={async () => { try { await updateGoalProgress(goal.id, progress) } catch { setProgress(goal.progress) } }}>Save progress</button></div></article>
}

function DocumentVault() {
  const { data, user, acknowledgeDocument, notify } = useHrms()
  if (!data || !user) return null
  const documents = data.documents.filter((item) => !item.employeeId || item.employeeId === user.id)
  const acknowledgements = new Map(data.documentAcknowledgements.filter((item) => item.employeeId === user.id).map((item) => [item.documentId, item]))
  const download = async (document: typeof data.documents[number]) => {
    try {
      const { data: body, error } = await requireSupabase().rpc('read_employee_document', { selected_document_id: Number(document.id) })
      if (error) throw error
      downloadText(document.filename, body)
    } catch { notify('This document is unavailable or expired. Refresh the page and try again.', 'error') }
  }

  return <div className="page-stack employee-feature-page employee-documents-page"><SectionHeading eyebrow="Secure records" title="Document Vault" description="Policies and employee-specific records retrieved directly from Supabase." /><div className="stats-grid stats-grid-3"><StatCard icon={FolderLock} label="Available documents" value={documents.length} tone="blue" /><StatCard icon={BookOpenCheck} label="Acknowledgements due" value={documents.filter((item) => item.requiresAck && !acknowledgements.has(item.id)).length} tone="amber" /><StatCard icon={ShieldCheck} label="Sensitive records" value={documents.filter((item) => item.sensitive).length} detail="Access is audited" tone="purple" /></div><section className="document-grid">{documents.map((item) => { const acknowledgement = acknowledgements.get(item.id); return <article className="panel document-card" key={item.id}><div className="document-icon"><FileText /></div><div className="document-card-main"><div><Badge tone={item.sensitive ? 'warning' : 'info'}>{item.type}</Badge>{item.requiresAck && <Badge tone={acknowledgement ? 'success' : 'danger'}>{acknowledgement ? 'Acknowledged' : 'Action required'}</Badge>}</div><h2>{item.title}</h2><p>Version {item.version}{item.period ? ` · ${item.period}` : ''}</p><small>{item.employeeId ? 'Private employee document' : 'Organization document'} · Added {formatDateTime(item.createdAt)}</small></div><div className="document-actions"><button className="button button-secondary" onClick={() => download(item)}><Download size={17} />Download</button>{item.requiresAck && !acknowledgement && <button className="button button-primary" onClick={() => acknowledgeDocument(item.id)}><BookOpenCheck size={17} />Acknowledge</button>}{acknowledgement && <span className="acknowledged-note"><CheckCircle2 />{formatDateTime(acknowledgement.acknowledgedAt)}</span>}</div></article> })}</section>{!documents.length && <EmptyState icon={FolderLock} title="No documents available" text="Documents published for you will appear here." />}</div>
}

function HelpCenter({ onNavigate }: NavigateProps) {
  const topics = [
    { icon: Clock3, title: 'Attendance correction', text: 'Report a missing or incorrect clock record through Request Center.' },
    { icon: ReceiptText, title: 'Payroll concern', text: 'Ask about a payslip without exposing payroll details in email.' },
    { icon: FolderLock, title: 'Document request', text: 'Request certificates, memos, and employment documents securely.' },
    { icon: ShieldCheck, title: 'Account safety', text: 'Review sessions, report unfamiliar activity, or change your password.' },
  ]
  return <div className="page-stack employee-feature-page employee-help-page"><SectionHeading eyebrow="Support without guesswork" title="HR Help Center" description="Start with clear guidance, then send a trackable request when a decision or correction is needed." actions={<button className="button button-primary" onClick={() => onNavigate('requests')}><LifeBuoy />Contact HR securely</button>} /><section className="help-grid">{topics.map(({ icon: Icon, title, text }) => <article className="panel" key={title}><span><Icon /></span><h2>{title}</h2><p>{text}</p><button className="text-button" onClick={() => onNavigate(title === 'Account safety' ? 'account-security' : 'requests')}>Open the right tool</button></article>)}</section><section className="privacy-banner"><ShieldCheck /><div><strong>Use Request Center for personal HR matters</strong><p>It keeps the conversation private, shows status clearly, and preserves a complete decision history.</p></div></section><section className="panel account-policy-help"><h2>Your terms and privacy</h2><p>Review how the academic portal works, how your information is handled, and how to exercise your privacy rights.</p><div><Link className="button button-secondary" to="/terms">Terms and Conditions</Link><Link className="button button-secondary" to="/privacy">Privacy Notice</Link></div></section></div>
}

function EmployeeJourney() {
  const { data, user } = useHrms()
  if (!data || !user) return null
  const cases = data.lifecycleCases.filter((item) => item.employeeId === user.id)
  return <div className="page-stack employee-feature-page employee-journey-page"><SectionHeading eyebrow="Employee lifecycle" title="My Journey" description="See employee-visible onboarding or offboarding steps without exposing internal security tasks." />{cases.map((item) => { const tasks = data.lifecycleTasks.filter((task) => task.caseId === item.id && task.employeeVisible); const complete = tasks.filter((task) => task.status !== 'Pending').length; const progress = tasks.length ? Math.round((complete / tasks.length) * 100) : 0; return <section className="panel journey-card" key={item.id}><div className="journey-head"><div><Badge tone={statusTone(item.status)}>{item.status}</Badge><h2>{item.type} checklist</h2><p>Target date: {formatDate(item.targetDate)}</p></div><strong>{progress}%</strong></div><ProgressBar value={progress} label={`${complete} of ${tasks.length} visible steps complete`} /><div className="checklist">{tasks.map((task) => <article key={task.id} className={task.status !== 'Pending' ? 'complete' : ''}>{task.status !== 'Pending' ? <CheckCircle2 /> : <Clock3 />}<div><strong>{task.title}</strong><p>{task.category}</p></div><Badge tone={statusTone(task.status)}>{task.status}</Badge></article>)}</div></section> })}{!cases.length && <EmptyState icon={ListChecks} title="No active journey checklist" text="Onboarding or offboarding steps will appear here when HR starts a case." />}</div>
}

function EmployeeProfile() {
  const { user, updateEmployee, updateProfilePhoto, notify } = useHrms()
  const [form, setForm] = useState({ phone: user?.phone ?? '' })
  const [editing, setEditing] = useState(false)
  const [confirmingSave, setConfirmingSave] = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoEditorUrl, setPhotoEditorUrl] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const phoneInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) phoneInput.current?.focus()
  }, [editing])
  if (!user) return null
  const initials = `${user.firstName[0] || ''}${user.lastName[0] || ''}`
  const currentPhone = (user.phone || '').trim()
  const nextPhone = form.phone.trim()
  const phoneChanged = nextPhone !== currentPhone
  const resetPhotoEditor = () => {
    if (photoEditorUrl) URL.revokeObjectURL(photoEditorUrl)
    setPhotoEditorUrl('')
    if (photoInput.current) photoInput.current.value = ''
  }
  const closePhotoEditor = () => {
    if (photoSaving) return
    resetPhotoEditor()
  }
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('Choose a JPG, PNG, or WebP profile photo.', 'error')
      event.target.value = ''
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      notify('Choose a profile photo smaller than 8 MB.', 'error')
      event.target.value = ''
      return
    }
    if (photoEditorUrl) URL.revokeObjectURL(photoEditorUrl)
    setPhotoEditorUrl(URL.createObjectURL(file))
  }
  const savePhoto = async (photo: Blob) => {
    setPhotoSaving(true)
    try {
      await updateProfilePhoto(photo)
      resetPhotoEditor()
    } finally { setPhotoSaving(false) }
  }
  const beginEditing = () => {
    setForm({ phone: user.phone ?? '' })
    setEditing(true)
  }
  const cancelEditing = () => {
    if (phoneSaving) return
    setConfirmingSave(false)
    setForm({ phone: user.phone ?? '' })
    setEditing(false)
  }
  const requestSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing || phoneSaving || !phoneChanged) return
    if (nextPhone.length < 7 || nextPhone.length > 30) {
      notify('Enter a phone number between 7 and 30 characters.', 'error')
      return
    }
    setConfirmingSave(true)
  }
  const confirmSave = async () => {
    if (!confirmingSave || phoneSaving) return
    setPhoneSaving(true)
    try {
      await updateEmployee(user.id, { phone: nextPhone })
      setConfirmingSave(false)
      setEditing(false)
    } catch { /* Keep the confirmation available for a retry. */ }
    finally { setPhoneSaving(false) }
  }
  return <div className="page-stack employee-feature-page employee-profile-page">
    <SectionHeading eyebrow="My account" title="My Profile" description="Your trusted identity, employment details, and employee-managed contact information in one secure workspace." actions={<><Badge tone="success">Supabase Realtime</Badge>{editing ? <Badge tone="info">Editing profile</Badge> : <button type="button" className="button button-secondary profile-edit-button" onClick={beginEditing}><Pencil />Edit profile</button>}</>} />
    <section className="rf-profile rf-profile-header" aria-label="Profile summary">
      <input ref={photoInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile picture" tabIndex={-1} onChange={choosePhoto} />
      <button type="button" className="rf-avatar-button" onClick={() => photoInput.current?.click()}>
        <span className="rf-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span aria-hidden="true">{initials}</span>}</span>
        <span className="rf-avatar-action"><Camera aria-hidden="true" />Update photo</span>
      </button>
      <div className="rf-identity">
        <h2>{user.preferredName || user.firstName} {user.lastName}</h2>
        <p className="rf-identity-role"><span><BriefcaseBusiness aria-hidden="true" />{user.position}</span><span><Building2 aria-hidden="true" />{user.department}</span></p>
        <div className="inline-badges"><Badge tone={statusTone(user.status)}>{user.status}</Badge><Badge tone="info">{user.id}</Badge><Badge tone="neutral">Live HR record</Badge></div>
      </div>
      <div className="rf-assurance"><span className="rf-icon rf-icon--green"><ShieldCheck aria-hidden="true" /></span><div><strong>Verified employment profile</strong><p>HR manages your employment details. Approved updates appear here automatically.</p></div></div>
    </section>

    <div className="rf-profile rf-profile-grid">
      <section className="rf-card" aria-labelledby="profile-employment-title">
        <header className="rf-card-head"><span className="rf-icon"><BriefcaseBusiness aria-hidden="true" /></span><div><h2 id="profile-employment-title">Employment information</h2><p>Read-only. Contact HR through Request Center if something is incorrect.</p></div><Badge tone="neutral">HR managed</Badge></header>
        <dl className="rf-details">
          {[
            ['Employee ID', user.id],
            ['Work email', user.email],
            ['Legal name', [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')],
            ['Preferred name', user.preferredName || '—'],
            ['Department', user.department],
            ['Position', user.position],
            ['Employment type', user.employmentType],
            ['Work arrangement', user.workArrangement],
            ['Work location', user.workLocation],
            ['Hire date', formatDate(user.hireDate)],
            ['Cost center', user.costCenter || '—'],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}
        </dl>
      </section>

      <div className="rf-profile-side">
        <form className="rf-card" onSubmit={requestSave} aria-labelledby="profile-contact-title">
          <header className="rf-card-head"><span className="rf-icon"><Phone aria-hidden="true" /></span><div><h2 id="profile-contact-title">Contact details</h2><p>Keep your phone number up to date so HR can reach you.</p></div></header>
          <div className="rf-card-body">
            <label className="rf-field">
              <span className="rf-label-row"><span className="rf-label">Phone number</span>{editing ? <span className="rf-status rf-status--editing">Editing</span> : currentPhone && <span className="rf-status">On file</span>}</span>
              <input ref={phoneInput} type="tel" autoComplete="tel" aria-label="Phone number" value={editing ? form.phone : user.phone ?? ''} minLength={7} maxLength={30} onChange={(event) => setForm({ phone: event.target.value })} placeholder={editing ? '+63 912 345 6789' : 'Not provided'} disabled={!editing || phoneSaving} required />
            </label>
            {editing
              ? <div className="rf-actions"><button type="button" className="button button-secondary" onClick={cancelEditing} disabled={phoneSaving}>Cancel</button><button type="submit" className="button button-primary" disabled={phoneSaving || !phoneChanged}>{phoneSaving ? 'Saving…' : 'Save changes'}</button></div>
              : <p className="rf-help">To change it, select <strong>Edit profile</strong> at the top of this page.</p>}
          </div>
        </form>

        <section className="rf-card" aria-labelledby="profile-privacy-title">
          <header className="rf-card-head"><span className="rf-icon rf-icon--green"><ShieldCheck aria-hidden="true" /></span><div><h2 id="profile-privacy-title">Privacy &amp; access</h2><p>Your photo is stored privately. Only authorized HR roles can change your employment record.</p></div></header>
          <ul className="rf-feature-list"><li><Camera aria-hidden="true" />Private photo storage</li><li><Mail aria-hidden="true" />Verified work email</li><li><ShieldCheck aria-hidden="true" />Every profile change is logged</li></ul>
        </section>

        <section className="rf-card rf-sync" aria-label="Profile sync status"><span className="rf-icon"><RefreshCw aria-hidden="true" /></span><div><strong>Automatic updates</strong><p>Changes approved by HR appear here without refreshing.</p></div><Badge tone="success">Connected</Badge></section>
      </div>
    </div>
    {confirmingSave && <Modal title="Confirm profile changes" onClose={() => setConfirmingSave(false)} dismissible={!phoneSaving}><div className="profile-save-confirmation"><span className="profile-save-confirmation-icon"><ShieldCheck /></span><div className="profile-save-confirmation-copy"><small>Employee-managed information</small><h3>Save this phone number?</h3><p>Only your contact number will change. Your identity and employment record remain protected and read-only.</p></div><dl><div><dt>Current</dt><dd>{currentPhone || 'Not provided'}</dd></div><span aria-hidden="true">→</span><div><dt>New</dt><dd>{nextPhone}</dd></div></dl><div className="profile-save-assurance"><ShieldCheck /><span><strong>Secure Supabase update</strong><small>This change is restricted to your signed-in employee account and recorded in the audit trail.</small></span></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setConfirmingSave(false)} disabled={phoneSaving}>Keep editing</button><button type="button" className="button button-primary" onClick={confirmSave} disabled={phoneSaving}>{phoneSaving ? 'Saving securely…' : 'Confirm & save'}</button></div></div></Modal>}
    {photoEditorUrl && <Modal title="Crop your profile picture" onClose={closePhotoEditor} size="large" dismissible={!photoSaving}><ProfilePhotoEditor sourceUrl={photoEditorUrl} saving={photoSaving} onCancel={closePhotoEditor} onSave={savePhoto} /></Modal>}
  </div>
}
