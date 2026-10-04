import { useState, type FormEvent } from 'react'
import { CheckCircle2, Clock3, LockKeyhole, Plus, ShieldCheck, UserRoundCheck, Workflow } from 'lucide-react'
import { Badge, EmptyState, Modal, ProgressBar, SectionHeading, StatCard } from '../components/ui.js'
import { Field, FormFooter, FormIntro, Note, PersonCard } from '../components/readable.js'
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
      <form className="rf-form" onSubmit={submit}>
        <FormIntro>Choose the employee and whether they are joining or leaving. A checklist is created from the template on the right, and the employee is notified.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            <Field label="Employee">{(control) => <select {...control} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} required>
              {data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} · {item.status}</option>)}
            </select>}</Field>
            {selectedEmployee && <PersonCard name={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`} meta={`${selectedEmployee.position || 'Employee'} · ${selectedEmployee.department || 'No department'} · ${selectedEmployee.id}`} badge={<Badge tone={selectedEmployee.status === 'Active' ? 'success' : 'neutral'}>{selectedEmployee.status}</Badge>} />}

            <fieldset className="rf-field rf-choices rf-choices--2">
              <legend className="rf-label">Case type</legend>
              <div>
                <label className={`rf-choice${form.type === 'Onboarding' ? ' is-selected' : ''}`}><input type="radio" name="lifecycle-type" value="Onboarding" checked={form.type === 'Onboarding'} onChange={(event) => setForm({ ...form, type: event.target.value })} /><span><strong>Onboarding</strong><small>Welcome, equip, and guide a new employee</small></span></label>
                <label className={`rf-choice${form.type === 'Offboarding' ? ' is-selected' : ''}`}><input type="radio" name="lifecycle-type" value="Offboarding" checked={form.type === 'Offboarding'} onChange={(event) => setForm({ ...form, type: event.target.value })} /><span><strong>Offboarding</strong><small>Hand over work and close access</small></span></label>
              </div>
            </fieldset>

            <Field label="Target date" help="The date this checklist should be finished.">{(control) => <input {...control} type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} required />}</Field>
          </div>

          <aside className="rf-summary" aria-label="Checklist preview">
            <h3>{form.type} checklist preview</h3>
            <div className="rf-kpis">
              <div><strong>{template.length}</strong><span>tasks</span></div>
              <div><strong>{employeeVisibleTasks}</strong><span>employee sees</span></div>
              <div><strong>{template.length - employeeVisibleTasks}</strong><span>HR only</span></div>
            </div>
            <ol className="rf-tasks">
              {template.map((item, index) => <li key={item.title}>
                <span aria-hidden="true">{index + 1}</span>
                <div><strong>{item.title}</strong><span className="rf-task-meta"><small>{item.category}</small><span className={`rf-tag ${item.visible ? 'rf-tag--visible' : 'rf-tag--private'}`}>{item.visible ? 'Employee sees' : 'HR only'}</span></span></div>
              </li>)}
            </ol>
            <Note icon={LockKeyhole}>{form.type === 'Offboarding' ? 'Access is not removed when the case starts. It is deactivated only after every clearance task is completed or skipped by an authorized HR administrator.' : 'Setting up system access stays hidden from the employee, so their checklist shows only the steps they need to do.'}</Note>
          </aside>
        </div>

        <FormFooter note="Creating the checklist records your action and notifies the employee.">
          <button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="button button-primary"><Workflow aria-hidden="true" />Create lifecycle checklist</button>
        </FormFooter>
      </form>
    </Modal>}
  </div>
}
