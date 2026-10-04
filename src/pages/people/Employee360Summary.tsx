import { BriefcaseBusiness, ContactRound, HeartHandshake, type LucideIcon } from 'lucide-react'
import type { EmployeeRecord } from '../../types/hrms.js'
import { formatDate, formatMoney } from '../../utils/format.js'

interface Props {
  employee: EmployeeRecord
  manager?: EmployeeRecord
  openRequests?: number
  pendingLeave?: number
  activeGoals?: number
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

export function Employee360Summary({ employee, manager }: Props) {
  return <div className="employee-360-overview">
    <div className="employee-360-primary">
      <InformationSection title="Personal & contact details" description="Identity and everyday contact information." icon={ContactRound} fields={[
        { label: 'Legal name', value: [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ') },
        { label: 'Preferred name', value: employee.preferredName },
        { label: 'Work email', value: employee.email },
        { label: 'Phone number', value: employee.phone },
      ]} />
      <InformationSection title="Employment details" description="Current assignment and reporting line." icon={BriefcaseBusiness} fields={[
        { label: 'Department', value: employee.department },
        { label: 'Position', value: employee.position },
        { label: 'Employment type', value: employee.employmentType },
        { label: 'Work arrangement', value: employee.workArrangement },
        { label: 'Work location', value: employee.workLocation },
        { label: 'Start date', value: employee.hireDate ? formatDate(employee.hireDate) : undefined },
        { label: 'Reports to', value: manager ? `${manager.firstName} ${manager.lastName}` : 'Not assigned' },
        { label: 'Cost center', value: employee.costCenter },
        { label: 'Monthly base salary', value: employee.salary ? formatMoney(employee.salary) : undefined },
        { label: 'Employee ID', value: employee.id },
      ]} />
    </div>
    <aside className="employee-360-secondary" aria-label="Emergency information">
      <InformationSection title="Emergency contact" description="For urgent situations only." icon={HeartHandshake} fields={[
        { label: 'Contact name', value: employee.emergencyContactName },
        { label: 'Relationship', value: employee.emergencyContactRelationship },
        { label: 'Contact phone', value: employee.emergencyContactPhone },
      ]} />
    </aside>
  </div>
}
