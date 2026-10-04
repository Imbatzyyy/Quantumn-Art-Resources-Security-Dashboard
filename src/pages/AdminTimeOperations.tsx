import { useState, type FormEvent } from 'react'
import { CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Copy, Plus, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Badge, ConfirmDialog, EmptyState, Modal, SectionHeading, StatCard, Tabs } from '../components/ui.js'
import { tabPanelProps } from '../components/tabPanel.js'
import { DataTable, type DataColumn } from '../components/DataTable.js'
import { Field, FormFooter, FormIntro, Note, PersonCard, SummaryList } from '../components/readable.js'
import { datesBetween } from '../utils/calendar.js'
import { useSubmissionLock } from '../utils/useSubmissionLock.js'
import { useHrms } from '../state/useHrms.js'
import { businessDate } from '../utils/securityMetrics.js'
import { formatDate, formatShift, formatTime, formatWeekday, statusTone } from '../utils/format.js'
import { holidayOn } from '../utils/holidays.js'
import type { AttendanceRecord, HrmsSnapshot, ScheduleInput } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const workModes = [
  { value: 'On-site', label: 'On-site', detail: 'Works from the office' },
  { value: 'Remote', label: 'Remote', detail: 'Approved remote workspace' },
  { value: 'Hybrid', label: 'Hybrid', detail: 'Office and remote' },
  { value: 'Rest Day', label: 'Rest day', detail: 'No shift on this date' },
]
const weekdays = [{ day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' }, { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' }, { day: 0, label: 'Sun' }]
const MAX_BATCH = 31
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}
const addDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)
const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7))

export default function AdminTimeOperations({ onNavigate }: { onNavigate?: (target: string) => void }) {
  const submission = useSubmissionLock()
  const { data, saveSchedule, saveSchedules } = useHrms()
  const today = businessDate()
  const [view, setView] = useState<'today' | 'roster' | 'exceptions'>('today')
  const [weekStart, setWeekStart] = useState(() => mondayOf(today))
  const [showSchedule, setShowSchedule] = useState(false)
  const [copyWeek, setCopyWeek] = useState(false)
  const [progress, setProgress] = useState('')
  const defaultEmployee = data?.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const [form, setForm] = useState<ScheduleInput>({ employeeId: defaultEmployee, date: today, shiftStart: '08:00', shiftEnd: '17:00', location: 'Main Office', workMode: 'On-site', notes: '' })
  const [repeat, setRepeat] = useState({ enabled: false, until: addDays(today, 6), days: [1, 2, 3, 4, 5] })
  if (!data) return null

  const activeEmployees = data.employees.filter((item) => item.role === 'employee' && item.status === 'Active')
  const todayRecords = data.attendance.filter((item) => item.date === today)
  const missingOut = todayRecords.filter((item) => item.clockIn && !item.clockOut)
  const exceptionRequests = data.employeeRequests.filter((item) => ['Attendance Correction', 'Overtime', 'Schedule Change'].includes(item.type) && openRequestStatuses.includes(item.status))
  const scheduledToday = data.schedules.filter((item) => item.date === today && item.workMode !== 'Rest Day')
  const notClockedIn = scheduledToday.filter((item) => !todayRecords.some((record) => record.employeeId === item.employeeId && record.clockIn))
  const selectedEmployee = data.employees.find((item) => item.id === form.employeeId)
  const isRestDay = form.workMode === 'Rest Day'
  const timeToMinutes = (value: string) => {
    const [hours = 0, minutes = 0] = value.split(':').map(Number)
    return hours * 60 + minutes
  }
  const shiftMinutes = isRestDay ? 0 : (timeToMinutes(form.shiftEnd) - timeToMinutes(form.shiftStart) + 1440) % 1440
  const durationLabel = isRestDay ? 'Rest day' : `${Math.floor(shiftMinutes / 60)}h ${shiftMinutes % 60 ? `${shiftMinutes % 60}m` : ''}`.trim()
  const targetDates = repeat.enabled
    ? datesBetween(form.date, repeat.until, 120).filter((date) => repeat.days.includes(new Date(`${date}T00:00:00Z`).getUTCDay()))
    : [form.date]
  const existingCount = targetDates.filter((date) => data.schedules.some((item) => item.employeeId === form.employeeId && item.date === date)).length
  const tooMany = targetDates.length > MAX_BATCH
  const weekDates = datesBetween(weekStart, addDays(weekStart, 6))
  const previousWeek = data.schedules.filter((item) => item.date >= addDays(weekStart, -7) && item.date < weekStart)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!targetDates.length || tooMany || !submission.begin()) return
    try {
      if (targetDates.length === 1) await saveSchedule({ ...form, date: targetDates[0] })
      else if (saveSchedules) await saveSchedules(targetDates.map((date) => ({ ...form, date })))
      else {
        for (const [index, date] of targetDates.entries()) {
          setProgress(`Saving ${index + 1} of ${targetDates.length}…`)
          await saveSchedule({ ...form, date })
        }
      }
      setShowSchedule(false)
    } catch { /* Preserve server-validated input. */ } finally { setProgress(''); submission.finish() }
  }
  const copyPreviousWeek = async () => {
    const copies = previousWeek.map((item) => ({ employeeId: item.employeeId, date: addDays(item.date, 7), shiftStart: item.shiftStart, shiftEnd: item.shiftEnd, location: item.location, workMode: item.workMode, notes: item.notes ?? '' }))
    if (saveSchedules) await saveSchedules(copies)
    else for (const copy of copies) await saveSchedule(copy)
    setCopyWeek(false)
  }
  const openAssign = (employeeId?: string, date?: string) => {
    setForm((current) => ({ ...current, employeeId: employeeId ?? current.employeeId, date: date ?? current.date }))
    setRepeat((current) => ({ ...current, enabled: false }))
    setShowSchedule(true)
  }

  const attendanceColumns: DataColumn<AttendanceRecord>[] = [
    { id: 'employee', header: 'Employee', primary: true, cell: (item) => <span className="cell-stack"><strong>{personName(data, item.employeeId)}</strong><small>{item.employeeId}</small></span>, sortValue: (item) => personName(data, item.employeeId) },
    { id: 'in', header: 'Clock in', cell: (item) => formatTime(item.clockIn), sortValue: (item) => item.clockIn ?? '' },
    { id: 'out', header: 'Clock out', cell: (item) => item.clockOut ? formatTime(item.clockOut) : <Badge tone="info">Working</Badge>, sortValue: (item) => item.clockOut ?? '' },
    { id: 'hours', header: 'Hours', align: 'end', cell: (item) => item.hours.toFixed(1), sortValue: (item) => item.hours },
    { id: 'status', header: 'Status', cell: (item) => <Badge tone={statusTone(item.status)}>{item.status}</Badge>, sortValue: (item) => item.status },
  ]

  return <div className="page-stack">
    <SectionHeading
      title="Time & Attendance"
      description="Today’s attendance, the weekly roster, and correction requests."
      actions={<button className="button button-primary" onClick={() => openAssign()}><Plus aria-hidden="true" />Assign shifts</button>}
    />
    <div className="stats-grid stats-grid-4">
      <StatCard icon={CheckCircle2} label="Clocked in today" value={scheduledToday.length ? `${todayRecords.filter((item) => item.clockIn).length} of ${scheduledToday.length}` : todayRecords.filter((item) => item.clockIn).length} detail="Against scheduled shifts" tone="green" />
      <StatCard icon={Clock3} label="Late arrivals" value={todayRecords.filter((item) => item.status === 'Late').length} detail="Today" tone="amber" />
      <StatCard icon={CalendarClock} label="Still working" value={missingOut.length} detail="Clocked in, not yet out" tone="purple" />
      <StatCard icon={TriangleAlert} label="Correction requests" value={exceptionRequests.length} detail="Waiting for review" tone="red" onClick={() => setView('exceptions')} />
    </div>

    <section className="panel">
      <div className="panel-header panel-header-tabs">
        <Tabs idPrefix="time-admin" label="Time and attendance views" tabs={[{ id: 'today', label: 'Today' }, { id: 'roster', label: 'Weekly roster' }, { id: 'exceptions', label: 'Corrections', count: exceptionRequests.length || undefined }]} active={view} onChange={setView} />
      </div>
      <div {...tabPanelProps('time-admin', view)} className="tab-panel">
        {view === 'today' && <>
          {notClockedIn.length > 0 && <div className="notice-bar notice-bar-warning" role="status"><TriangleAlert aria-hidden="true" /><p><strong>{notClockedIn.length} scheduled employee{notClockedIn.length === 1 ? ' has' : 's have'} not clocked in:</strong> {notClockedIn.slice(0, 4).map((item) => personName(data, item.employeeId)).join(', ')}{notClockedIn.length > 4 ? ` and ${notClockedIn.length - 4} more` : ''}.</p></div>}
          <DataTable
            rows={todayRecords}
            columns={attendanceColumns}
            getRowId={(item) => item.id}
            caption="Today’s attendance"
            count={{ singular: 'employee', plural: 'employees' }}
            search={{ placeholder: 'Search employees', text: (item) => `${personName(data, item.employeeId)} ${item.employeeId}` }}
            filters={[{ id: 'status', label: 'Statuses', value: (item) => item.status }]}
            initialSort={{ column: 'in', direction: 'asc' }}
            exportName={`attendance-${today}`}
            empty={{ icon: Clock3, title: 'No one has clocked in yet today', text: 'Clock-ins appear here as employees start their shifts.' }}
          />
        </>}

        {view === 'roster' && <div className="roster">
          <div className="roster-toolbar">
            <div className="roster-week">
              <button type="button" className="icon-button" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={18} /></button>
              <strong aria-live="polite">{formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}</strong>
              <button type="button" className="icon-button" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight size={18} /></button>
              <button type="button" className="button button-secondary button-small" onClick={() => setWeekStart(mondayOf(today))} disabled={weekStart === mondayOf(today)}>This week</button>
            </div>
            <button type="button" className="button button-secondary button-small" onClick={() => setCopyWeek(true)} disabled={!previousWeek.length}><Copy size={16} aria-hidden="true" />Copy previous week</button>
          </div>
          {activeEmployees.length ? <div className="table-shell roster-table">
            <table>
              <caption className="sr-only">Weekly roster from {formatDate(weekStart)}</caption>
              <thead><tr><th scope="col">Employee</th>{weekDates.map((date) => <th scope="col" key={date} className={date === today ? 'is-today' : undefined}><span>{formatWeekday(date)}</span><small>{Number(date.slice(8))}{holidayOn(date) ? ' · Holiday' : ''}</small></th>)}</tr></thead>
              <tbody>{activeEmployees.map((employee) => <tr key={employee.id}>
                <th scope="row"><span className="cell-stack"><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.department}</small></span></th>
                {weekDates.map((date) => {
                  const shift = data.schedules.find((item) => item.employeeId === employee.id && item.date === date)
                  const leave = data.leaveRequests.find((item) => item.employeeId === employee.id && item.status === 'Approved' && item.startDate <= date && item.endDate >= date)
                  return <td key={date} className={date === today ? 'is-today' : undefined}>
                    <button type="button" className={`roster-cell${shift ? shift.workMode === 'Rest Day' ? ' is-rest' : ' is-shift' : ''}${leave ? ' is-leave' : ''}`} onClick={() => openAssign(employee.id, date)} aria-label={`${employee.firstName} ${employee.lastName}, ${formatDate(date)}: ${leave ? `${leave.type} leave` : shift ? shift.workMode === 'Rest Day' ? 'rest day' : `${formatShift(shift.shiftStart, shift.shiftEnd)}, ${shift.workMode}` : 'no shift'}. Edit shift.`}>
                      {leave ? <><strong>On leave</strong><small>{leave.type}</small></> : shift ? shift.workMode === 'Rest Day' ? <strong>Rest</strong> : <><strong>{formatTime(shift.shiftStart)}</strong><small>{shift.workMode}</small></> : <span className="roster-empty">+</span>}
                    </button>
                  </td>
                })}
              </tr>)}</tbody>
            </table>
          </div> : <EmptyState icon={CalendarDays} title="No active employees" text="Add employees in the People Directory to build a roster." />}
          <p className="form-note">Select any cell to add or change that day’s shift.</p>
        </div>}

        {view === 'exceptions' && <div className="action-list">
          {exceptionRequests.map((item) => <button key={item.id} type="button" onClick={() => onNavigate?.(`approvals?request=${encodeURIComponent(item.id)}`)}>
            <span className="queue-tag tone-warning">{item.type === 'Attendance Correction' ? 'Correction' : item.type}</span>
            <span className="action-text"><strong>{item.subject}</strong><small>{personName(data, item.employeeId)} · {formatDate(item.requestedDate)}{item.requestedValue ? ` · ${item.requestedValue}` : ''}</small></span>
            <Badge tone={statusTone(item.status)}>{item.status}</Badge>
            <ChevronRight aria-hidden="true" />
          </button>)}
          {!exceptionRequests.length && <EmptyState icon={CheckCircle2} title="No correction requests" text="Attendance corrections, overtime, and schedule changes from employees appear here." />}
        </div>}
      </div>
    </section>

    {showSchedule && <Modal title="Assign shifts" onClose={() => !submission.busy && setShowSchedule(false)} size="large" dismissible={!submission.busy}>
      <form className="rf-form" onSubmit={submit}>
        <FormIntro>Choose an employee and a date, then set how, when, and where they work. Repeat the shift to schedule several days at once. Existing shifts on those dates are updated.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            <Field label="Employee">{(control) => <select {...control} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{activeEmployees.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}</select>}</Field>
            {selectedEmployee && <PersonCard name={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`} meta={`${selectedEmployee.position || 'Position not set'} · ${selectedEmployee.department || 'Department not set'}`} badge={<Badge tone="success">Active</Badge>} />}

            <div className="rf-grid">
              <Field label={repeat.enabled ? 'First date' : 'Date'}>{(control) => <input {...control} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />}</Field>
              {repeat.enabled && <Field label="Repeat until">{(control) => <input {...control} type="date" min={form.date} value={repeat.until} onChange={(event) => setRepeat({ ...repeat, until: event.target.value })} required />}</Field>}
            </div>
            <label className="rf-choice rf-choice--plain"><input type="checkbox" checked={repeat.enabled} onChange={(event) => setRepeat({ ...repeat, enabled: event.target.checked })} /><span><strong>Repeat this shift</strong><small>Create the same shift on selected weekdays</small></span></label>
            {repeat.enabled && <fieldset className="rf-field">
              <legend className="rf-label">Repeat on</legend>
              <div className="rf-chips">{weekdays.map(({ day, label }) => <button type="button" key={day} aria-pressed={repeat.days.includes(day)} onClick={() => setRepeat({ ...repeat, days: repeat.days.includes(day) ? repeat.days.filter((item) => item !== day) : [...repeat.days, day] })}>{label}</button>)}</div>
            </fieldset>}

            <fieldset className="rf-field rf-choices rf-choices--2">
              <legend className="rf-label">Work mode</legend>
              <div>{workModes.map(({ value, label, detail }) => <label key={value} className={`rf-choice${form.workMode === value ? ' is-selected' : ''}`}>
                <input type="radio" name="work-mode" value={value} checked={form.workMode === value} onChange={(event) => setForm({ ...form, workMode: event.target.value })} />
                <span><strong>{label}</strong><small>{detail}</small></span>
              </label>)}</div>
            </fieldset>

            <div className="rf-grid">
              <Field label="Shift start">{(control) => <input {...control} type="time" value={form.shiftStart} onChange={(event) => setForm({ ...form, shiftStart: event.target.value })} disabled={isRestDay} required />}</Field>
              <Field label="Shift end">{(control) => <input {...control} type="time" value={form.shiftEnd} onChange={(event) => setForm({ ...form, shiftEnd: event.target.value })} disabled={isRestDay} required />}</Field>
            </div>

            <Field label="Location">{(control) => <input {...control} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} disabled={isRestDay} required />}</Field>
            <Field label="Notes" optional>{(control) => <textarea {...control} rows={3} maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="For example: covering the front desk in the afternoon" />}</Field>
          </div>

          <aside className="rf-summary" aria-label="Schedule summary">
            <h3>{isRestDay ? 'Rest day summary' : 'Shift summary'}</h3>
            <SummaryList items={[
              ['Employee', selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'Not selected'],
              [repeat.enabled ? 'Dates' : 'Date', repeat.enabled ? `${targetDates.length} day${targetDates.length === 1 ? '' : 's'} from ${formatDate(form.date)}` : formatDate(form.date)],
              ['Work mode', form.workMode],
              ['Hours', isRestDay ? 'No shift' : formatShift(form.shiftStart, form.shiftEnd)],
              ['Duration', durationLabel],
              ['Location', isRestDay ? 'Not scheduled' : form.location || 'Location needed'],
              ['Updates existing shifts', existingCount ? `${existingCount}` : 'None'],
            ]} />
            {tooMany && <p className="rf-error" role="alert">Choose at most {MAX_BATCH} days at a time.</p>}
            {repeat.enabled && !targetDates.length && <p className="rf-error" role="alert">No dates match. Choose at least one weekday inside the date range.</p>}
            <Note icon={ShieldCheck}>Employees see only their own schedule, as soon as you save.</Note>
          </aside>
        </div>

        <FormFooter note={progress || (targetDates.length > 1 ? `Saving creates or updates ${targetDates.length} shifts.` : 'Saving creates or updates one shift.')}>
          <button type="button" className="button button-secondary" onClick={() => setShowSchedule(false)} disabled={submission.busy}>Cancel</button>
          <button className="button button-primary" disabled={submission.busy || tooMany || !targetDates.length}><CalendarClock aria-hidden="true" />{submission.busy ? 'Saving…' : targetDates.length > 1 ? `Save ${targetDates.length} shifts` : 'Save shift'}</button>
        </FormFooter>
      </form>
    </Modal>}

    {copyWeek && <ConfirmDialog
      title="Copy previous week"
      icon={Copy}
      heading={`Copy ${previousWeek.length} shift${previousWeek.length === 1 ? '' : 's'} into this week?`}
      message={<p>Shifts from {formatDate(addDays(weekStart, -7))} – {formatDate(addDays(weekStart, -1))} are copied to {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}. Shifts already set on those dates are replaced. Employees see the changes right away.</p>}
      confirmLabel="Copy shifts"
      busyLabel="Copying…"
      onCancel={() => setCopyWeek(false)}
      onConfirm={copyPreviousWeek}
    />}
  </div>
}
