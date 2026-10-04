import { useState, type FormEvent } from 'react'
import { CalendarClock, CalendarDays, CheckCircle2, Clock3, Plus, ShieldCheck } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { Field, FormFooter, FormIntro, Note, PersonCard, SummaryList } from '../components/readable.js'
import { useSubmissionLock } from '../utils/useSubmissionLock.js'
import { useHrms } from '../state/useHrms.js'
import { businessDate } from '../utils/securityMetrics.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { HrmsSnapshot, ScheduleInput } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const workModes = [
  { value: 'On-site', label: 'On-site', detail: 'Works from the office' },
  { value: 'Remote', label: 'Remote', detail: 'Approved remote workspace' },
  { value: 'Hybrid', label: 'Hybrid', detail: 'Office and remote' },
  { value: 'Rest Day', label: 'Rest day', detail: 'No shift on this date' },
]
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminTimeOperations() {
  const submission = useSubmissionLock()
  const { data, saveSchedule } = useHrms()
  const [showSchedule, setShowSchedule] = useState(false)
  const today = businessDate()
  const defaultEmployee = data?.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const [form, setForm] = useState<ScheduleInput>({ employeeId: defaultEmployee, date: today, shiftStart: '08:00', shiftEnd: '17:00', location: 'Main Office', workMode: 'On-site', notes: '' })
  if (!data) return null

  const todayRecords = data.attendance.filter((item) => item.date === today)
  const missingOut = todayRecords.filter((item) => item.clockIn && !item.clockOut)
  const exceptionRequests = data.employeeRequests.filter((item) => ['Attendance Correction', 'Overtime', 'Schedule Change'].includes(item.type) && openRequestStatuses.includes(item.status))
  const scheduleCoverage = data.employees
    .filter((item) => item.role === 'employee' && item.status === 'Active')
    .filter((employee) => data.schedules.some((item) => item.employeeId === employee.id && item.date === today)).length
  const selectedEmployee = data.employees.find((item) => item.id === form.employeeId)
  const isRestDay = form.workMode === 'Rest Day'
  const existingSchedule = data.schedules.find((item) => item.employeeId === form.employeeId && item.date === form.date)
  const timeToMinutes = (value: string) => {
    const [hours = 0, minutes = 0] = value.split(':').map(Number)
    return hours * 60 + minutes
  }
  const shiftMinutes = isRestDay ? 0 : (timeToMinutes(form.shiftEnd) - timeToMinutes(form.shiftStart) + 1440) % 1440
  const durationLabel = isRestDay ? 'Rest day' : `${Math.floor(shiftMinutes / 60)}h ${shiftMinutes % 60 ? `${shiftMinutes % 60}m` : ''}`.trim()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!submission.begin()) return
    try { await saveSchedule(form); setShowSchedule(false) } catch { /* Preserve server-validated input. */ } finally { submission.finish() }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Exception-first operations" title="Time & Attendance" description="Monitor live attendance, assigned schedules, and correction requests without silently changing employee records." actions={<button className="button button-primary" onClick={() => setShowSchedule(true)}><Plus />Assign schedule</button>} />
    <div className="stats-grid stats-grid-4"><StatCard icon={CheckCircle2} label="Clocked in today" value={todayRecords.length} tone="green" /><StatCard icon={Clock3} label="Late arrivals" value={todayRecords.filter((item) => item.status === 'Late').length} tone="amber" /><StatCard icon={CalendarClock} label="Open time records" value={missingOut.length} detail="Clock-in without clock-out" tone="purple" /><StatCard icon={CalendarDays} label="Schedule coverage" value={scheduleCoverage} detail="Active employees today" tone="blue" /></div>
    <div className="content-grid content-grid-2"><section className="panel"><div className="panel-header"><div><h2>Today’s attendance</h2><p>Employee clock events from Supabase</p></div></div><TableShell><thead><tr><th>Employee</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>{todayRecords.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{item.clockIn ?? '—'}</td><td>{item.clockOut ?? 'Open'}</td><td>{item.hours.toFixed(1)}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></TableShell></section><section className="panel"><div className="panel-header"><div><h2>Time exceptions</h2><p>Employee-submitted corrections and schedule changes</p></div><Badge tone={exceptionRequests.length ? 'warning' : 'success'}>{exceptionRequests.length} open</Badge></div><div className="compact-record-list">{exceptionRequests.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><p>{personName(data, item.employeeId)} · {item.type} · {formatDate(item.requestedDate)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}{!exceptionRequests.length && <EmptyState icon={CheckCircle2} title="No time exceptions" text="Correction and schedule requests will appear here and in Approvals." />}</div></section></div>
    <section className="panel"><div className="panel-header"><div><h2>Upcoming schedule roster</h2><p>Next assigned shift per employee</p></div></div><TableShell><thead><tr><th>Employee</th><th>Date</th><th>Shift</th><th>Mode</th><th>Location</th></tr></thead><tbody>{data.schedules.filter((item) => item.date >= today).slice(0, 20).map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong></td><td>{formatDate(item.date)}</td><td>{item.workMode === 'Rest Day' ? 'Rest day' : `${item.shiftStart}–${item.shiftEnd}`}</td><td><Badge tone={item.workMode === 'Rest Day' ? 'neutral' : 'info'}>{item.workMode}</Badge></td><td>{item.location}</td></tr>)}</tbody></TableShell></section>
    {showSchedule && <Modal title="Assign or update schedule" onClose={() => setShowSchedule(false)} size="large">
      <form className="rf-form" onSubmit={submit}>
        <FormIntro>Choose an employee and a date, then set how, when, and where they work. If the employee already has a schedule on that date, saving updates it.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            <Field label="Employee">{(control) => <select {...control} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}</select>}</Field>
            {selectedEmployee && <PersonCard name={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`} meta={`${selectedEmployee.position || 'Position not set'} · ${selectedEmployee.department || 'Department not set'}`} badge={<Badge tone="success">Active</Badge>} />}

            <Field label="Date" help={existingSchedule ? 'This employee already has a schedule on this date. Saving will update it.' : 'A new schedule will be created for this date.'}>{(control) => <input {...control} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />}</Field>

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
            <h3>{isRestDay ? 'Rest day summary' : 'Schedule summary'}</h3>
            <SummaryList items={[
              ['Employee', selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'Not selected'],
              ['Date', formatDate(form.date)],
              ['Work mode', form.workMode],
              ['Hours', isRestDay ? 'No shift' : `${form.shiftStart} – ${form.shiftEnd}`],
              ['Duration', durationLabel],
              ['Location', isRestDay ? 'Not scheduled' : form.location || 'Location needed'],
            ]} />
            <Note icon={ShieldCheck}>Employees can see only their own schedule. It appears in their portal as soon as you save.</Note>
          </aside>
        </div>

        <FormFooter note="Saving creates or updates one schedule for this employee and date.">
          <button type="button" className="button button-secondary" onClick={() => setShowSchedule(false)}>Cancel</button>
          <button className="button button-primary" disabled={submission.busy}><CalendarClock aria-hidden="true" />Save schedule</button>
        </FormFooter>
      </form>
    </Modal>}
  </div>
}
