import { useState, type FormEvent } from 'react'
import { CheckCircle2, Clock3, Plus, ShieldCheck, UserRoundCheck, Workflow } from 'lucide-react'
import { Badge, EmptyState, Modal, ProgressBar, SectionHeading, StatCard } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { LifecycleCaseInput } from '../types/hrms.js'

export default function AdminLifecycleOperations() {
  const { data, createLifecycleCase, updateLifecycleTask } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const defaultEmployee = data?.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const [form, setForm] = useState<LifecycleCaseInput>(() => ({ employeeId: defaultEmployee, type: 'Onboarding', targetDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }))
  if (!data) return null
  const activeCases = data.lifecycleCases.filter((item) => item.status === 'Active')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await createLifecycleCase(form); setShowCreate(false) } catch { /* Keep protected input for correction. */ }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Secure employee lifecycle" title="Onboarding & Offboarding" description="Coordinate people, assets, payroll, compliance, and access deactivation in one accountable checklist." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus />Start checklist</button>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={UserRoundCheck} label="Active onboarding" value={activeCases.filter((item) => item.type === 'Onboarding').length} tone="blue" /><StatCard icon={Workflow} label="Active offboarding" value={activeCases.filter((item) => item.type === 'Offboarding').length} tone="amber" /><StatCard icon={CheckCircle2} label="Completed cases" value={data.lifecycleCases.filter((item) => item.status === 'Completed').length} tone="green" /></div>
    <div className="lifecycle-grid">{data.lifecycleCases.map((item) => {
      const employee = data.employees.find((person) => person.id === item.employeeId)
      const tasks = data.lifecycleTasks.filter((task) => task.caseId === item.id)
      const done = tasks.filter((task) => task.status !== 'Pending').length
      const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
      return <section className="panel lifecycle-card" key={item.id}><div className="lifecycle-card-head"><div><div className="inline-badges"><Badge tone={item.type === 'Offboarding' ? 'warning' : 'info'}>{item.type}</Badge><Badge tone={statusTone(item.status)}>{item.status}</Badge></div><h2>{employee ? `${employee.firstName} ${employee.lastName}` : item.employeeId}</h2><p>{item.employeeId} · Target {formatDate(item.targetDate)}</p></div><strong>{progress}%</strong></div><ProgressBar value={progress} label={`${done} of ${tasks.length} tasks resolved`} />{item.type === 'Offboarding' && item.status === 'Active' && <div className="impact-banner"><ShieldCheck /><p>Completing the final checklist task automatically changes the employee profile to Inactive, blocking HRMS access.</p></div>}<div className="checklist admin-checklist">{tasks.map((task) => <article key={task.id} className={task.status !== 'Pending' ? 'complete' : ''}><button className="task-toggle" aria-label={`Mark ${task.title} ${task.status === 'Pending' ? 'complete' : 'pending'}`} disabled={item.status !== 'Active'} onClick={() => void updateLifecycleTask(task.id, task.status === 'Pending' ? 'Complete' : 'Pending')}>{task.status === 'Pending' ? <Clock3 /> : <CheckCircle2 />}</button><div><strong>{task.title}</strong><p>{task.category} · {task.employeeVisible ? 'Employee visible' : 'Internal'}</p></div><Badge tone={statusTone(task.status)}>{task.status}</Badge></article>)}</div></section>
    })}</div>
    {!data.lifecycleCases.length && <EmptyState icon={Workflow} title="No lifecycle cases" text="Start an onboarding or offboarding checklist for an employee." />}
    {showCreate && <Modal title="Start lifecycle checklist" onClose={() => setShowCreate(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Employee<select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.status}</option>)}</select></label><label>Case type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Onboarding</option><option>Offboarding</option></select></label><label>Target date<input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} required /></label>{form.type === 'Offboarding' && <div className="form-warning span-2"><ShieldCheck /><p>Access is not removed when the case starts. It is deactivated only after every clearance task is completed or skipped by an authorized HR administrator.</p></div>}<div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary">Create accountable checklist</button></div></form></Modal>}
  </div>
}
