import { useState, type FormEvent } from 'react'
import { CheckCircle2, Circle, LockKeyhole, Plus, Search, ShieldCheck, UserRoundCheck, Workflow } from 'lucide-react'
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
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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

  const personName = (id: string) => { const employee = data.employees.find((person) => person.id === id); return employee ? `${employee.firstName} ${employee.lastName}` : id }
  const visibleCases = data.lifecycleCases.filter((item) => (!typeFilter || item.type === typeFilter) && (!statusFilter || item.status === statusFilter) && `${personName(item.employeeId)} ${item.employeeId}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => Number(right.status === 'Active') - Number(left.status === 'Active') || left.targetDate.localeCompare(right.targetDate))
  const statuses = [...new Set(data.lifecycleCases.map((item) => item.status))].sort()

  return <div className="page-stack">
    <SectionHeading title="Onboarding & Offboarding" description="Checklists for people joining or leaving: profile, policies, equipment, payroll, and access." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />Start checklist</button>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={UserRoundCheck} label="Onboarding in progress" value={activeCases.filter((item) => item.type === 'Onboarding').length} tone="blue" onClick={() => { setTypeFilter('Onboarding'); setStatusFilter('Active') }} /><StatCard icon={Workflow} label="Offboarding in progress" value={activeCases.filter((item) => item.type === 'Offboarding').length} tone="amber" onClick={() => { setTypeFilter('Offboarding'); setStatusFilter('Active') }} /><StatCard icon={CheckCircle2} label="Completed" value={data.lifecycleCases.filter((item) => item.status === 'Completed').length} tone="green" onClick={() => { setTypeFilter(''); setStatusFilter('Completed') }} /></div>
    {data.lifecycleCases.length > 0 && <div className="panel data-table-toolbar lifecycle-toolbar">
      <div className="data-table-filters">
        <label className="data-table-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search by employee</span><input type="search" value={query} placeholder="Search by employee" onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="data-table-filter"><span className="sr-only">Checklist type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All checklist types</option><option>Onboarding</option><option>Offboarding</option></select></label>
        <label className="data-table-filter"><span className="sr-only">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>
      <p className="data-table-count">{visibleCases.length} of {data.lifecycleCases.length} checklist{data.lifecycleCases.length === 1 ? '' : 's'}</p>
    </div>}
    <div className="lifecycle-grid">{visibleCases.map((item) => {
      const employee = data.employees.find((person) => person.id === item.employeeId)
      const tasks = data.lifecycleTasks.filter((task) => task.caseId === item.id)
      const done = tasks.filter((task) => task.status !== 'Pending').length
      const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
      const overdue = item.status === 'Active' && item.targetDate < new Date().toISOString().slice(0, 10)
      return <section className="panel lifecycle-card" key={item.id} aria-labelledby={`case-${item.id}`}>
        <div className="panel-header"><div><div className="inline-badges"><Badge tone={item.type === 'Offboarding' ? 'warning' : 'info'}>{item.type}</Badge><Badge tone={statusTone(item.status)}>{item.status}</Badge>{overdue && <Badge tone="danger">Past target date</Badge>}</div><h2 id={`case-${item.id}`}>{employee ? `${employee.firstName} ${employee.lastName}` : item.employeeId}</h2><p>{employee?.position ? `${employee.position} · ` : ''}Target {formatDate(item.targetDate)}</p></div></div>
        <div className="lifecycle-body">
          <ProgressBar value={progress} label={`${done} of ${tasks.length} tasks done`} />
          {item.type === 'Offboarding' && item.status === 'Active' && <div className="notice-bar notice-bar-warning"><ShieldCheck aria-hidden="true" /><p>Completing the last task marks the employee Inactive and blocks portal access.</p></div>}
          <ul className="checklist admin-checklist">{tasks.map((task) => <li key={task.id} className={task.status !== 'Pending' ? 'complete' : ''}><button type="button" className="task-toggle" aria-label={`Mark ${task.title} ${task.status === 'Pending' ? 'complete' : 'not done'}`} aria-pressed={task.status !== 'Pending'} disabled={item.status !== 'Active'} onClick={() => void updateLifecycleTask(task.id, task.status === 'Pending' ? 'Complete' : 'Pending')}>{task.status === 'Pending' ? <Circle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}</button><div><strong>{task.title}</strong><p>{task.category} · {task.employeeVisible ? 'Employee sees this' : 'HR only'}</p></div><Badge tone={statusTone(task.status)}>{task.status === 'Pending' ? 'To do' : task.status}</Badge></li>)}</ul>
        </div>
      </section>
    })}</div>
    {!data.lifecycleCases.length && <section className="panel"><EmptyState icon={Workflow} title="No checklists yet" text="Start an onboarding or offboarding checklist for an employee." action={<button type="button" className="button button-primary button-small" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />Start checklist</button>} /></section>}
    {data.lifecycleCases.length > 0 && !visibleCases.length && <section className="panel"><EmptyState compact icon={Search} title="No matching checklists" text="Try another search or filter." action={<button type="button" className="button button-secondary button-small" onClick={() => { setQuery(''); setTypeFilter(''); setStatusFilter('') }}>Clear filters</button>} /></section>}
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
