import { useState, type FormEvent } from 'react'
import { CalendarClock, CalendarDays, CheckCircle2, Clock3, Plus } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { HrmsSnapshot, ScheduleInput } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await saveSchedule(form); setShowSchedule(false) } catch { /* Preserve server-validated input. */ }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Exception-first operations" title="Time & Attendance" description="Monitor live attendance, assigned schedules, and correction requests without silently changing employee records." actions={<button className="button button-primary" onClick={() => setShowSchedule(true)}><Plus />Assign schedule</button>} />
    <div className="stats-grid stats-grid-4"><StatCard icon={CheckCircle2} label="Clocked in today" value={todayRecords.length} tone="green" /><StatCard icon={Clock3} label="Late arrivals" value={todayRecords.filter((item) => item.status === 'Late').length} tone="amber" /><StatCard icon={CalendarClock} label="Open time records" value={missingOut.length} detail="Clock-in without clock-out" tone="purple" /><StatCard icon={CalendarDays} label="Schedule coverage" value={scheduleCoverage} detail="Active employees today" tone="blue" /></div>
    <div className="content-grid content-grid-2"><section className="panel"><div className="panel-header"><div><h2>Today’s attendance</h2><p>Employee clock events from Supabase</p></div></div><TableShell><thead><tr><th>Employee</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>{todayRecords.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{item.clockIn ?? '—'}</td><td>{item.clockOut ?? 'Open'}</td><td>{item.hours.toFixed(1)}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></TableShell></section><section className="panel"><div className="panel-header"><div><h2>Time exceptions</h2><p>Employee-submitted corrections and schedule changes</p></div><Badge tone={exceptionRequests.length ? 'warning' : 'success'}>{exceptionRequests.length} open</Badge></div><div className="compact-record-list">{exceptionRequests.map((item) => <article key={item.id}><div><strong>{item.subject}</strong><p>{personName(data, item.employeeId)} · {item.type} · {formatDate(item.requestedDate)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}{!exceptionRequests.length && <EmptyState icon={CheckCircle2} title="No time exceptions" text="Correction and schedule requests will appear here and in Approvals." />}</div></section></div>
    <section className="panel"><div className="panel-header"><div><h2>Upcoming schedule roster</h2><p>Next assigned shift per employee</p></div></div><TableShell><thead><tr><th>Employee</th><th>Date</th><th>Shift</th><th>Mode</th><th>Location</th></tr></thead><tbody>{data.schedules.filter((item) => item.date >= today).slice(0, 20).map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong></td><td>{formatDate(item.date)}</td><td>{item.workMode === 'Rest Day' ? 'Rest day' : `${item.shiftStart}–${item.shiftEnd}`}</td><td><Badge tone={item.workMode === 'Rest Day' ? 'neutral' : 'info'}>{item.workMode}</Badge></td><td>{item.location}</td></tr>)}</tbody></TableShell></section>
    {showSchedule && <Modal title="Assign or update schedule" onClose={() => setShowSchedule(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Employee<select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}</select></label><label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label>Work mode<select value={form.workMode} onChange={(event) => setForm({ ...form, workMode: event.target.value })}><option>On-site</option><option>Remote</option><option>Hybrid</option><option>Rest Day</option></select></label><label>Shift start<input type="time" value={form.shiftStart} onChange={(event) => setForm({ ...form, shiftStart: event.target.value })} disabled={form.workMode === 'Rest Day'} required /></label><label>Shift end<input type="time" value={form.shiftEnd} onChange={(event) => setForm({ ...form, shiftEnd: event.target.value })} disabled={form.workMode === 'Rest Day'} required /></label><label className="span-2">Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} disabled={form.workMode === 'Rest Day'} required /></label><label className="span-2">Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowSchedule(false)}>Cancel</button><button className="button button-primary">Save schedule</button></div></form></Modal>}
  </div>
}
