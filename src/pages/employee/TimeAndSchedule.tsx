import { useMemo, useState } from 'react'
import { useNow } from '../../utils/useNow.js'
import { CalendarDays, Clock3, MapPin, MessageSquareText, Timer, TriangleAlert } from 'lucide-react'
import { Badge, SectionHeading, StatCard, Tabs } from '../../components/ui.js'
import { tabPanelProps } from '../../components/tabPanel.js'
import { DataTable, type DataColumn } from '../../components/DataTable.js'
import { MonthCalendar, type CalendarEvent } from '../../components/MonthCalendar.js'
import { datesBetween, monthOf } from '../../utils/calendar.js'
import { useHrms } from '../../state/useHrms.js'
import { attendanceForClock, businessDate } from '../../utils/securityMetrics.js'
import { formatClock, formatDate, formatDateLong, formatShift, formatTime, formatWeekday, statusTone } from '../../utils/format.js'
import { philippineHolidays } from '../../utils/holidays.js'
import type { AttendanceRecord } from '../../types/hrms.js'
import type { NavigateProps } from './shared.js'

type View = 'history' | 'calendar'
const periods = [
  { id: 'month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: '90', label: 'Last 90 days' },
  { id: 'all', label: 'All time' },
] as const

export function TimeAndSchedule({ onNavigate, view: requestedView }: NavigateProps & { view?: string | null }) {
  const { data, user, clock } = useHrms()
  const now = useNow()
  const today = businessDate(now)
  const [view, setView] = useState<View>(requestedView === 'calendar' ? 'calendar' : 'history')
  const [month, setMonth] = useState(monthOf(today))
  const [period, setPeriod] = useState<typeof periods[number]['id']>('month')
  const history = useMemo(() => data?.attendance.filter((item) => item.employeeId === user?.id) ?? [], [data?.attendance, user?.id])
  if (!data || !user) return null
  const current = attendanceForClock(data.attendance, user.id, now)
  const schedule = data.schedules.filter((item) => item.employeeId === user.id)
  const currentSchedule = schedule.find((item) => item.date === today)
  const working = Boolean(current?.clockIn && !current?.clockOut)
  const restDay = currentSchedule?.workMode === 'Rest Day'
  const clockNow = async () => { try { await clock(user.id) } catch { /* Toast handles it. */ } }

  const thisMonth = today.slice(0, 7)
  const lastMonthDate = new Date(`${thisMonth}-01T00:00:00Z`)
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1)
  const lastMonth = lastMonthDate.toISOString().slice(0, 7)
  const ninetyDaysAgo = new Date(new Date(`${today}T00:00:00Z`).getTime() - 89 * 86_400_000).toISOString().slice(0, 10)
  const periodRows = history.filter((item) => period === 'all' ? true
    : period === 'month' ? item.date.startsWith(thisMonth)
      : period === 'last-month' ? item.date.startsWith(lastMonth)
        : item.date >= ninetyDaysAgo)
  const totalHours = periodRows.reduce((sum, item) => sum + item.hours, 0)
  const lateCount = periodRows.filter((item) => item.status === 'Late').length
  const upcoming = schedule.filter((item) => item.date >= today && item.workMode !== 'Rest Day').length

  const myLeave = data.leaveRequests.filter((item) => item.employeeId === user.id && ['Approved', 'Pending'].includes(item.status))
  const year = Number(month.slice(0, 4))
  const events: CalendarEvent[] = [
    ...schedule.map((item) => ({ date: item.date, label: item.workMode === 'Rest Day' ? 'Rest day' : formatShift(item.shiftStart, item.shiftEnd), detail: item.workMode === 'Rest Day' ? undefined : `${item.workMode} · ${item.location}`, tone: item.workMode === 'Rest Day' ? 'neutral' as const : 'blue' as const })),
    ...myLeave.flatMap((item) => datesBetween(item.startDate, item.endDate).map((date) => ({ date, label: `${item.type} leave`, detail: item.status, tone: item.status === 'Approved' ? 'green' as const : 'amber' as const }))),
    ...[...philippineHolidays(year - 1), ...philippineHolidays(year), ...philippineHolidays(year + 1)].map((holiday) => ({ date: holiday.date, label: holiday.name, detail: holiday.kind, tone: 'purple' as const })),
    ...history.filter((item) => item.status === 'Late').map((item) => ({ date: item.date, label: 'Late', detail: `Clocked in ${formatTime(item.clockIn)}`, tone: 'red' as const })),
  ]

  const columns: DataColumn<AttendanceRecord>[] = [
    { id: 'date', header: 'Date', primary: true, cell: (item) => <span className="cell-stack"><strong>{formatDate(item.date)}</strong><small>{formatWeekday(item.date)}</small></span>, sortValue: (item) => item.date },
    { id: 'in', header: 'Clock in', cell: (item) => formatTime(item.clockIn), sortValue: (item) => item.clockIn ?? '', csv: (item) => item.clockIn ?? '' },
    { id: 'out', header: 'Clock out', cell: (item) => item.clockOut ? formatTime(item.clockOut) : item.clockIn ? <Badge tone="info">In progress</Badge> : '—', sortValue: (item) => item.clockOut ?? '', csv: (item) => item.clockOut ?? '' },
    { id: 'hours', header: 'Hours', align: 'end', cell: (item) => item.hours.toFixed(1), sortValue: (item) => item.hours },
    { id: 'status', header: 'Status', cell: (item) => <Badge tone={statusTone(item.status)}>{item.status}</Badge>, sortValue: (item) => item.status },
  ]

  return <div className="page-stack">
    <SectionHeading
      title="Time & Schedule"
      description="Clock in and out, check your shifts, and review your attendance."
      actions={<button className="button button-secondary" onClick={() => onNavigate('requests?new=Attendance%20Correction')}><MessageSquareText aria-hidden="true" />Request a correction</button>}
    />

    <section className="panel clock-card" aria-label="Clock in and out">
      <div className="clock-card-time">
        <span>Current time</span>
        <strong>{formatClock(now)}</strong>
        <p>{formatDateLong(today)}</p>
      </div>
      <div className="clock-card-status">
        <span className={`clock-card-icon${working ? ' is-working' : ''}`}><Clock3 aria-hidden="true" /></span>
        <div>
          <strong>{working ? 'You are clocked in' : current?.clockOut ? 'Workday complete' : restDay ? 'Rest day' : 'Not clocked in yet'}</strong>
          <p>{current?.clockIn
            ? `In ${formatTime(current.clockIn)}${current.clockOut ? ` · Out ${formatTime(current.clockOut)}` : ''}`
            : currentSchedule && !restDay ? `Shift ${formatShift(currentSchedule.shiftStart, currentSchedule.shiftEnd)} · ${currentSchedule.location}` : 'No shift is assigned for today.'}</p>
        </div>
      </div>
      <button className={`button ${working ? 'button-danger' : 'button-primary'} button-large`} onClick={clockNow} disabled={Boolean(current?.clockOut) || (restDay && !working)}>
        {working ? 'Clock out' : current?.clockOut ? 'Workday complete' : 'Clock in'}
      </button>
    </section>

    <div className="stats-grid stats-grid-4">
      <StatCard icon={Timer} label="Hours this period" value={`${totalHours.toFixed(1)} hrs`} detail={periods.find((item) => item.id === period)?.label} tone="blue" />
      <StatCard icon={CalendarDays} label="Days worked" value={periodRows.filter((item) => item.clockIn).length} detail={periods.find((item) => item.id === period)?.label} tone="green" />
      <StatCard icon={TriangleAlert} label="Late arrivals" value={lateCount} detail={periods.find((item) => item.id === period)?.label} tone="amber" />
      <StatCard icon={MapPin} label="Upcoming shifts" value={upcoming} detail={currentSchedule ? `Today: ${currentSchedule.workMode}` : 'Nothing assigned today'} tone="purple" />
    </div>

    <section className="panel">
      <div className="panel-header panel-header-tabs">
        <Tabs idPrefix="time-view" label="Time views" tabs={[{ id: 'history', label: 'Attendance history' }, { id: 'calendar', label: 'Calendar' }]} active={view} onChange={setView} />
      </div>
      <div {...tabPanelProps('time-view', view)} className="tab-panel">
        {view === 'history' && <DataTable
          rows={periodRows}
          columns={columns}
          getRowId={(item) => item.id}
          caption="Attendance history"
          count={{ singular: 'day', plural: 'days' }}
          initialSort={{ column: 'date', direction: 'desc' }}
          exportName={`my-attendance-${period}`}
          toolbar={<label className="data-table-filter"><span className="sr-only">Period</span><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
          filters={[{ id: 'status', label: 'Statuses', value: (item) => item.status }]}
          empty={{ icon: Clock3, title: period === 'all' ? 'No attendance yet' : 'No attendance in this period', text: period === 'all' ? 'Your clock-ins will appear here after your first shift.' : 'Choose a different period to see older records.', action: period === 'all' ? undefined : <button type="button" className="button button-secondary button-small" onClick={() => setPeriod('all')}>Show all time</button> }}
        />}
        {view === 'calendar' && <MonthCalendar
          month={month}
          today={today}
          events={events}
          onMonthChange={setMonth}
          caption="Your schedule, leave, and holidays"
          legend={[{ tone: 'blue', label: 'Shift' }, { tone: 'green', label: 'Approved leave' }, { tone: 'amber', label: 'Pending leave' }, { tone: 'purple', label: 'Holiday' }, { tone: 'red', label: 'Late' }]}
        />}
      </div>
    </section>
  </div>
}
