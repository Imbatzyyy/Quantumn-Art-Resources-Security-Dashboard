import { CalendarClock, ClipboardCheck, Download, FileCheck2, FolderLock, PhilippinePeso, ShieldCheck, Users } from 'lucide-react'
import { SectionHeading, StatCard } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { downloadCsv } from '../utils/downloads.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const reports = [
  { id: 'workforce', title: 'Workforce directory', text: 'Employment status, department, role, and hire date.', icon: Users },
  { id: 'attendance', title: 'Attendance register', text: 'Dates, clock events, recorded hours, and exceptions.', icon: CalendarClock },
  { id: 'requests', title: 'Request decisions', text: 'Leave and HR request status for operational review.', icon: ClipboardCheck },
  { id: 'payroll', title: 'Payroll control totals', text: 'Authorized run stages, headcount, and aggregate totals.', icon: PhilippinePeso },
  { id: 'audit', title: 'Security audit trail', text: 'Authenticated sensitive actions and affected records.', icon: ShieldCheck },
] as const
type ReportId = typeof reports[number]['id']

export default function AdminAnalyticsReports() {
  const { data, recordActivity } = useHrms()
  if (!data) return null

  const generate = async (id: ReportId, title: string) => {
    let rows: object[]
    let columns: Array<{ label: string; key: string }>
    if (id === 'workforce') {
      rows = data.employees
      columns = [{ label: 'Employee ID', key: 'id' }, { label: 'First name', key: 'firstName' }, { label: 'Last name', key: 'lastName' }, { label: 'Department', key: 'department' }, { label: 'Position', key: 'position' }, { label: 'Role', key: 'role' }, { label: 'Status', key: 'status' }, { label: 'Hire date', key: 'hireDate' }]
    } else if (id === 'attendance') {
      rows = data.attendance
      columns = [{ label: 'Employee ID', key: 'employeeId' }, { label: 'Date', key: 'date' }, { label: 'Clock in', key: 'clockIn' }, { label: 'Clock out', key: 'clockOut' }, { label: 'Hours', key: 'hours' }, { label: 'Status', key: 'status' }]
    } else if (id === 'requests') {
      rows = data.employeeRequests
      columns = [{ label: 'Request ID', key: 'id' }, { label: 'Employee ID', key: 'employeeId' }, { label: 'Type', key: 'type' }, { label: 'Subject', key: 'subject' }, { label: 'Priority', key: 'priority' }, { label: 'Status', key: 'status' }, { label: 'Decision note', key: 'decisionNote' }, { label: 'Submitted', key: 'createdAt' }]
    } else if (id === 'payroll') {
      rows = data.payrollRuns
      columns = [{ label: 'Period', key: 'period' }, { label: 'Stage', key: 'status' }, { label: 'Employee count', key: 'employeeCount' }, { label: 'Gross total', key: 'grossTotal' }, { label: 'Net total', key: 'netTotal' }, { label: 'Approved by', key: 'approvedBy' }, { label: 'Released at', key: 'releasedAt' }]
    } else {
      rows = data.auditLog
      columns = [{ label: 'Actor', key: 'actor' }, { label: 'Action', key: 'action' }, { label: 'Target', key: 'target' }, { label: 'Time', key: 'time' }]
    }
    downloadCsv(title.toLowerCase().replaceAll(' ', '-'), columns, rows)
    try { await recordActivity({ action: 'Exported authorized HR report', target: title }) } catch { /* Download completed; shared toast reports audit failure. */ }
  }

  const departments = [...new Set(data.employees.map((item) => item.department))]
  const completedRequests = data.employeeRequests.filter((item) => ['Approved', 'Rejected', 'Completed'].includes(item.status)).length
  const decisionRate = data.employeeRequests.length ? Math.round((completedRequests / data.employeeRequests.length) * 100) : 100
  const maxDepartment = Math.max(1, ...departments.map((department) => data.employees.filter((item) => item.department === department && item.status === 'Active').length))

  return <div className="page-stack">
    <SectionHeading eyebrow="Decision-ready evidence" title="Analytics & Reports" description="Export authorized fictional records and review operational indicators. Every export is added to the audit trail." />
    <div className="stats-grid stats-grid-3"><StatCard icon={Users} label="Workforce records" value={data.employees.length} tone="blue" /><StatCard icon={ClipboardCheck} label="Request decision rate" value={`${decisionRate}%`} tone="green" /><StatCard icon={ShieldCheck} label="Audit events" value={data.auditLog.length} tone="purple" /></div>
    <div className="content-grid dashboard-grid"><section className="panel"><div className="panel-header"><div><h2>Workforce distribution</h2><p>Active people by department</p></div></div><div className="bar-chart">{departments.map((department) => { const count = data.employees.filter((item) => item.department === department && item.status === 'Active').length; return <div key={department}><span>{department}</span><progress value={count} max={maxDepartment}>{count}</progress><strong>{count}</strong></div> })}</div></section><section className="panel"><div className="panel-header"><div><h2>Governance snapshot</h2><p>Controls that require administrator attention</p></div></div><div className="governance-list"><article><span><FileCheck2 /></span><div><strong>{data.employeeRequests.filter((item) => openRequestStatuses.includes(item.status)).length} open HR requests</strong><p>Awaiting review, information, or completion</p></div></article><article><span><FolderLock /></span><div><strong>{data.documents.filter((item) => item.requiresAck).length} acknowledgement policies</strong><p>Tracked per employee in Supabase</p></div></article><article><span><ShieldCheck /></span><div><strong>{data.securityAlerts.filter((item) => item.status !== 'Resolved').length} open security alerts</strong><p>Prioritized by plain-language impact</p></div></article></div></section></div>
    <section className="report-grid premium-report-grid">{reports.map(({ id, title, text, icon: Icon }) => <article className="panel report-card" key={id}><span><Icon /></span><h2>{title}</h2><p>{text}</p><button className="button button-secondary" onClick={() => void generate(id, title)}><Download size={17} />Download CSV</button></article>)}</section>
  </div>
}
