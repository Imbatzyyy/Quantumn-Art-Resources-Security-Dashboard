import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import {
  BriefcaseBusiness, Building2, CalendarDays, Clock3, ContactRound, Copy, Eye, EyeOff,
  FolderLock, KeyRound, MapPin, PhilippinePeso, Plus, Search, ShieldCheck,
  Star, Target, UserRoundCheck, Users, Workflow,
} from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatMoney, statusTone } from '../utils/format.js'
import { Employee360Summary } from './people/Employee360Summary.js'
import { EmployeeAvatar } from '../components/EmployeeAvatar.js'
import type {
  BenefitInput, EmployeeProvisionInput, EmployeeRecord, EmployeeUpdateInput, HrmsSnapshot,
} from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
type ProfileTab = 'summary' | 'time' | 'pay' | 'growth' | 'documents' | 'access'
const profileTabs = [
  { id: 'summary', label: 'Overview', icon: ContactRound },
  { id: 'time', label: 'Attendance', icon: Clock3 },
  { id: 'pay', label: 'Pay & benefits', icon: PhilippinePeso },
  { id: 'growth', label: 'Growth', icon: Target },
  { id: 'documents', label: 'Documents', icon: FolderLock },
  { id: 'access', label: 'Account access', icon: ShieldCheck },
] as const

const todayInManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
const emptyEmployee = (): EmployeeProvisionInput => ({
  firstName: '', middleName: '', lastName: '', preferredName: '', email: '', phone: '',
  department: 'Operations', position: '', employmentType: 'Full-time',
  workArrangement: 'On-site', workLocation: 'Main Office', costCenter: '', managerId: '',
  salary: 35000, hireDate: todayInManila(), emergencyContactName: '',
  emergencyContactRelationship: '', emergencyContactPhone: '', temporaryPassword: '',
})
const emptyBenefit = (): BenefitInput => ({
  employeeId: '', type: 'Health', provider: '', planName: '', employeeShare: 0,
  employerShare: 0, status: 'Active', effectiveDate: todayInManila(),
})

interface PeopleDirectoryProps { onNavigate: (page: string) => void }

export default function PeopleDirectory({ onNavigate }: PeopleDirectoryProps) {
  const { data, addEmployee, updateEmployee, saveBenefit } = useHrms()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<ProfileTab>('summary')
  const [benefitEmployee, setBenefitEmployee] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null)
  const [editForm, setEditForm] = useState<EmployeeUpdateInput | null>(null)
  const [form, setForm] = useState<EmployeeProvisionInput>(emptyEmployee)
  const [benefitForm, setBenefitForm] = useState<BenefitInput>(emptyBenefit)
  if (!data) return null

  // The shared snapshot also contains privileged accounts for Admin Accounts
  // and reporting-manager choices. Only employee-role profiles belong here.
  const employeeRecords = data.employees.filter((employee) => employee.role === 'employee')
  const selected = employeeRecords.find((employee) => employee.id === selectedId)
  const employees = employeeRecords.filter((employee) =>
    `${employee.id} ${employee.firstName} ${employee.lastName} ${employee.email} ${employee.department} ${employee.position}`
      .toLowerCase().includes(query.trim().toLowerCase()),
  )
  const eligibleManagers = data.employees.filter((employee) =>
    ['admin', 'hr_admin'].includes(employee.role) && ['Active', 'On Leave'].includes(employee.status),
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
    try {
      await addEmployee(form)
      setShowAdd(false)
      setForm(emptyEmployee())
    } catch {
      // The shared protected-operation toast explains the server rejection.
    } finally {
      setCreating(false)
    }
  }

  const openEditor = (employee: EmployeeRecord) => {
    setEditForm({
      firstName: employee.firstName, middleName: employee.middleName ?? '', lastName: employee.lastName,
      preferredName: employee.preferredName ?? '', phone: employee.phone ?? '', department: employee.department,
      position: employee.position, employmentType: employee.employmentType ?? 'Full-time',
      workArrangement: employee.workArrangement ?? 'On-site', workLocation: employee.workLocation ?? 'Main Office',
      costCenter: employee.costCenter ?? '', managerId: employee.managerId ?? '', salary: employee.salary ?? 0,
      hireDate: employee.hireDate ?? todayInManila(), emergencyContactName: employee.emergencyContactName ?? '',
      emergencyContactRelationship: employee.emergencyContactRelationship ?? '',
      emergencyContactPhone: employee.emergencyContactPhone ?? '',
    })
    setEditingEmployee(employee)
    setSelectedId(null)
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingEmployee || !editForm) return
    try {
      await updateEmployee(editingEmployee.id, editForm)
      setEditingEmployee(null)
      setEditForm(null)
    } catch {
      // Preserve the form so the administrator can correct server-validated fields.
    }
  }

  const submitBenefit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!benefitEmployee) return
    try {
      await saveBenefit({ ...benefitForm, employeeId: benefitEmployee })
      setBenefitEmployee(null)
      setBenefitForm(emptyBenefit())
    } catch {
      // Preserve the form while the shared toast reports the database response.
    }
  }

  return <div className="page-stack people-directory-page">
    <SectionHeading eyebrow="Employee intelligence" title="People Directory" description="A secure, role-aware view of every employee relationship and lifecycle record." actions={<button className="button button-primary people-add-button" onClick={() => setShowAdd(true)}><Plus />Create employee & login</button>} />
    <section className="people-assurance-strip"><span><Users /></span><div><strong>One trusted people record</strong><p>Employment, attendance, pay, growth, documents, and access signals remain synchronized through Supabase.</p></div><Badge tone="success">Realtime directory</Badge></section>
    <div className="stats-grid stats-grid-3 people-metric-grid">
      <StatCard icon={Users} label="Employee records" value={employeeRecords.length} detail="Employee accounts only" tone="blue" />
      <StatCard icon={Building2} label="Departments" value={new Set(employeeRecords.map((item) => item.department)).size} detail="Employee department coverage" tone="green" />
      <StatCard icon={UserRoundCheck} label="Active employees" value={employeeRecords.filter((item) => item.status === 'Active').length} detail="Employee portal access" tone="purple" />
    </div>
    <section className="panel people-directory-panel">
      <div className="panel-header panel-header-wrap"><div><span className="panel-kicker">Organization records</span><h2>Employee directory</h2><p>Employees only. Manage administrator access in Admin Accounts.</p></div><label className="compact-search people-search"><Search size={16} /><input aria-label="Search employees" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, employee ID, team, or position" /></label></div>
      {employees.length ? <TableShell><thead><tr><th>Employee</th><th>Department</th><th>Position</th><th>Work setup</th><th>Access role</th><th>Status</th><th /></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td><div className="table-person"><EmployeeAvatar employee={employee} className="people-directory-avatar" /><div><strong>{employee.preferredName || employee.firstName} {employee.lastName}</strong><small>{employee.id} · {employee.email}</small></div></div></td><td>{employee.department}</td><td>{employee.position}</td><td><strong>{employee.employmentType ?? '—'}</strong><small className="table-subtitle">{employee.workArrangement ?? '—'} · {employee.workLocation ?? '—'}</small></td><td><Badge tone={employee.role === 'employee' ? 'neutral' : 'info'}>{employee.role.replaceAll('_', ' ')}</Badge></td><td><Badge tone={statusTone(employee.status)}>{employee.status}</Badge></td><td><button className="text-button people-open-button" onClick={() => { setSelectedId(employee.id); setTab('summary') }}>Open profile</button></td></tr>)}</tbody></TableShell> : <EmptyState icon={Users} title={query ? 'No matching employee' : 'No employee records yet'} text={query ? 'Try a different name, ID, department, or position.' : 'Create the first employee account to begin building the organization directory.'} />}
    </section>

    {showAdd && <Modal title="Create employee account" onClose={() => !creating && setShowAdd(false)} size="large"><EmployeeForm form={form} setForm={setForm} managers={eligibleManagers} onSubmit={submit} onCancel={() => setShowAdd(false)} busy={creating} /></Modal>}
    {editingEmployee && editForm && <Modal title={`Edit ${editingEmployee.firstName} ${editingEmployee.lastName}`} onClose={() => setEditingEmployee(null)} size="large"><EmployeeEditForm form={editForm} setForm={setEditForm} managers={eligibleManagers.filter((item) => item.id !== editingEmployee.id)} onSubmit={submitEdit} onCancel={() => setEditingEmployee(null)} /></Modal>}
    {selected && <Modal title="Employee 360°" onClose={() => setSelectedId(null)} size="large">
      <div className="employee-360">
        <header className="employee-360-identity">
          <EmployeeAvatar employee={selected} className="employee-360-avatar" />
          <div className="employee-360-name"><span className="employee-360-eyebrow">Employee profile · {selected.id}</span><h2>{selected.preferredName || selected.firstName} {selected.lastName}</h2><p>{selected.position} <span aria-hidden="true">/</span> {selected.department}</p><div className="inline-badges"><Badge tone={statusTone(selected.status)}>{selected.status}</Badge><Badge tone="neutral">{selected.employmentType || 'Employment type not set'}</Badge></div></div>
          <div className="employee-360-tenure"><CalendarDays size={18} /><div><span>Joined the team</span><strong>{selected.hireDate ? formatDate(selected.hireDate) : 'Not recorded'}</strong></div></div>
        </header>
        <div className="employee-360-tabs" role="tablist" aria-label="Employee information">
          {profileTabs.map(({ id, label, icon: Icon }, index) => <button key={id} id={`employee-360-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls="employee-360-panel" tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={(event) => {
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % profileTabs.length : event.key === 'ArrowLeft' ? (index + profileTabs.length - 1) % profileTabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? profileTabs.length - 1 : null
            if (nextIndex === null) return
            event.preventDefault()
            setTab(profileTabs[nextIndex].id)
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
          }}><Icon size={16} aria-hidden="true" />{label}</button>)}
        </div>
        <div className="employee-360-content" id="employee-360-panel" role="tabpanel" aria-labelledby={`employee-360-tab-${tab}`} tabIndex={0}>
          {tab !== 'summary' && <div className="employee-360-section-intro"><h3>{profileTabs.find((item) => item.id === tab)?.label}</h3><p>Records available for {selected.preferredName || selected.firstName}, within your authorized access.</p></div>}
          <Employee360Tab tab={tab} employee={selected} data={data} onAddBenefit={() => setBenefitEmployee(selected.id)} />
        </div>
        <footer className="employee-360-footer"><p><ShieldCheck size={16} />Access-controlled employee record</p><div className="modal-actions">
          {selected.role === 'employee' && selected.status === 'Active' && <button className="button button-secondary danger-text" onClick={() => { setSelectedId(null); onNavigate('lifecycle') }}><Workflow />Start secure offboarding</button>}
          {selected.role === 'employee' && selected.status === 'Inactive' && <button className="button button-secondary" onClick={() => void updateEmployee(selected.id, { status: 'Active' })}>Reactivate account</button>}
          {selected.role === 'employee' && <button className="button button-secondary" onClick={() => openEditor(selected)}>Edit employee</button>}
          <button className="button button-primary" onClick={() => setSelectedId(null)}>Done</button>
        </div></footer>
      </div>
    </Modal>}
    {benefitEmployee && <Modal title="Add benefit record" onClose={() => setBenefitEmployee(null)}><form className="form-grid" onSubmit={submitBenefit}><label>Benefit type<input value={benefitForm.type} onChange={(event) => setBenefitForm({ ...benefitForm, type: event.target.value })} required /></label><label>Provider<input value={benefitForm.provider} onChange={(event) => setBenefitForm({ ...benefitForm, provider: event.target.value })} /></label><label className="span-2">Plan name<input value={benefitForm.planName} onChange={(event) => setBenefitForm({ ...benefitForm, planName: event.target.value })} required /></label><label>Employee share<input type="number" min={0} value={benefitForm.employeeShare} onChange={(event) => setBenefitForm({ ...benefitForm, employeeShare: event.target.value })} /></label><label>Employer share<input type="number" min={0} value={benefitForm.employerShare} onChange={(event) => setBenefitForm({ ...benefitForm, employerShare: event.target.value })} /></label><label>Effective date<input type="date" value={benefitForm.effectiveDate} onChange={(event) => setBenefitForm({ ...benefitForm, effectiveDate: event.target.value })} required /></label><label>Status<select value={benefitForm.status} onChange={(event) => setBenefitForm({ ...benefitForm, status: event.target.value })}><option>Active</option><option>Pending</option><option>Inactive</option></select></label><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setBenefitEmployee(null)}>Cancel</button><button className="button button-primary">Save benefit</button></div></form></Modal>}
  </div>
}

function secureTemporaryPassword() {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?']
  const all = groups.join('')
  const values = new Uint32Array(16)
  window.crypto.getRandomValues(values)
  const characters = groups.map((group, index) => group[values[index] % group.length])
  for (let index = 4; index < values.length; index += 1) characters.push(all[values[index] % all.length])
  return characters.map((character, index) => ({ character, order: values[index] })).sort((left, right) => left.order - right.order).map(({ character }) => character).join('')
}

interface EmployeeFormProps {
  form: EmployeeProvisionInput
  setForm: Dispatch<SetStateAction<EmployeeProvisionInput>>
  managers: EmployeeRecord[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  busy: boolean
}

function EmployeeForm({ form, setForm, managers, onSubmit, onCancel, busy }: EmployeeFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const set = <K extends keyof EmployeeProvisionInput>(key: K, value: EmployeeProvisionInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const generatePassword = () => { set('temporaryPassword', secureTemporaryPassword()); setShowPassword(true); setCopied(false) }
  const copyPassword = async () => { if (!form.temporaryPassword) return; await navigator.clipboard.writeText(form.temporaryPassword); setCopied(true) }

  return <div className="employee-create-shell">
    <div className="employee-create-intro"><span><ShieldCheck /></span><div><strong>Secure employee provisioning</strong><p>Create the employee identity, work assignment, emergency contact, and first-login access in one protected workflow.</p></div><Badge tone="success">Least privilege</Badge><div className="employee-provision-steps"><span><b>1</b>Identity</span><span><b>2</b>Employment</span><span><b>3</b>Safety contact</span><span><b>4</b>Portal access</span></div></div>
    <form className="employee-create-form" onSubmit={onSubmit} aria-busy={busy}>
      <section className="employee-form-section"><div className="employee-form-heading"><ContactRound /><div><h3>Personal identity</h3><p>Use the employee’s legal work record; optional names improve everyday display.</p></div></div><div className="form-grid employee-field-grid">
        <label>First name<input maxLength={80} autoComplete="given-name" value={form.firstName} onChange={(event) => set('firstName', event.target.value)} required /></label><label>Middle name <small>Optional</small><input maxLength={80} autoComplete="additional-name" value={form.middleName} onChange={(event) => set('middleName', event.target.value)} /></label><label>Last name<input maxLength={80} autoComplete="family-name" value={form.lastName} onChange={(event) => set('lastName', event.target.value)} required /></label><label>Preferred name <small>Optional</small><input maxLength={80} value={form.preferredName} onChange={(event) => set('preferredName', event.target.value)} /></label><label>Work email<input type="email" maxLength={254} autoComplete="off" value={form.email} onChange={(event) => set('email', event.target.value)} required /></label><label>Mobile number<input type="tel" minLength={7} maxLength={30} placeholder="+63 912 345 6789" autoComplete="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} required /></label>
      </div></section>
      <section className="employee-form-section"><div className="employee-form-heading"><BriefcaseBusiness /><div><h3>Employment assignment</h3><p>Core organization, reporting, location, and compensation information.</p></div></div><div className="form-grid employee-field-grid">
        <label>Department<select value={form.department} onChange={(event) => set('department', event.target.value)}><option>Operations</option><option>Human Resources</option><option>Finance</option><option>Technology</option><option>Sales & Marketing</option><option>Creative</option></select></label><label>Position<input maxLength={120} value={form.position} onChange={(event) => set('position', event.target.value)} required /></label><label>Employment type<select value={form.employmentType} onChange={(event) => set('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option></select></label><label>Work arrangement<select value={form.workArrangement} onChange={(event) => set('workArrangement', event.target.value)}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label><label>Work location<input maxLength={120} value={form.workLocation} onChange={(event) => set('workLocation', event.target.value)} required /></label><label>Cost center <small>Optional</small><input maxLength={60} placeholder="OPS-100" value={form.costCenter} onChange={(event) => set('costCenter', event.target.value)} /></label><label>Start date<input type="date" value={form.hireDate} onChange={(event) => set('hireDate', event.target.value)} required /></label><label>Reports to <small>Optional</small><select value={form.managerId} onChange={(event) => set('managerId', event.target.value)}><option value="">No manager assigned</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} · {manager.position}</option>)}</select></label><label className="span-2">Monthly base salary<input type="number" min={1} max={999999999} step="0.01" value={form.salary} onChange={(event) => set('salary', event.target.value)} required /><small className="field-privacy">Restricted to authorized HR and payroll roles.</small></label>
      </div></section>
      <section className="employee-form-section"><div className="employee-form-heading"><ContactRound /><div><h3>Emergency contact</h3><p>Optional and visible only to authorized HR roles.</p></div></div><div className="form-grid employee-field-grid employee-field-grid-3"><label>Contact name <small>Optional</small><input maxLength={120} value={form.emergencyContactName} onChange={(event) => set('emergencyContactName', event.target.value)} /></label><label>Relationship <small>Optional</small><input maxLength={60} value={form.emergencyContactRelationship} onChange={(event) => set('emergencyContactRelationship', event.target.value)} /></label><label>Contact number <small>Optional</small><input type="tel" minLength={7} maxLength={30} value={form.emergencyContactPhone} onChange={(event) => set('emergencyContactPhone', event.target.value)} /></label></div></section>
      <section className="employee-form-section employee-access-section"><div className="employee-form-heading"><KeyRound /><div><h3>Employee portal access</h3><p>The employee signs in only through the employee portal and must replace this temporary password during the first login.</p></div></div><label className="secure-password-field">Temporary password<div><input type={showPassword ? 'text' : 'password'} minLength={12} maxLength={128} autoComplete="new-password" value={form.temporaryPassword} onChange={(event) => set('temporaryPassword', event.target.value)} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button><button type="button" onClick={copyPassword} aria-label="Copy password"><Copy /></button></div></label><div className="password-tools"><button className="button button-secondary" type="button" onClick={generatePassword}>Generate strong password</button><span>{copied ? 'Copied securely.' : '12+ characters with uppercase, lowercase, number, and symbol.'}</span></div></section>
      <div className="employee-create-footer"><div><ShieldCheck /><span>Server-validated · Auth-linked · RLS-protected · Audit logged</span></div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Creating secure account…' : 'Create employee & login'}</button></div></div>
    </form>
  </div>
}

interface EmployeeEditFormProps {
  form: EmployeeUpdateInput
  setForm: Dispatch<SetStateAction<EmployeeUpdateInput | null>>
  managers: EmployeeRecord[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

function EmployeeEditForm({ form, setForm, managers, onSubmit, onCancel }: EmployeeEditFormProps) {
  const set = <K extends keyof EmployeeUpdateInput>(key: K, value: EmployeeUpdateInput[K]) => setForm((current) => current ? { ...current, [key]: value } : current)
  return <form className="employee-create-form employee-edit-form" onSubmit={onSubmit}><section className="employee-form-section"><div className="employee-form-heading"><ContactRound /><div><h3>Identity and contact</h3><p>Login email is tied to Supabase Auth and is not editable here.</p></div></div><div className="form-grid employee-field-grid"><label>First name<input maxLength={80} value={form.firstName} onChange={(event) => set('firstName', event.target.value)} required /></label><label>Middle name<input maxLength={80} value={form.middleName} onChange={(event) => set('middleName', event.target.value)} /></label><label>Last name<input maxLength={80} value={form.lastName} onChange={(event) => set('lastName', event.target.value)} required /></label><label>Preferred name<input maxLength={80} value={form.preferredName} onChange={(event) => set('preferredName', event.target.value)} /></label><label className="span-2">Mobile number<input type="tel" minLength={7} maxLength={30} value={form.phone} onChange={(event) => set('phone', event.target.value)} required /></label></div></section><section className="employee-form-section"><div className="employee-form-heading"><MapPin /><div><h3>Employment assignment</h3><p>Changes synchronize to the employee portal immediately.</p></div></div><div className="form-grid employee-field-grid"><label>Department<input maxLength={100} value={form.department} onChange={(event) => set('department', event.target.value)} required /></label><label>Position<input maxLength={120} value={form.position} onChange={(event) => set('position', event.target.value)} required /></label><label>Employment type<select value={form.employmentType} onChange={(event) => set('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option></select></label><label>Work arrangement<select value={form.workArrangement} onChange={(event) => set('workArrangement', event.target.value)}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label><label>Work location<input maxLength={120} value={form.workLocation} onChange={(event) => set('workLocation', event.target.value)} required /></label><label>Cost center<input maxLength={60} value={form.costCenter} onChange={(event) => set('costCenter', event.target.value)} /></label><label>Start date<input type="date" value={form.hireDate} onChange={(event) => set('hireDate', event.target.value)} required /></label><label>Reports to<select value={form.managerId} onChange={(event) => set('managerId', event.target.value)}><option value="">No manager assigned</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} · {manager.position}</option>)}</select></label><label className="span-2">Monthly base salary<input type="number" min={1} step="0.01" value={form.salary} onChange={(event) => set('salary', event.target.value)} required /></label></div></section><section className="employee-form-section"><div className="employee-form-heading"><ContactRound /><div><h3>Emergency contact</h3><p>Optional and restricted to authorized HR roles.</p></div></div><div className="form-grid employee-field-grid employee-field-grid-3"><label>Name<input maxLength={120} value={form.emergencyContactName} onChange={(event) => set('emergencyContactName', event.target.value)} /></label><label>Relationship<input maxLength={60} value={form.emergencyContactRelationship} onChange={(event) => set('emergencyContactRelationship', event.target.value)} /></label><label>Phone<input type="tel" minLength={7} maxLength={30} value={form.emergencyContactPhone} onChange={(event) => set('emergencyContactPhone', event.target.value)} /></label></div></section><div className="employee-create-footer"><div><ShieldCheck /><span>Changes are protected by Supabase RLS and recorded in the audit trail.</span></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button className="button button-primary">Save employee details</button></div></div></form>
}

interface Employee360TabProps { tab: ProfileTab; employee: EmployeeRecord; data: HrmsSnapshot; onAddBenefit: () => void }
function Employee360Tab({ tab, employee, data, onAddBenefit }: Employee360TabProps) {
  const attendance = useMemo(() => data.attendance.filter((item) => item.employeeId === employee.id), [data.attendance, employee.id])
  const payroll = data.payroll.filter((item) => item.employeeId === employee.id)
  const benefits = data.benefits.filter((item) => item.employeeId === employee.id)
  const goals = data.goals.filter((item) => item.employeeId === employee.id)
  const performance = data.performance.filter((item) => item.employeeId === employee.id)
  const documents = data.documents.filter((item) => item.employeeId === employee.id || !item.employeeId)
  const acknowledgements = data.documentAcknowledgements.filter((item) => item.employeeId === employee.id)
  const alerts = data.securityAlerts.filter((item) => item.employeeId === employee.id)
  const sessions = data.sessions.filter((item) => item.employeeId === employee.id)
  if (tab === 'summary') return <Employee360Summary employee={employee} manager={data.employees.find((item) => item.id === employee.managerId)} openRequests={data.employeeRequests.filter((item) => item.employeeId === employee.id && openRequestStatuses.includes(item.status)).length} pendingLeave={data.leaveRequests.filter((item) => item.employeeId === employee.id && item.status === 'Pending').length} activeGoals={goals.filter((item) => item.status === 'Active').length} />
  if (tab === 'time') return <div className="compact-record-list">{attendance.slice(0, 8).map((item) => <article key={item.id}><div><strong>{formatDate(item.date)}</strong><p>{item.clockIn ?? '—'}–{item.clockOut ?? 'Open'} · {item.hours.toFixed(1)} hrs</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}{!attendance.length && <EmptyState icon={Clock3} title="No attendance records" text="Clock activity will appear here." />}</div>
  if (tab === 'pay') return <div className="employee-360-stack"><div className="subsection-title"><div><h3>Payroll</h3><p>Visible only to authorized payroll roles</p></div><strong>{payroll[0] ? formatMoney(payroll[0].net) : '—'}</strong></div>{payroll.length ? <div className="compact-record-list">{payroll.slice(0, 4).map((item) => <article key={item.id}><div><strong>{item.period}</strong><p>Gross {formatMoney(item.gross)} · Net {formatMoney(item.net)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}</div> : <EmptyState icon={PhilippinePeso} title="No payroll records" text="Generated payroll runs will appear here according to the employee’s access scope." />}<div className="subsection-title"><div><h3>Benefits</h3><p>{benefits.length} plan records</p></div><button className="button button-secondary" onClick={onAddBenefit}><Plus />Add benefit</button></div>{benefits.length ? <div className="compact-record-list">{benefits.map((item) => <article key={item.id}><div><strong>{item.planName}</strong><p>{item.type} · Employer {formatMoney(item.employerShare)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}</div> : <EmptyState icon={BriefcaseBusiness} title="No benefit records" text="Add a benefit plan when enrollment information is available." />}</div>
  if (tab === 'growth') return <div className="employee-360-stack">{goals.length ? <div className="compact-record-list">{goals.map((item) => <article key={item.id}><div><strong>{item.title}</strong><p>{item.category} · Due {formatDate(item.dueDate)}</p></div><strong>{item.progress}%</strong></article>)}</div> : <EmptyState icon={Target} title="No active goals" text="Goals assigned from Performance will appear here." />}{performance.map((item) => <div className="decision-note" key={item.id}><Star /><div><strong>{item.period} · {item.score}/100</strong><p>{item.rating} · {item.status}</p></div></div>)}</div>
  if (tab === 'documents') return documents.length ? <div className="compact-record-list">{documents.map((item) => { const acknowledged = acknowledgements.some((ack) => ack.documentId === item.id); return <article key={item.id}><div><strong>{item.title}</strong><p>{item.type} · Version {item.version}</p></div>{item.requiresAck ? <Badge tone={acknowledged ? 'success' : 'warning'}>{acknowledged ? 'Acknowledged' : 'Due'}</Badge> : <Badge tone="neutral">Available</Badge>}</article> })}</div> : <EmptyState icon={FolderLock} title="No employee documents" text="Employee-specific and organization-wide documents will appear here." />
  return <div className="employee-360-stack"><div className="mini-stats"><article><span>Open alerts</span><strong>{alerts.filter((item) => item.status !== 'Resolved').length}</strong></article><article><span>Sessions</span><strong>{sessions.length}</strong></article><article><span>Access role</span><strong className="small-value">{employee.role}</strong></article></div>{alerts.length ? <div className="compact-record-list">{alerts.slice(0, 5).map((item) => <article key={item.id}><div><strong>{item.title}</strong><p>{item.time}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}</div> : <EmptyState icon={ShieldCheck} title="No security alerts" text="New account-security events will appear here for authorized review." />}</div>
}
