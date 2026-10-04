import { BookOpenCheck, CalendarDays, CalendarHeart, CheckCircle2, ChevronRight, Clock3, FileCheck2, FolderLock, Inbox, MapPin, MessageSquareText, ReceiptText, UserRound } from 'lucide-react'
import { Badge, EmptyState, SectionHeading, StatCard } from '../../components/ui.js'
import { useHrms } from '../../state/useHrms.js'
import { attendanceForClock, businessDate } from '../../utils/securityMetrics.js'
import { formatDate, formatDateLong, formatShift, formatTime, formatWeekday, greetingFor } from '../../utils/format.js'
import { holidayOn, upcomingHolidays } from '../../utils/holidays.js'
import { datesBetween } from '../../utils/calendar.js'
import { openRequestStatuses, type NavigateProps } from './shared.js'
import { balanceFor, formatLeaveDays, leaveBalances, leavePoliciesOf } from '../../utils/leave.js'

export function MyDay({ onNavigate }: NavigateProps) {
  const { data, user, clock } = useHrms()
  if (!data || !user) return null
  const today = businessDate()
  const attendance = attendanceForClock(data.attendance, user.id)
  const mySchedules = data.schedules.filter((item) => item.employeeId === user.id)
  const schedule = mySchedules.find((item) => item.date === today)
  const leaves = data.leaveRequests.filter((item) => item.employeeId === user.id)
  const requests = data.employeeRequests.filter((item) => item.employeeId === user.id)
  const unread = data.notifications.filter((item) => item.employeeId === user.id && !item.readAt)
  const acknowledgements = new Set(data.documentAcknowledgements.filter((item) => item.employeeId === user.id).map((item) => item.documentId))
  const requiredDocuments = data.documents.filter((item) => item.requiresAck && !acknowledgements.has(item.id) && (!item.employeeId || item.employeeId === user.id))
  const needsInfo = requests.filter((item) => item.status === 'More Information')
  const actionCount = unread.length + requiredDocuments.length + needsInfo.length
  const me = data.employees.find((item) => item.id === user.id)
  const manager = me?.managerId ? data.employees.find((item) => item.id === me.managerId) : undefined
  const pendingDays = leaves.filter((item) => item.status === 'Pending').reduce((sum, item) => sum + item.days, 0)
  const vacationLeft = balanceFor(leaveBalances(leavePoliciesOf(data), data.leaveRequests, user.id, today.slice(0, 4)), 'Vacation')?.remaining
  const working = Boolean(attendance?.clockIn && !attendance?.clockOut)
  const restDay = schedule?.workMode === 'Rest Day'
  const weekStart = (() => {
    const date = new Date(`${today}T00:00:00Z`)
    const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86_400_000)
    return monday.toISOString().slice(0, 10)
  })()
  const week = datesBetween(weekStart, new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10))
  const holidays = upcomingHolidays(today, 3)
  const onLeaveToday = leaves.find((item) => item.status === 'Approved' && item.startDate <= today && item.endDate >= today)

  const clockNow = async () => {
    try { await clock(user.id) } catch { /* The shared toast explains the database response. */ }
  }

  return (
    <div className="page-stack employee-dashboard">
      <SectionHeading
        title={`${greetingFor()}, ${user.preferredName || user.firstName}`}
        description={formatDateLong(today)}
      />

      <div className="my-day-top">
        <section className="panel today-card" aria-labelledby="today-title">
          <div className="panel-header">
            <div><h2 id="today-title">Today</h2><p>{schedule ? (restDay ? 'Rest day' : `${schedule.workMode} shift`) : onLeaveToday ? `${onLeaveToday.type} leave` : 'No shift assigned'}</p></div>
            <Badge tone={working ? 'success' : attendance?.clockOut ? 'neutral' : 'info'}>{working ? 'Clocked in' : attendance?.clockOut ? 'Day complete' : 'Not clocked in'}</Badge>
          </div>
          <dl className="today-facts">
            <div><dt><Clock3 aria-hidden="true" />Shift</dt><dd>{schedule && !restDay ? formatShift(schedule.shiftStart, schedule.shiftEnd) : '—'}</dd></div>
            <div><dt><MapPin aria-hidden="true" />Location</dt><dd>{schedule && !restDay ? schedule.location : '—'}</dd></div>
            <div><dt><CheckCircle2 aria-hidden="true" />Clock in</dt><dd>{formatTime(attendance?.clockIn)}</dd></div>
            <div><dt><CheckCircle2 aria-hidden="true" />Clock out</dt><dd>{formatTime(attendance?.clockOut)}</dd></div>
          </dl>
          <div className="today-actions">
            <button className={`button ${working ? 'button-danger' : 'button-primary'} button-large`} onClick={clockNow} disabled={Boolean(attendance?.clockOut) || (restDay && !working)}>
              <Clock3 size={18} aria-hidden="true" />{working ? 'Clock out' : attendance?.clockOut ? 'Day complete' : 'Clock in'}
            </button>
            <button type="button" className="text-button" onClick={() => onNavigate('schedule')}>View timesheet</button>
          </div>
        </section>

        <section className="panel week-card" aria-labelledby="week-title">
          <div className="panel-header"><div><h2 id="week-title">This week</h2><p>Your assigned shifts</p></div><button type="button" className="text-button" onClick={() => onNavigate('schedule?view=calendar')}>Calendar</button></div>
          <ol className="week-list">
            {week.map((date) => {
              const item = mySchedules.find((entry) => entry.date === date)
              const leave = leaves.find((entry) => ['Approved', 'Pending'].includes(entry.status) && entry.startDate <= date && entry.endDate >= date)
              const holiday = holidayOn(date)
              return <li key={date} className={date === today ? 'is-today' : undefined}>
                <span className="week-day"><strong>{formatWeekday(date)}</strong><small>{Number(date.slice(8))}</small></span>
                <span className="week-detail">
                  {leave ? <><strong>{leave.type} leave</strong><small>{leave.status}</small></>
                    : holiday ? <><strong>{holiday.name}</strong><small>{holiday.kind}</small></>
                      : item ? <><strong>{item.workMode === 'Rest Day' ? 'Rest day' : formatShift(item.shiftStart, item.shiftEnd)}</strong><small>{item.workMode === 'Rest Day' ? 'No shift' : `${item.workMode} · ${item.location}`}</small></>
                        : <><strong className="is-muted">No shift</strong><small>Not scheduled</small></>}
                </span>
                {date === today && <Badge tone="info">Today</Badge>}
              </li>
            })}
          </ol>
        </section>
      </div>

      <div className="stats-grid stats-grid-4">
        <StatCard icon={CalendarDays} label="Vacation leave left" value={vacationLeft == null ? '—' : formatLeaveDays(vacationLeft)} detail={pendingDays ? `${pendingDays} day${pendingDays === 1 ? '' : 's'} pending approval` : 'No pending requests'} tone="green" onClick={() => onNavigate('leave')} />
        <StatCard icon={FileCheck2} label="Open requests" value={requests.filter((item) => openRequestStatuses.includes(item.status)).length} detail={needsInfo.length ? `${needsInfo.length} waiting for your reply` : 'With HR'} tone="amber" onClick={() => onNavigate('requests')} />
        <StatCard icon={Inbox} label="Unread notifications" value={unread.length} detail="In your inbox" tone="purple" onClick={() => onNavigate('inbox')} />
        <StatCard icon={BookOpenCheck} label="To acknowledge" value={requiredDocuments.length} detail={requiredDocuments.length ? 'Policies waiting for you' : 'All acknowledged'} tone="blue" onClick={() => onNavigate('documents')} />
      </div>

      <div className="content-grid dashboard-grid">
        <section className="panel" aria-labelledby="attention-title">
          <div className="panel-header"><div><h2 id="attention-title">Needs your attention</h2><p>Requests and updates waiting for you</p></div><Badge tone={actionCount ? 'warning' : 'success'}>{actionCount ? `${actionCount} open` : 'All clear'}</Badge></div>
          <div className="action-list">
            {needsInfo.map((item) => <button key={`request-${item.id}`} onClick={() => onNavigate(`requests?request=${encodeURIComponent(item.id)}`)}><span className="action-icon tone-amber"><MessageSquareText /></span><span className="action-text"><strong>HR needs more information</strong><small>{item.subject}</small></span><Badge tone="warning">Reply</Badge><ChevronRight aria-hidden="true" /></button>)}
            {requiredDocuments.map((item) => <button key={`document-${item.id}`} onClick={() => onNavigate(`documents?doc=${encodeURIComponent(item.id)}`)}><span className="action-icon tone-blue"><BookOpenCheck /></span><span className="action-text"><strong>Read and acknowledge</strong><small>{item.title} · Version {item.version}</small></span><Badge tone="info">Review</Badge><ChevronRight aria-hidden="true" /></button>)}
            {unread.slice(0, 3).map((item) => <button key={`notification-${item.id}`} onClick={() => onNavigate('inbox')}><span className="action-icon tone-purple"><Inbox /></span><span className="action-text"><strong>{item.title}</strong><small>{item.message}</small></span><Badge tone="neutral">New</Badge><ChevronRight aria-hidden="true" /></button>)}
            {actionCount === 0 && <EmptyState compact icon={CheckCircle2} title="You’re all caught up" text="New HR replies, decisions, and policies to acknowledge will appear here." />}
          </div>
        </section>

        <div className="side-stack">
          <section className="panel" aria-labelledby="quick-title">
            <div className="panel-header"><div><h2 id="quick-title">Quick actions</h2></div></div>
            <div className="quick-links">
              <button onClick={() => onNavigate('leave?new=1')}><CalendarDays aria-hidden="true" /><span>Request leave</span><ChevronRight aria-hidden="true" /></button>
              <button onClick={() => onNavigate('requests?new=General%20HR')}><FileCheck2 aria-hidden="true" /><span>Ask HR a question</span><ChevronRight aria-hidden="true" /></button>
              <button onClick={() => onNavigate('pay')}><ReceiptText aria-hidden="true" /><span>View my payslips</span><ChevronRight aria-hidden="true" /></button>
              <button onClick={() => onNavigate('documents')}><FolderLock aria-hidden="true" /><span>Open documents</span><ChevronRight aria-hidden="true" /></button>
            </div>
          </section>

          <section className="panel" aria-labelledby="holidays-title">
            <div className="panel-header"><div><h2 id="holidays-title">Upcoming holidays</h2><p>Philippine national holidays</p></div><CalendarHeart className="panel-header-icon" aria-hidden="true" /></div>
            <ul className="holiday-list">{holidays.map((holiday) => <li key={holiday.date}><span><strong>{holiday.name}</strong><small>{holiday.kind}</small></span><time dateTime={holiday.date}>{formatDate(holiday.date)}</time></li>)}</ul>
          </section>

          {manager && <section className="panel" aria-labelledby="manager-title">
            <div className="panel-header"><div><h2 id="manager-title">Your manager</h2></div></div>
            <div className="person-line"><span className="person-line-icon"><UserRound aria-hidden="true" /></span><span><strong>{manager.preferredName || manager.firstName} {manager.lastName}</strong><small>{manager.position}</small></span></div>
          </section>}
        </div>
      </div>

      <section className="panel" aria-labelledby="updates-title">
        <div className="panel-header"><div><h2 id="updates-title">Company updates</h2><p>Recent announcements from HR</p></div></div>
        {data.announcements.length
          ? <div className="announcement-list horizontal-announcements">{data.announcements.slice(0, 3).map((announcement) => <article key={announcement.id}><div><Badge tone={announcement.priority === 'High' ? 'warning' : 'info'}>{announcement.priority === 'High' ? 'Important' : 'Update'}</Badge><time>{formatDate(announcement.date)}</time></div><strong>{announcement.title}</strong><p>{announcement.content}</p></article>)}</div>
          : <EmptyState compact icon={Inbox} title="No announcements yet" text="Company news from HR will appear here." />}
      </section>
    </div>
  )
}
