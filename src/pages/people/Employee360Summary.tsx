import { BriefcaseBusiness, CalendarDays, ContactRound, HeartHandshake, Inbox, Target, type LucideIcon } from 'lucide-react'
import type { EmployeeRecord } from '../../types/hrms.js'

interface Props {
  employee: EmployeeRecord
  manager?: EmployeeRecord
  openRequests: number
  pendingLeave: number
  activeGoals: number
}

function InformationSection({ title, description, icon: Icon, fields }: {
  title: string
  description: string
  icon: LucideIcon
  fields: { label: string; value?: string }[]
}) {
  return <section className="employee-360-card" aria-label={title}>
    <header><Icon size={19} aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p></div></header>
    <dl className="employee-360-fields">{fields.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd className={!value ? 'employee-360-missing' : undefined}>{value || 'Not provided'}</dd></div>)}</dl>
  </section>
}

export function Employee360Summary({ employee, manager, openRequests, pendingLeave, activeGoals }: Props) {
  return <div className="employee-360-overview">
    <div className="employee-360-primary">
      <InformationSection title="Personal & contact details" description="Identity and everyday contact information." icon={ContactRound} fields={[
        { label: 'Legal name', value: [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ') },
        { label: 'Preferred name', value: employee.preferredName },
        { label: 'Work email', value: employee.email },
        { label: 'Phone number', value: employee.phone },
      ]} />
      <InformationSection title="Employment details" description="Current assignment and reporting relationship." icon={BriefcaseBusiness} fields={[
        { label: 'Department', value: employee.department },
        { label: 'Position', value: employee.position },
        { label: 'Employment type', value: employee.employmentType },
        { label: 'Work arrangement', value: employee.workArrangement },
        { label: 'Work location', value: employee.workLocation },
        { label: 'Cost center', value: employee.costCenter },
        { label: 'Reports to', value: manager ? `${manager.firstName} ${manager.lastName}` : 'Not assigned' },
        { label: 'Employee ID', value: employee.id },
      ]} />
    </div>
    <aside className="employee-360-secondary" aria-label="Employee highlights">
      <section className="employee-360-card employee-360-activity"><header><Inbox size={19} aria-hidden="true" /><div><h3>At a glance</h3><p>Current employee activity.</p></div></header><dl>
        {[{ label: 'Open requests', value: openRequests, icon: Inbox }, { label: 'Leave pending', value: pendingLeave, icon: CalendarDays }, { label: 'Active goals', value: activeGoals, icon: Target }].map(({ label, value, icon: Icon }) => <div key={label}><dt><Icon size={16} aria-hidden="true" />{label}</dt><dd>{value}</dd></div>)}
      </dl></section>
      <InformationSection title="Emergency contact" description="For urgent employee support." icon={HeartHandshake} fields={[
        { label: 'Contact name', value: employee.emergencyContactName },
        { label: 'Relationship', value: employee.emergencyContactRelationship },
        { label: 'Contact phone', value: employee.emergencyContactPhone },
      ]} />
    </aside>
  </div>
}
