import { useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import { Activity, ArrowLeft, BriefcaseBusiness, CalendarDays, CalendarRange, Clock3, ContactRound, Copy, Eye, EyeOff, FolderLock, KeyRound, LayoutList, Network, PhilippinePeso, Plus, ShieldCheck, Star, Target, UserRoundX, Users, Workflow } from 'lucide-react'
import { Badge, ConfirmDialog, EmptyState, Modal, SectionHeading, StatCard, Tabs } from '../components/ui.js'
import { tabPanelProps } from '../components/tabPanel.js'
import { Field, FormFooter, FormIntro, SectionTitle } from '../components/readable.js'
import { DataTable, type DataColumn } from '../components/DataTable.js'
import { Payslip } from '../components/Payslip.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateTime, formatMoney, formatTenure, formatTime, statusTone } from '../utils/format.js'
import { Employee360Summary } from './people/Employee360Summary.js'
import { EmployeeAvatar } from '../components/EmployeeAvatar.js'
import { BenefitRecordForm } from './people/BenefitRecordForm.js'
import { formatLeaveDays, leaveBalances, leavePoliciesOf } from '../utils/leave.js'
import type {
  AttendanceRecord, BenefitInput, EmployeeProvisionInput, EmployeeRecord, EmployeeUpdateInput, HrmsSnapshot, LeaveRequestRecord, PayrollRecord,
} from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const standardDepartments = ['Operations', 'Human Resources', 'Finance', 'Technology', 'Sales & Marketing', 'Creative']
const profileTabs = [
  { id: 'summary', label: 'Overview', icon: ContactRound },
  { id: 'time', label: 'Attendance', icon: Clock3 },
  { id: 'leave', label: 'Leave', icon: CalendarRange },
  { id: 'pay', label: 'Pay & benefits', icon: PhilippinePeso },
  { id: 'growth', label: 'Growth', icon: Target },
  { id: 'documents', label: 'Documents', icon: FolderLock },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'access', label: 'Account access', icon: ShieldCheck },
] as const
type ProfileTab = typeof profileTabs[number]['id']

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
const displayName = (employee: Pick<EmployeeRecord, 'firstName' | 'lastName' | 'preferredName'>) => `${employee.preferredName || employee.firstName} ${employee.lastName}`

interface PeopleDirectoryProps {
  onNavigate: (target: string) => void
  employeeId?: string | null
  tab?: string | null
  view?: string | null
  startCreating?: boolean
  onTabChange?: (tab: string | null) => void
  onViewChange?: (view: string | null) => void
}

export default function PeopleDirectory({ onNavigate, employeeId, tab, view, startCreating = false, onTabChange, onViewChange }: PeopleDirectoryProps) {
  const { data, addEmployee, updateEmployee, saveBenefit } = useHrms()
  const [showAdd, setShowAdd] = useState(startCreating)
  const [localSelected, setLocalSelected] = useState<string | null>(null)
  const [localTab, setLocalTab] = useState<ProfileTab>('summary')
  const [localView, setLocalView] = useState<'table' | 'org'>('table')
  const [benefitEmployee, setBenefitEmployee] = useState<string | null>(null)
  const [savingBenefit, setSavingBenefit] = useState(false)
  const [benefitError, setBenefitError] = useState('')
  const [creating, setCreating] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null)
  const [editForm, setEditForm] = useState<EmployeeUpdateInput | null>(null)
  const [statusChange, setStatusChange] = useState<{ employee: EmployeeRecord; status: string } | null>(null)
  const [form, setForm] = useState<EmployeeProvisionInput>(emptyEmployee)
  const [benefitForm, setBenefitForm] = useState<BenefitInput>(emptyBenefit)
  if (!data) return null

  // URL-driven when hosted by the admin portal; local state keeps the page usable on its own.
  const selectedId = employeeId !== undefined ? employeeId : localSelected
  const activeTab: ProfileTab = (profileTabs.find((item) => item.id === (onTabChange ? tab : localTab))?.id ?? 'summary')
  const activeView = (onViewChange ? view : localView) === 'org' ? 'org' : 'table'
  const openEmployee = (id: string | null) => {
    if (employeeId !== undefined) onNavigate(id ? `people/${id}` : 'people')
    else { setLocalSelected(id); setLocalTab('summary') }
  }
  const setTab = (next: ProfileTab) => onTabChange ? onTabChange(next === 'summary' ? null : next) : setLocalTab(next)
  const setView = (next: 'table' | 'org') => onViewChange ? onViewChange(next === 'table' ? null : next) : setLocalView(next)

  // The shared snapshot also contains privileged accounts for Admin Accounts
  // and reporting-manager choices. Only employee-role profiles belong here.
  const employeeRecords = data.employees.filter((employee) => employee.role === 'employee')
  const selected = selectedId ? employeeRecords.find((employee) => employee.id === selectedId) : undefined
  const eligibleManagers = data.employees.filter((employee) =>
    ['admin', 'hr_admin'].includes(employee.role) && ['Active', 'On Leave'].includes(employee.status),
  )
  const departments = [...new Set([...standardDepartments, ...data.employees.map((employee) => employee.department).filter(Boolean)])].sort((left, right) => left.localeCompare(right))

  const closeCreate = () => {
    if (creating) return
    setShowAdd(false)
    if (startCreating) onNavigate('people')
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
    try {
      await addEmployee(form)
      setShowAdd(false)
      setForm(emptyEmployee())
      if (startCreating) onNavigate('people')
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
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingEmployee || !editForm || savingEdit) return
    setSavingEdit(true)
    try {
      await updateEmployee(editingEmployee.id, editForm)
      setEditingEmployee(null)
      setEditForm(null)
    } catch {
      // Preserve the form so the administrator can correct server-validated fields.
    } finally {
      setSavingEdit(false)
    }
  }

  const submitBenefit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!benefitEmployee || savingBenefit) return
    setSavingBenefit(true)
    setBenefitError('')
    try {
      await saveBenefit({ ...benefitForm, employeeId: benefitEmployee })
      setBenefitEmployee(null)
      setBenefitForm(emptyBenefit())
    } catch {
      setBenefitError('The benefit could not be saved. Your entries are still here. Please check your connection and permissions, then try again.')
    } finally {
      setSavingBenefit(false)
    }
  }

  const modals = <>
    {showAdd && <Modal title="Add employee" onClose={closeCreate} size="large"><EmployeeForm form={form} setForm={setForm} managers={eligibleManagers} departments={departments} onSubmit={submit} onCancel={closeCreate} busy={creating} /></Modal>}
    {editingEmployee && editForm && <Modal title={`Edit ${editingEmployee.firstName} ${editingEmployee.lastName}`} onClose={() => !savingEdit && setEditingEmployee(null)} size="large" dismissible={!savingEdit}><EmployeeEditForm form={editForm} setForm={setEditForm} managers={eligibleManagers.filter((item) => item.id !== editingEmployee.id)} departments={departments} onSubmit={submitEdit} onCancel={() => setEditingEmployee(null)} busy={savingEdit} /></Modal>}
    {benefitEmployee && <Modal title="Add benefit record" onClose={() => !savingBenefit && setBenefitEmployee(null)} dismissible={!savingBenefit}><BenefitRecordForm employee={employeeRecords.find((item) => item.id === benefitEmployee)} form={benefitForm} setForm={setBenefitForm} onSubmit={submitBenefit} onCancel={() => setBenefitEmployee(null)} saving={savingBenefit} error={benefitError} /></Modal>}
    {statusChange && <ConfirmDialog
      title="Change employment status"
      icon={UserRoundX}
      heading={`Mark ${displayName(statusChange.employee)} as ${statusChange.status === 'On Leave' ? 'on leave' : 'active'}?`}
      message={<p>{statusChange.status === 'On Leave' ? 'Their profile shows “On Leave”. They can still sign in to the employee portal.' : 'Their profile shows “Active” again.'} The change is recorded in the audit log.</p>}
      confirmLabel={statusChange.status === 'On Leave' ? 'Mark as on leave' : statusChange.status === 'Active' && statusChange.employee.status === 'Inactive' ? 'Reactivate account' : 'Mark as active'}
      onCancel={() => setStatusChange(null)}
      onConfirm={async () => { await updateEmployee(statusChange.employee.id, { status: statusChange.status }); setStatusChange(null) }}
    />}
  </>

  // A locally opened profile closes if the person is no longer an employee (for example after a role change).
  if (selectedId && (selected || employeeId !== undefined)) {
    if (!selected) return <div className="page-stack">
      <section className="panel"><EmptyState icon={Users} title="Employee not found" text="This employee may have been removed, or the link is incorrect." action={<button type="button" className="button button-secondary button-small" onClick={() => openEmployee(null)}><ArrowLeft aria-hidden="true" />Back to People Directory</button>} /></section>
    </div>
    return <div className="page-stack employee-profile-page">
      <EmployeeProfileView
        employee={selected}
        data={data}
        tab={activeTab}
        onTabChange={setTab}
        onBack={() => openEmployee(null)}
        onEdit={() => openEditor(selected)}
        onStatus={(status) => setStatusChange({ employee: selected, status })}
        onOffboard={() => onNavigate('lifecycle')}
        onAddBenefit={() => { setBenefitForm(emptyBenefit()); setBenefitError(''); setBenefitEmployee(selected.id) }}
      />
      {modals}
    </div>
  }

  const activeCount = employeeRecords.filter((item) => item.status === 'Active').length
  const onLeaveCount = employeeRecords.filter((item) => item.status === 'On Leave').length
  const departmentCount = new Set(employeeRecords.map((item) => item.department)).size
  const columns: DataColumn<EmployeeRecord>[] = [
    { id: 'name', header: 'Employee', primary: true, cell: (employee) => <span className="table-person"><EmployeeAvatar employee={employee} className="people-directory-avatar" /><span className="cell-stack"><strong>{displayName(employee)}</strong><small>{employee.id} · {employee.email}</small></span></span>, sortValue: (employee) => `${employee.lastName} ${employee.firstName}`, csv: (employee) => `${employee.firstName} ${employee.lastName}` },
    { id: 'id', header: 'Employee ID', exportOnly: true, cell: (employee) => employee.id, csv: (employee) => employee.id },
    { id: 'email', header: 'Work email', exportOnly: true, cell: (employee) => employee.email, csv: (employee) => employee.email },
    { id: 'department', header: 'Department', cell: (employee) => employee.department, sortValue: (employee) => employee.department },
    { id: 'position', header: 'Position', cell: (employee) => employee.position, sortValue: (employee) => employee.position },
    { id: 'type', header: 'Employment', hideOnMobile: true, cell: (employee) => <span className="cell-stack"><span>{employee.employmentType ?? '—'}</span><small>{employee.workArrangement ?? '—'}</small></span>, sortValue: (employee) => employee.employmentType ?? '', csv: (employee) => `${employee.employmentType ?? ''} / ${employee.workArrangement ?? ''}` },
    { id: 'location', header: 'Location', hideOnMobile: true, cell: (employee) => employee.workLocation ?? '—', sortValue: (employee) => employee.workLocation ?? '' },
    { id: 'start', header: 'Start date', hideOnMobile: true, cell: (employee) => <span className="cell-stack"><span>{formatDate(employee.hireDate)}</span><small>{formatTenure(employee.hireDate)}</small></span>, sortValue: (employee) => employee.hireDate ?? '', csv: (employee) => employee.hireDate ?? '' },
    { id: 'status', header: 'Status', cell: (employee) => <Badge tone={statusTone(employee.status)}>{employee.status}</Badge>, sortValue: (employee) => employee.status },
  ]

  return <div className="page-stack people-directory-page">
    <SectionHeading
      title="People Directory"
      description="Everyone who works here, their job details, and how to reach them."
      meta={employeeRecords.length > 0 && <span className="heading-summary">{employeeRecords.length} employee{employeeRecords.length === 1 ? '' : 's'} · {activeCount} active{onLeaveCount ? ` · ${onLeaveCount} on leave` : ''} · {departmentCount} department{departmentCount === 1 ? '' : 's'}</span>}
      actions={<button className="button button-primary people-add-button" onClick={() => setShowAdd(true)}><Plus aria-hidden="true" />Add employee</button>}
    />
    <section className="panel people-directory-panel">
      {activeView === 'table' ? <DataTable
        rows={employeeRecords}
        columns={columns}
        getRowId={(employee) => employee.id}
        caption="Employee directory"
        count={{ singular: 'employee', plural: 'employees' }}
        search={{ placeholder: 'Search employees', text: (employee) => `${employee.id} ${employee.firstName} ${employee.lastName} ${employee.preferredName ?? ''} ${employee.email} ${employee.department} ${employee.position}` }}
        filters={[
          { id: 'department', label: 'Departments', value: (employee) => employee.department },
          { id: 'status', label: 'Statuses', value: (employee) => employee.status },
          { id: 'type', label: 'Employment types', value: (employee) => employee.employmentType ?? '' },
          { id: 'location', label: 'Locations', value: (employee) => employee.workLocation ?? '' },
        ]}
        initialSort={{ column: 'name', direction: 'asc' }}
        exportName="employee-directory"
        onRowClick={(employee) => openEmployee(employee.id)}
        rowActionLabel={(employee) => `Open ${displayName(employee)}`}
        toolbar={<ViewToggle view={activeView} onChange={setView} />}
        empty={{ icon: Users, title: 'No employee records yet', text: 'Add the first employee to start building the directory.', action: <button type="button" className="button button-primary button-small" onClick={() => setShowAdd(true)}><Plus aria-hidden="true" />Add employee</button> }}
      /> : <OrgChart employees={data.employees} onOpen={openEmployee} toolbar={<ViewToggle view={activeView} onChange={setView} />} />}
    </section>
    {modals}
  </div>
}

function ViewToggle({ view, onChange }: { view: 'table' | 'org'; onChange: (view: 'table' | 'org') => void }) {
  return <div className="segmented" role="group" aria-label="Directory view">
    <button type="button" aria-pressed={view === 'table'} onClick={() => onChange('table')}><LayoutList size={16} aria-hidden="true" />List</button>
    <button type="button" aria-pressed={view === 'org'} onClick={() => onChange('org')}><Network size={16} aria-hidden="true" />Org chart</button>
  </div>
}

function OrgChart({ employees, onOpen, toolbar }: { employees: EmployeeRecord[]; onOpen: (id: string) => void; toolbar: ReactNode }) {
  const people = employees.filter((employee) => employee.status !== 'Inactive')
  const reportsOf = (managerId: string) => people.filter((employee) => employee.managerId === managerId && employee.id !== managerId)
  const managers = people.filter((employee) => reportsOf(employee.id).length > 0)
  const roots = managers.filter((manager) => !manager.managerId || !people.some((employee) => employee.id === manager.managerId))
  const unassigned = people.filter((employee) => employee.role === 'employee' && (!employee.managerId || !people.some((item) => item.id === employee.managerId)) && !managers.includes(employee))
  const Node = ({ person, depth }: { person: EmployeeRecord; depth: number }) => {
    const reports = depth < 6 ? reportsOf(person.id) : []
    return <li>
      <button type="button" className="org-node" onClick={() => person.role === 'employee' ? onOpen(person.id) : undefined} disabled={person.role !== 'employee'}>
        <EmployeeAvatar employee={person} className="org-node-avatar" />
        <span><strong>{displayName(person)}</strong><small>{person.position}</small>{reports.length > 0 && <em>{reports.length} direct report{reports.length === 1 ? '' : 's'}</em>}</span>
      </button>
      {reports.length > 0 && <ul>{reports.map((report) => <Node key={report.id} person={report} depth={depth + 1} />)}</ul>}
    </li>
  }
  return <div className="org-chart">
    <div className="data-table-toolbar"><p className="org-chart-note">Reporting lines from each employee’s “Reports to” field.</p><div className="data-table-tools">{toolbar}</div></div>
    {roots.length > 0 && <ul className="org-tree">{roots.map((root) => <Node key={root.id} person={root} depth={0} />)}</ul>}
    {unassigned.length > 0 && <div className="org-unassigned"><h3>No manager assigned ({unassigned.length})</h3><ul className="org-tree org-tree-flat">{unassigned.map((person) => <Node key={person.id} person={person} depth={6} />)}</ul></div>}
    {!roots.length && !unassigned.length && <EmptyState icon={Network} title="No reporting lines yet" text="Set “Reports to” on employee records to build the org chart." />}
  </div>
}

interface ProfileViewProps {
  employee: EmployeeRecord
  data: HrmsSnapshot
  tab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
  onBack: () => void
  onEdit: () => void
  onStatus: (status: string) => void
  onOffboard: () => void
  onAddBenefit: () => void
}

function EmployeeProfileView({ employee, data, tab, onTabChange, onBack, onEdit, onStatus, onOffboard, onAddBenefit }: ProfileViewProps) {
  const manager = data.employees.find((item) => item.id === employee.managerId)
  const openRequests = data.employeeRequests.filter((item) => item.employeeId === employee.id && openRequestStatuses.includes(item.status)).length
  const pendingLeave = data.leaveRequests.filter((item) => item.employeeId === employee.id && item.status === 'Pending').length
  const activeGoals = data.goals.filter((item) => item.employeeId === employee.id && item.status === 'Active').length
  return <>
    <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />People Directory</button>
    <section className="panel employee-profile-header">
      <EmployeeAvatar employee={employee} className="employee-360-avatar" />
      <div className="employee-profile-identity">
        <h1 tabIndex={-1} data-page-title="">{displayName(employee)}</h1>
        <p>{employee.position} · {employee.department}</p>
        <div className="inline-badges"><Badge tone={statusTone(employee.status)}>{employee.status}</Badge><Badge tone="neutral">{employee.employmentType || 'Employment type not set'}</Badge><Badge tone="neutral">{employee.id}</Badge></div>
      </div>
      <div className="employee-profile-actions">
        <button className="button button-secondary" onClick={onEdit}>Edit employee</button>
        {employee.status === 'Active' && <button className="button button-secondary" onClick={() => onStatus('On Leave')}>Mark on leave</button>}
        {employee.status === 'On Leave' && <button className="button button-secondary" onClick={() => onStatus('Active')}>Mark as active</button>}
        {employee.status === 'Inactive' && <button className="button button-secondary" onClick={() => onStatus('Active')}>Reactivate account</button>}
        {employee.status !== 'Inactive' && <button className="button button-secondary danger-text" onClick={onOffboard}><Workflow aria-hidden="true" />Start offboarding</button>}
      </div>
    </section>
    <div className="stats-grid stats-grid-4">
      <StatCard icon={CalendarDays} label="With the company" value={formatTenure(employee.hireDate)} detail={employee.hireDate ? `Since ${formatDate(employee.hireDate)}` : 'Start date not recorded'} tone="blue" />
      <StatCard icon={Users} label="Reports to" value={manager ? displayName(manager) : 'Not assigned'} detail={manager?.position} tone="purple" />
      <StatCard icon={BriefcaseBusiness} label="Open requests" value={openRequests} detail={`${pendingLeave} leave pending`} tone="amber" />
      <StatCard icon={Target} label="Active goals" value={activeGoals} detail="In Performance" tone="green" />
    </div>
    <section className="panel">
      <div className="panel-header panel-header-tabs"><Tabs idPrefix="employee-360" label="Employee information" tabs={profileTabs} active={tab} onChange={onTabChange} /></div>
      <div {...tabPanelProps('employee-360', tab)} className="tab-panel employee-360-content">
        <Employee360Tab tab={tab} employee={employee} data={data} onAddBenefit={onAddBenefit} />
      </div>
    </section>
  </>
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

function DepartmentSelect({ control, value, departments, onChange }: { control: { id: string; 'aria-describedby'?: string }; value: string; departments: string[]; onChange: (value: string) => void }) {
  const options = departments.includes(value) || !value ? departments : [...departments, value].sort((left, right) => left.localeCompare(right))
  return <select {...control} value={value} onChange={(event) => onChange(event.target.value)} required>{options.map((department) => <option key={department}>{department}</option>)}</select>
}

function SalaryInput({ control, value, onChange }: { control: { id: string; 'aria-describedby'?: string }; value: number | string; onChange: (value: string) => void }) {
  return <div className="rf-input-prefix"><span aria-hidden="true">₱</span><input {...control} type="number" inputMode="decimal" min={1} max={999999999} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} required /></div>
}

interface EmployeeFormProps {
  form: EmployeeProvisionInput
  setForm: Dispatch<SetStateAction<EmployeeProvisionInput>>
  managers: EmployeeRecord[]
  departments: string[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  busy: boolean
}

function EmployeeForm({ form, setForm, managers, departments, onSubmit, onCancel, busy }: EmployeeFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const set = <K extends keyof EmployeeProvisionInput>(key: K, value: EmployeeProvisionInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const generatePassword = () => { set('temporaryPassword', secureTemporaryPassword()); setShowPassword(true); setCopied(false) }
  const copyPassword = async () => { if (!form.temporaryPassword) return; await navigator.clipboard.writeText(form.temporaryPassword); setCopied(true) }

  return <form className="rf-form rf-form--md" onSubmit={onSubmit} aria-busy={busy}>
    <FormIntro>Create the employee’s record and their sign-in in one step. They sign in to the employee portal with a temporary password and must change it the first time.</FormIntro>
    <div className="rf-single">
      <section className="rf-section">
        <SectionTitle step={1} description="Use the name on the employee’s official records.">Personal details</SectionTitle>
        <div className="rf-grid">
          <Field label="First name">{(control) => <input {...control} maxLength={80} autoComplete="given-name" value={form.firstName} onChange={(event) => set('firstName', event.target.value)} required />}</Field>
          <Field label="Middle name" optional>{(control) => <input {...control} maxLength={80} autoComplete="additional-name" value={form.middleName} onChange={(event) => set('middleName', event.target.value)} />}</Field>
          <Field label="Last name">{(control) => <input {...control} maxLength={80} autoComplete="family-name" value={form.lastName} onChange={(event) => set('lastName', event.target.value)} required />}</Field>
          <Field label="Preferred name" optional>{(control) => <input {...control} maxLength={80} value={form.preferredName} onChange={(event) => set('preferredName', event.target.value)} />}</Field>
          <Field label="Work email">{(control) => <input {...control} type="email" maxLength={254} autoComplete="off" value={form.email} onChange={(event) => set('email', event.target.value)} required />}</Field>
          <Field label="Mobile number">{(control) => <input {...control} type="tel" minLength={7} maxLength={30} placeholder="+63 912 345 6789" autoComplete="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} required />}</Field>
        </div>
      </section>
      <section className="rf-section">
        <SectionTitle step={2} description="Team, role, location, and pay.">Job details</SectionTitle>
        <div className="rf-grid">
          <Field label="Department">{(control) => <DepartmentSelect control={control} value={form.department} departments={departments} onChange={(value) => set('department', value)} />}</Field>
          <Field label="Position">{(control) => <input {...control} maxLength={120} value={form.position} onChange={(event) => set('position', event.target.value)} required />}</Field>
          <Field label="Employment type">{(control) => <select {...control} value={form.employmentType} onChange={(event) => set('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option></select>}</Field>
          <Field label="Work arrangement">{(control) => <select {...control} value={form.workArrangement} onChange={(event) => set('workArrangement', event.target.value)}><option>On-site</option><option>Hybrid</option><option>Remote</option></select>}</Field>
          <Field label="Work location">{(control) => <input {...control} maxLength={120} value={form.workLocation} onChange={(event) => set('workLocation', event.target.value)} required />}</Field>
          <Field label="Cost center" optional>{(control) => <input {...control} maxLength={60} placeholder="OPS-100" value={form.costCenter} onChange={(event) => set('costCenter', event.target.value)} />}</Field>
          <Field label="Start date">{(control) => <input {...control} type="date" value={form.hireDate} onChange={(event) => set('hireDate', event.target.value)} required />}</Field>
          <Field label="Reports to" optional>{(control) => <select {...control} value={form.managerId} onChange={(event) => set('managerId', event.target.value)}><option value="">No manager assigned</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} · {manager.position}</option>)}</select>}</Field>
          <Field label="Monthly base salary" className="rf-span-2" help="Only authorized HR and payroll staff can see this.">{(control) => <SalaryInput control={control} value={form.salary} onChange={(value) => set('salary', value)} />}</Field>
        </div>
      </section>
      <section className="rf-section">
        <SectionTitle step={3} description="Optional. Only authorized HR staff can see this.">Emergency contact</SectionTitle>
        <div className="rf-grid rf-grid--3">
          <Field label="Contact name" optional>{(control) => <input {...control} maxLength={120} value={form.emergencyContactName} onChange={(event) => set('emergencyContactName', event.target.value)} />}</Field>
          <Field label="Relationship" optional>{(control) => <input {...control} maxLength={60} value={form.emergencyContactRelationship} onChange={(event) => set('emergencyContactRelationship', event.target.value)} />}</Field>
          <Field label="Contact number" optional>{(control) => <input {...control} type="tel" minLength={7} maxLength={30} value={form.emergencyContactPhone} onChange={(event) => set('emergencyContactPhone', event.target.value)} />}</Field>
        </div>
      </section>
      <section className="rf-section">
        <SectionTitle step={4} description="The employee signs in to the employee portal with this password and must replace it at their first sign-in.">Portal sign-in</SectionTitle>
        <Field label="Temporary password" help={copied ? 'Copied to your clipboard.' : 'At least 12 characters, with uppercase, lowercase, a number, and a symbol.'}>{(control) => <div className="rf-password">
          <input {...control} type={showPassword ? 'text' : 'password'} minLength={12} maxLength={128} autoComplete="new-password" value={form.temporaryPassword} onChange={(event) => set('temporaryPassword', event.target.value)} required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button>
          <button type="button" onClick={() => void copyPassword()} aria-label="Copy password"><Copy /></button>
        </div>}</Field>
        <button className="button button-secondary rf-inline-button" type="button" onClick={generatePassword}><KeyRound aria-hidden="true" />Generate strong password</button>
      </section>
    </div>
    <FormFooter icon={ShieldCheck} note="The employee is notified by email, and the action is recorded in the audit log.">
      <button className="button button-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      <button className="button button-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create employee & login'}</button>
    </FormFooter>
  </form>
}

interface EmployeeEditFormProps {
  form: EmployeeUpdateInput
  setForm: Dispatch<SetStateAction<EmployeeUpdateInput | null>>
  managers: EmployeeRecord[]
  departments: string[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  busy: boolean
}

function EmployeeEditForm({ form, setForm, managers, departments, onSubmit, onCancel, busy }: EmployeeEditFormProps) {
  const set = <K extends keyof EmployeeUpdateInput>(key: K, value: EmployeeUpdateInput[K]) => setForm((current) => current ? { ...current, [key]: value } : current)
  return <form className="rf-form rf-form--md" onSubmit={onSubmit} aria-busy={busy}>
    <FormIntro>Update the employee’s details. Changes appear in their portal right away. Their sign-in email can’t be changed here.</FormIntro>
    <fieldset className="rf-single rf-fieldset" disabled={busy}>
      <section className="rf-section">
        <SectionTitle step={1}>Name and contact</SectionTitle>
        <div className="rf-grid">
          <Field label="First name">{(control) => <input {...control} maxLength={80} value={form.firstName} onChange={(event) => set('firstName', event.target.value)} required />}</Field>
          <Field label="Middle name" optional>{(control) => <input {...control} maxLength={80} value={form.middleName} onChange={(event) => set('middleName', event.target.value)} />}</Field>
          <Field label="Last name">{(control) => <input {...control} maxLength={80} value={form.lastName} onChange={(event) => set('lastName', event.target.value)} required />}</Field>
          <Field label="Preferred name" optional>{(control) => <input {...control} maxLength={80} value={form.preferredName} onChange={(event) => set('preferredName', event.target.value)} />}</Field>
          <Field label="Mobile number" className="rf-span-2">{(control) => <input {...control} type="tel" minLength={7} maxLength={30} value={form.phone} onChange={(event) => set('phone', event.target.value)} required />}</Field>
        </div>
      </section>
      <section className="rf-section">
        <SectionTitle step={2}>Job details</SectionTitle>
        <div className="rf-grid">
          <Field label="Department">{(control) => <DepartmentSelect control={control} value={form.department} departments={departments} onChange={(value) => set('department', value)} />}</Field>
          <Field label="Position">{(control) => <input {...control} maxLength={120} value={form.position} onChange={(event) => set('position', event.target.value)} required />}</Field>
          <Field label="Employment type">{(control) => <select {...control} value={form.employmentType} onChange={(event) => set('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option></select>}</Field>
          <Field label="Work arrangement">{(control) => <select {...control} value={form.workArrangement} onChange={(event) => set('workArrangement', event.target.value)}><option>On-site</option><option>Hybrid</option><option>Remote</option></select>}</Field>
          <Field label="Work location">{(control) => <input {...control} maxLength={120} value={form.workLocation} onChange={(event) => set('workLocation', event.target.value)} required />}</Field>
          <Field label="Cost center" optional>{(control) => <input {...control} maxLength={60} value={form.costCenter} onChange={(event) => set('costCenter', event.target.value)} />}</Field>
          <Field label="Start date">{(control) => <input {...control} type="date" value={form.hireDate} onChange={(event) => set('hireDate', event.target.value)} required />}</Field>
          <Field label="Reports to" optional>{(control) => <select {...control} value={form.managerId} onChange={(event) => set('managerId', event.target.value)}><option value="">No manager assigned</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} · {manager.position}</option>)}</select>}</Field>
          <Field label="Monthly base salary" className="rf-span-2" help="Only authorized HR and payroll staff can see this.">{(control) => <SalaryInput control={control} value={form.salary} onChange={(value) => set('salary', value)} />}</Field>
        </div>
      </section>
      <section className="rf-section">
        <SectionTitle step={3} description="Optional. Only authorized HR staff can see this.">Emergency contact</SectionTitle>
        <div className="rf-grid rf-grid--3">
          <Field label="Name" optional>{(control) => <input {...control} maxLength={120} value={form.emergencyContactName} onChange={(event) => set('emergencyContactName', event.target.value)} />}</Field>
          <Field label="Relationship" optional>{(control) => <input {...control} maxLength={60} value={form.emergencyContactRelationship} onChange={(event) => set('emergencyContactRelationship', event.target.value)} />}</Field>
          <Field label="Phone" optional>{(control) => <input {...control} type="tel" minLength={7} maxLength={30} value={form.emergencyContactPhone} onChange={(event) => set('emergencyContactPhone', event.target.value)} />}</Field>
        </div>
      </section>
    </fieldset>
    <FormFooter icon={ShieldCheck} note="Changes are recorded in the audit log.">
      <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save employee details'}</button>
    </FormFooter>
  </form>
}

interface Employee360TabProps { tab: ProfileTab; employee: EmployeeRecord; data: HrmsSnapshot; onAddBenefit: () => void }
function Employee360Tab({ tab, employee, data, onAddBenefit }: Employee360TabProps) {
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null)
  const attendance = useMemo(() => data.attendance.filter((item) => item.employeeId === employee.id), [data.attendance, employee.id])
  const payroll = data.payroll.filter((item) => item.employeeId === employee.id)
  const benefits = data.benefits.filter((item) => item.employeeId === employee.id)
  const goals = data.goals.filter((item) => item.employeeId === employee.id)
  const performance = data.performance.filter((item) => item.employeeId === employee.id)
  const documents = data.documents.filter((item) => item.employeeId === employee.id || !item.employeeId)
  const acknowledgements = data.documentAcknowledgements.filter((item) => item.employeeId === employee.id)
  const alerts = data.securityAlerts.filter((item) => item.employeeId === employee.id)
  const sessions = data.sessions.filter((item) => item.employeeId === employee.id)
  const leave = data.leaveRequests.filter((item) => item.employeeId === employee.id)

  if (tab === 'summary') return <Employee360Summary employee={employee} manager={data.employees.find((item) => item.id === employee.managerId)} openRequests={data.employeeRequests.filter((item) => item.employeeId === employee.id && openRequestStatuses.includes(item.status)).length} pendingLeave={leave.filter((item) => item.status === 'Pending').length} activeGoals={goals.filter((item) => item.status === 'Active').length} />

  if (tab === 'time') {
    const columns: DataColumn<AttendanceRecord>[] = [
      { id: 'date', header: 'Date', primary: true, cell: (item) => <strong>{formatDate(item.date)}</strong>, sortValue: (item) => item.date },
      { id: 'in', header: 'Clock in', cell: (item) => formatTime(item.clockIn), sortValue: (item) => item.clockIn ?? '' },
      { id: 'out', header: 'Clock out', cell: (item) => item.clockOut ? formatTime(item.clockOut) : 'Open', sortValue: (item) => item.clockOut ?? '' },
      { id: 'hours', header: 'Hours', align: 'end', cell: (item) => `${item.hours.toFixed(1)} hrs`, sortValue: (item) => item.hours },
      { id: 'status', header: 'Status', cell: (item) => <Badge tone={statusTone(item.status)}>{item.status}</Badge>, sortValue: (item) => item.status },
    ]
    return <DataTable rows={attendance} columns={columns} getRowId={(item) => item.id} caption={`${displayName(employee)} attendance`} count={{ singular: 'day', plural: 'days' }} initialSort={{ column: 'date', direction: 'desc' }} exportName={`attendance-${employee.id}`} filters={[{ id: 'status', label: 'Statuses', value: (item) => item.status }]} empty={{ icon: Clock3, title: 'No attendance records', text: 'Clock activity will appear here.' }} />
  }

  if (tab === 'leave') {
    const columns: DataColumn<LeaveRequestRecord>[] = [
      { id: 'type', header: 'Type', primary: true, cell: (item) => <strong>{item.type}</strong>, sortValue: (item) => item.type },
      { id: 'dates', header: 'Dates', cell: (item) => `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`, sortValue: (item) => item.startDate },
      { id: 'days', header: 'Days', align: 'end', cell: (item) => item.days, sortValue: (item) => item.days },
      { id: 'reason', header: 'Reason', hideOnMobile: true, cell: (item) => <span className="cell-clamp">{item.reason}</span>, csv: (item) => item.reason },
      { id: 'status', header: 'Status', cell: (item) => <span className="cell-stack"><Badge tone={statusTone(item.status)}>{item.status}</Badge>{item.decisionNote && <small className="cell-note">HR: {item.decisionNote}</small>}</span>, sortValue: (item) => item.status, csv: (item) => item.status },
    ]
    const year = todayInManila().slice(0, 4)
    const balances = leaveBalances(leavePoliciesOf(data), data.leaveRequests, employee.id, year)
    return <div className="employee-360-stack">
      <dl className="key-values key-values-inline">{balances.map((balance) => <div key={balance.type}><dt>{balance.type} left in {year}</dt><dd>{balance.remaining == null ? `${formatLeaveDays(balance.used)} used` : `${formatLeaveDays(balance.remaining)} of ${balance.allowance}`}</dd></div>)}</dl>
      <DataTable rows={leave} columns={columns} getRowId={(item) => item.id} caption={`${displayName(employee)} leave`} count={{ singular: 'request', plural: 'requests' }} initialSort={{ column: 'dates', direction: 'desc' }} empty={{ icon: CalendarRange, title: 'No leave requests', text: 'Leave requests from this employee will appear here.' }} />
    </div>
  }

  if (tab === 'pay') return <div className="employee-360-stack">
    <div className="subsection-title"><div><h3>Payslips</h3><p>Visible only to authorized payroll roles</p></div><strong>{payroll[0] ? formatMoney(payroll[0].net) : '—'}</strong></div>
    {payroll.length ? <div className="compact-record-list">{payroll.slice(0, 6).map((item) => <button type="button" className="compact-record-button" key={item.id} onClick={() => setPayslip(item)}><div><strong>{item.period}</strong><p>Earnings {formatMoney(item.gross + item.allowances + item.bonuses)} · Net {formatMoney(item.net)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></button>)}</div> : <EmptyState compact icon={PhilippinePeso} title="No payroll records" text="Payroll runs that include this employee will appear here." />}
    <div className="subsection-title"><div><h3>Benefits</h3><p>{benefits.length} plan record{benefits.length === 1 ? '' : 's'}</p></div><button className="button button-secondary button-small" onClick={onAddBenefit}><Plus aria-hidden="true" />Add benefit</button></div>
    {benefits.length ? <div className="compact-record-list">{benefits.map((item) => <article key={item.id}><div><strong>{item.planName}</strong><p>{item.type} · Employee {formatMoney(item.employeeShare)} · Company {formatMoney(item.employerShare)}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}</div> : <EmptyState compact icon={BriefcaseBusiness} title="No benefit records" text="Add a benefit plan when enrollment information is available." />}
    {payslip && <Modal title={`Payslip · ${payslip.period}`} onClose={() => setPayslip(null)} size="large"><Payslip record={payslip} employee={employee} /></Modal>}
  </div>

  if (tab === 'growth') return <div className="employee-360-stack">
    <div className="subsection-title"><div><h3>Goals</h3></div></div>
    {goals.length ? <div className="compact-record-list">{goals.map((item) => <article key={item.id}><div><strong>{item.title}</strong><p>{item.category} · Due {formatDate(item.dueDate)}</p></div><Badge tone={statusTone(item.status)}>{item.progress}%</Badge></article>)}</div> : <EmptyState compact icon={Target} title="No goals" text="Goals assigned in Performance will appear here." />}
    <div className="subsection-title"><div><h3>Reviews</h3></div></div>
    {performance.length ? <div className="compact-record-list">{performance.map((item) => <article key={item.id}><div><strong>{item.period} · {item.score}/100</strong><p>{item.rating}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}</div> : <EmptyState compact icon={Star} title="No reviews" text="Performance reviews will appear here." />}
  </div>

  if (tab === 'documents') return documents.length ? <div className="compact-record-list">{documents.map((item) => { const acknowledged = acknowledgements.find((ack) => ack.documentId === item.id); return <article key={item.id}><div><strong>{item.title}</strong><p>{item.type} · Version {item.version}{item.employeeId ? ' · Personal' : ' · Company-wide'}{acknowledged?.acknowledgedAt ? ` · Acknowledged ${formatDateTime(acknowledged.acknowledgedAt)}` : ''}</p></div>{item.requiresAck ? <Badge tone={acknowledged ? 'success' : 'warning'}>{acknowledged ? 'Acknowledged' : 'Not yet acknowledged'}</Badge> : <Badge tone="neutral">For records</Badge>}</article> })}</div> : <EmptyState icon={FolderLock} title="No documents" text="Personal and company-wide documents will appear here." />

  if (tab === 'activity') {
    const events = [
      ...(employee.hireDate ? [{ id: 'hire', at: `${employee.hireDate}T00:00:00+08:00`, title: 'Joined the company', detail: `${employee.position} · ${employee.department}` }] : []),
      ...data.employeeRequests.filter((item) => item.employeeId === employee.id).map((item) => ({ id: `request-${item.id}`, at: item.createdAt, title: `Submitted request: ${item.subject}`, detail: `${item.type} · now ${item.status}` })),
      ...acknowledgements.filter((item) => item.acknowledgedAt).map((item) => ({ id: `ack-${item.documentId}`, at: item.acknowledgedAt!, title: 'Acknowledged a document', detail: data.documents.find((document) => document.id === item.documentId)?.title ?? 'Document' })),
      ...data.lifecycleCases.filter((item) => item.employeeId === employee.id).map((item) => ({ id: `case-${item.id}`, at: `${item.targetDate}T00:00:00+08:00`, title: `${item.type} checklist`, detail: `${item.status} · target ${formatDate(item.targetDate)}` })),
    ].sort((left, right) => right.at.localeCompare(left.at))
    const audit = data.auditLog.filter((entry) => entry.target.includes(employee.id)).slice(0, 10)
    return <div className="employee-360-stack">
      {events.length ? <ol className="timeline-list">{events.map((event) => <li key={event.id}><span aria-hidden="true" /><div><strong>{event.title}</strong><p>{event.detail}</p></div><time>{formatDateTime(event.at)}</time></li>)}</ol> : <EmptyState compact icon={Activity} title="No activity yet" text="Requests, acknowledgements, and checklists will appear here." />}
      {audit.length > 0 && <><div className="subsection-title"><div><h3>Audit log</h3><p>Recorded changes mentioning this employee</p></div></div><div className="activity-feed">{audit.map((entry) => <article key={entry.id}><span aria-hidden="true"><Activity /></span><div><strong>{entry.action}</strong><p>{entry.actor} · {entry.target}</p></div><time>{entry.time}</time></article>)}</div></>}
    </div>
  }

  return <div className="employee-360-stack"><dl className="key-values key-values-inline"><div><dt>Open alerts</dt><dd>{alerts.filter((item) => !['Resolved', 'False Positive'].includes(item.status)).length}</dd></div><div><dt>Recorded sign-ins</dt><dd>{sessions.length}</dd></div><div><dt>Portal access</dt><dd>{employee.status === 'Inactive' ? 'Blocked' : 'Employee portal'}</dd></div></dl>{alerts.length ? <div className="compact-record-list">{alerts.slice(0, 5).map((item) => <article key={item.id}><div><strong>{item.title}</strong><p>{item.time}</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></article>)}</div> : <EmptyState compact icon={ShieldCheck} title="No security alerts" text="Account-security events for this employee appear here." />}</div>
}
