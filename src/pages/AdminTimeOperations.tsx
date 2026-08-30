import { useState, type FormEvent } from 'react'
import { Building2, CalendarClock, CalendarDays, CheckCircle2, Clock3, Coffee, Home, MapPin, MonitorSmartphone, Plus, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { HrmsSnapshot, ScheduleInput } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const workModes = [
  { value: 'On-site', label: 'On-site', detail: 'Office-based shift', icon: Building2 },
  { value: 'Remote', label: 'Remote', detail: 'Approved remote workspace', icon: Home },
  { value: 'Hybrid', label: 'Hybrid', detail: 'Office and remote coverage', icon: MonitorSmartphone },
  { value: 'Rest Day', label: 'Rest day', detail: 'No working shift assigned', icon: Coffee },
]
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminTimeOperations() {
  const { data, saveSchedule } = useHrms()
  const [showSchedule, setShowSchedule] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
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
  const shiftMinutes = isRestDay ? 0 : Math.max(0, timeToMinutes(form.shiftEnd) - timeToMinutes(form.shiftStart))
  const durationLabel = isRestDay ? 'Rest day' : `${Math.floor(shiftMinutes / 60)}h ${shiftMinutes % 60 ? `${shiftMinutes % 60}m` : ''}`.trim()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await saveSchedule(form); setShowSchedule(false) } catch { /* Preserve server-validated input. */ }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Exception-first operations" title="Time & Attendance" description="Monitor live attendance, assigned schedules, and correction requests without silently changing employee records." actions={<button className="button button-primary" onClick={() => setShowSchedule(true)}><Plus />Assign schedule</button>} />
    <div className="stats-grid stats-grid-4"><StatCard icon={CheckCircle2} label="Clocked in today" value={todayRecords.length} tone="green" /><StatCard icon={Clock3} label="Late arrivals" value={todayRecords.filter((item) => item.status === 'Late').length} tone="amber" /><StatCard icon={CalendarClock} label="Open time records" value={missingOut.length} detail="Clock-in without clock-out" tone="purple" /><StatCard icon={CalendarDays} label="Schedule coverage" value={scheduleCoverage} detail="Active employees today" tone="blue" /></div>
    <div className="content-grid content-grid-2"><section className="panel"><div className="panel-header"><div><h2>Today’s attendance</h2><p>Employee clock events from Supabase</p></div></div><TableShell><thead><tr><th>Employee</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>{todayRecords.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{item.clockIn ?? '—'}</td><td>{item.clockOut ?? 'Open'}</td><td>{item.hours.toFixed(1)}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></TableShell></section><section className="panel"><div className="panel-header"><div><h2>Time exceptions</h2><p>Employee-submitted corrections and schedule changes</p></div><Badge tone={exceptionRequests.length ? 'warning' : 'success'}>{exceptionRequests.length} open</Badge></div><div className="compact-record-list">{exceptionRequests.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><p>{personName(data, item.employeeId)} · {item.type} · {formatDate(item.requestedDate)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}{!exceptionRequests.length && <EmptyState icon={CheckCircle2} title="No time exceptions" text="Correction and schedule requests will appear here and in Approvals." />}</div></section></div>
    <section className="panel"><div className="panel-header"><div><h2>Upcoming schedule roster</h2><p>Next assigned shift per employee</p></div></div><TableShell><thead><tr><th>Employee</th><th>Date</th><th>Shift</th><th>Mode</th><th>Location</th></tr></thead><tbody>{data.schedules.filter((item) => item.date >= today).slice(0, 20).map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong></td><td>{formatDate(item.date)}</td><td>{item.workMode === 'Rest Day' ? 'Rest day' : `${item.shiftStart}–${item.shiftEnd}`}</td><td><Badge tone={item.workMode === 'Rest Day' ? 'neutral' : 'info'}>{item.workMode}</Badge></td><td>{item.location}</td></tr>)}</tbody></TableShell></section>
    {showSchedule && <Modal title="Assign or update schedule" onClose={() => setShowSchedule(false)} size="large">
      <form className="schedule-create-shell" onSubmit={submit}>
        <section className="schedule-create-intro">
          <span className="schedule-create-intro-icon"><CalendarClock aria-hidden="true" /></span>
          <div><small>Workforce planning</small><h3>Build a clear, accountable workday</h3><p>Set the employee’s work arrangement, time window, and approved location in one synchronized schedule record.</p></div>
          <span className="schedule-create-state"><Sparkles aria-hidden="true" />Live schedule</span>
        </section>

        <div className="schedule-create-content">
          <section className="schedule-create-fields" aria-labelledby="schedule-details-title">
            <header className="schedule-form-heading"><span><CalendarDays aria-hidden="true" /></span><div><h4 id="schedule-details-title">Schedule details</h4><p>Choose the employee, workday, and arrangement.</p></div></header>

            <label className="schedule-premium-field">Employee
              <span className="schedule-input-shell"><UserRound aria-hidden="true" /><select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}</select></span>
            </label>
            <div className="schedule-person-card"><span>{selectedEmployee ? `${selectedEmployee.firstName[0]}${selectedEmployee.lastName[0]}` : '—'}</span><div><strong>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'Select an employee'}</strong><p>{selectedEmployee?.position || 'Position unavailable'} · {selectedEmployee?.department || 'Department unavailable'}</p></div><Badge tone="success">Active</Badge></div>

            <label className="schedule-premium-field">Date
              <span className="schedule-input-shell"><CalendarDays aria-hidden="true" /><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></span>
              <small>{existingSchedule ? 'Saving will securely update the existing schedule for this employee and date.' : 'A new daily schedule record will be created.'}</small>
            </label>

            <fieldset className="schedule-mode-picker">
              <legend>Work mode</legend>
              <div>{workModes.map(({ value, label, detail, icon: Icon }) => <label key={value} className={form.workMode === value ? 'active' : ''}>
                <input type="radio" name="work-mode" value={value} checked={form.workMode === value} onChange={(event) => setForm({ ...form, workMode: event.target.value })} />
                <span><Icon aria-hidden="true" /></span><div><strong>{label}</strong><small>{detail}</small></div><CheckCircle2 className="schedule-choice-check" aria-hidden="true" />
              </label>)}</div>
            </fieldset>

            <div className="schedule-field-grid">
              <label className="schedule-premium-field">Shift start<span className="schedule-input-shell"><Clock3 aria-hidden="true" /><input type="time" value={form.shiftStart} onChange={(event) => setForm({ ...form, shiftStart: event.target.value })} disabled={isRestDay} required /></span></label>
              <label className="schedule-premium-field">Shift end<span className="schedule-input-shell"><Clock3 aria-hidden="true" /><input type="time" value={form.shiftEnd} onChange={(event) => setForm({ ...form, shiftEnd: event.target.value })} disabled={isRestDay} required /></span></label>
            </div>

            <label className="schedule-premium-field">Location
              <span className="schedule-input-shell"><MapPin aria-hidden="true" /><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} disabled={isRestDay} required /></span>
            </label>
            <label className="schedule-premium-field">Notes <em aria-hidden="true">Optional</em><textarea aria-label="Notes" rows={3} maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add coverage instructions or an approved scheduling note…" /></label>
          </section>

          <aside className="schedule-preview" aria-labelledby="schedule-preview-title">
            <header><div><small>Assignment preview</small><h4 id="schedule-preview-title">{isRestDay ? 'Protected rest day' : 'Scheduled workday'}</h4></div><span><ShieldCheck aria-hidden="true" /></span></header>
            <div className="schedule-preview-person"><span>{selectedEmployee ? `${selectedEmployee.firstName[0]}${selectedEmployee.lastName[0]}` : '—'}</span><div><strong>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'No employee selected'}</strong><p>{selectedEmployee?.id || 'Employee ID'} · {selectedEmployee?.department || 'Department'}</p></div></div>
            <dl className="schedule-preview-metrics"><div><dt>Work date</dt><dd>{formatDate(form.date)}</dd></div><div><dt>Mode</dt><dd>{form.workMode}</dd></div><div><dt>Duration</dt><dd>{durationLabel}</dd></div></dl>
            <div className={`schedule-shift-track ${isRestDay ? 'rest-day' : ''}`}>
              <span><Clock3 aria-hidden="true" /></span>
              <div><small>{isRestDay ? 'No shift required' : 'Start'}</small><strong>{isRestDay ? 'Rest' : form.shiftStart}</strong></div>
              <i />
              <div><small>{isRestDay ? 'Recovery time' : 'End'}</small><strong>{isRestDay ? 'Day' : form.shiftEnd}</strong></div>
            </div>
            <div className="schedule-preview-location"><MapPin aria-hidden="true" /><div><small>Approved location</small><strong>{isRestDay ? 'Not scheduled' : form.location || 'Location required'}</strong></div></div>
            <div className="schedule-preview-assurance"><ShieldCheck aria-hidden="true" /><div><strong>Supabase synchronized</strong><p>The save operation uses the protected employee-and-date upsert. Employees can read only their own schedule.</p></div></div>
          </aside>
        </div>

        <footer className="schedule-create-footer">
          <div className="schedule-create-footnote"><ShieldCheck aria-hidden="true" /><p><strong>Accountable schedule change.</strong> Saving creates or updates one record for the selected employee and work date.</p></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowSchedule(false)}>Cancel</button><button className="button button-primary"><CalendarClock aria-hidden="true" />Save schedule</button></div>
        </footer>
      </form>
    </Modal>}
  </div>
}
