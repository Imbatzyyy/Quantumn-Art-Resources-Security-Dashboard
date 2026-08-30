import { useState, type FormEvent } from 'react'
import { Building2, CalendarDays, CheckCircle2, Clock3, Eye, EyeOff, LockKeyhole, Plus, ShieldCheck, UserMinus, UserPlus, UserRoundCheck, Workflow } from 'lucide-react'
import { Badge, EmptyState, Modal, ProgressBar, SectionHeading, StatCard } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { LifecycleCaseInput } from '../types/hrms.js'

const onboardingTemplate = [
  { title: 'Confirm employee profile and emergency contact', category: 'People', visible: true },
  { title: 'Provision least-privilege HRMS access', category: 'Access', visible: false },
  { title: 'Acknowledge company policies', category: 'Compliance', visible: true },
  { title: 'Complete first-week orientation', category: 'Experience', visible: true },
]

const offboardingTemplate = [
  { title: 'Confirm final working date and turnover', category: 'People', visible: true },
  { title: 'Return company assets', category: 'Assets', visible: true },
  { title: 'Complete final payroll validation', category: 'Payroll', visible: false },
  { title: 'Deactivate HRMS access after clearance', category: 'Access', visible: false },
]

export default function AdminLifecycleOperations() {
  const { data, createLifecycleCase, updateLifecycleTask } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const defaultEmployee = data?.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const [form, setForm] = useState<LifecycleCaseInput>(() => ({ employeeId: defaultEmployee, type: 'Onboarding', targetDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }))
  if (!data) return null
  const activeCases = data.lifecycleCases.filter((item) => item.status === 'Active')
  const selectedEmployee = data.employees.find((item) => item.id === form.employeeId)
  const template = form.type === 'Offboarding' ? offboardingTemplate : onboardingTemplate
  const employeeVisibleTasks = template.filter((item) => item.visible).length

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
    {showCreate && <Modal title="Start lifecycle checklist" size="large" onClose={() => setShowCreate(false)}>
      <div className="lifecycle-create-shell">
        <section className="lifecycle-create-intro">
          <span className="lifecycle-create-intro-icon"><Workflow aria-hidden="true" /></span>
          <div>
            <small>Accountable people transition</small>
            <h3>Launch a guided employee journey</h3>
            <p>Assign the right transition, confirm its deadline, and review every employee-visible and protected HR task before creating the case.</p>
          </div>
          <span className="lifecycle-create-state"><ShieldCheck aria-hidden="true" />Audit ready</span>
        </section>

        <form className="lifecycle-create-form" onSubmit={submit}>
          <div className="lifecycle-create-content">
            <section className="lifecycle-create-fields" aria-labelledby="lifecycle-case-settings-title">
              <header className="lifecycle-form-heading">
                <span><UserRoundCheck aria-hidden="true" /></span>
                <div>
                  <h4 id="lifecycle-case-settings-title">Case configuration</h4>
                  <p>Choose the employee, transition type, and accountable completion date.</p>
                </div>
              </header>

              <div className="lifecycle-premium-field">
                <label htmlFor="lifecycle-employee">Employee</label>
                <div className="lifecycle-select-shell">
                  <UserRoundCheck aria-hidden="true" />
                  <select id="lifecycle-employee" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} required>
                    {data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.status}</option>)}
                  </select>
                </div>
              </div>

              {selectedEmployee && <article className="lifecycle-person-card">
                <span>{selectedEmployee.firstName.charAt(0)}{selectedEmployee.lastName.charAt(0)}</span>
                <div>
                  <strong>{selectedEmployee.firstName} {selectedEmployee.lastName}</strong>
                  <p>{selectedEmployee.position || 'Employee'} · {selectedEmployee.department || 'Unassigned department'}</p>
                  <small>{selectedEmployee.id} · {selectedEmployee.status}</small>
                </div>
                <Badge tone={selectedEmployee.status === 'Active' ? 'success' : 'neutral'}>{selectedEmployee.status}</Badge>
              </article>}

              <fieldset className="lifecycle-type-picker">
                <legend>Case type</legend>
                <div>
                  <label className={form.type === 'Onboarding' ? 'active' : ''}>
                    <input type="radio" name="lifecycle-type" value="Onboarding" checked={form.type === 'Onboarding'} onChange={(event) => setForm({ ...form, type: event.target.value })} />
                    <span><UserPlus aria-hidden="true" /></span>
                    <div><strong>Onboarding</strong><small>Welcome, equip, and guide</small></div>
                    <CheckCircle2 className="lifecycle-choice-check" aria-hidden="true" />
                  </label>
                  <label className={form.type === 'Offboarding' ? 'active offboarding' : ''}>
                    <input type="radio" name="lifecycle-type" value="Offboarding" checked={form.type === 'Offboarding'} onChange={(event) => setForm({ ...form, type: event.target.value })} />
                    <span><UserMinus aria-hidden="true" /></span>
                    <div><strong>Offboarding</strong><small>Clear, hand over, and close</small></div>
                    <CheckCircle2 className="lifecycle-choice-check" aria-hidden="true" />
                  </label>
                </div>
              </fieldset>

              <div className="lifecycle-premium-field">
                <label htmlFor="lifecycle-target-date">Target date</label>
                <div className="lifecycle-date-shell">
                  <CalendarDays aria-hidden="true" />
                  <input id="lifecycle-target-date" type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} required />
                </div>
                <small>The case owner uses this date to prioritize and complete outstanding tasks.</small>
              </div>
            </section>

            <aside className={`lifecycle-template-preview ${form.type === 'Offboarding' ? 'offboarding' : ''}`} aria-labelledby="lifecycle-template-title">
              <header>
                <div>
                  <small>Supabase task template</small>
                  <h4 id="lifecycle-template-title">{form.type} checklist preview</h4>
                </div>
                <span>{form.type === 'Offboarding' ? <UserMinus aria-hidden="true" /> : <UserPlus aria-hidden="true" />}</span>
              </header>
              <div className="lifecycle-template-metrics">
                <div><strong>{template.length}</strong><span>accountable tasks</span></div>
                <div><strong>{employeeVisibleTasks}</strong><span>employee visible</span></div>
                <div><strong>{template.length - employeeVisibleTasks}</strong><span>HR protected</span></div>
              </div>
              <ol className="lifecycle-template-list">
                {template.map((item, index) => <li key={item.title}>
                  <span>{index + 1}</span>
                  <div><strong>{item.title}</strong><small>{item.category}</small></div>
                  <em className={item.visible ? 'visible' : 'internal'}>{item.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{item.visible ? 'Visible' : 'Internal'}</em>
                </li>)}
              </ol>
              <div className="lifecycle-template-security">
                <LockKeyhole aria-hidden="true" />
                <div>
                  <strong>{form.type === 'Offboarding' ? 'Access remains controlled' : 'Least-privilege setup included'}</strong>
                  <p>{form.type === 'Offboarding' ? 'Access is not removed when the case starts. It is deactivated only after every clearance task is completed or skipped by an authorized HR administrator.' : 'Internal access provisioning remains hidden from the employee while their visible journey stays clear and usable.'}</p>
                </div>
              </div>
            </aside>
          </div>

          <footer className="lifecycle-create-footer">
            <div className="lifecycle-create-footnote">
              <Building2 aria-hidden="true" />
              <p><strong>Organization-controlled.</strong> Creating the case records the HR action, generates the four-task template, and notifies the selected employee.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="button button-primary"><Workflow aria-hidden="true" />Create lifecycle checklist</button>
            </div>
          </footer>
        </form>
      </div>
    </Modal>}
  </div>
}
