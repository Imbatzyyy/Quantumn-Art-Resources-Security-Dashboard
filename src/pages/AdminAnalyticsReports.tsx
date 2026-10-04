import { useState } from 'react'
import { CalendarClock, ClipboardCheck, Download, PhilippinePeso, ShieldCheck, Users } from 'lucide-react'
import { SectionHeading } from '../components/ui.js'
import { BarList, ChartPanel, ColumnChart, KeyFigure } from '../components/charts.js'
import { useHrms } from '../state/useHrms.js'
import { downloadCsv } from '../utils/downloads.js'
import { formatMoney } from '../utils/format.js'
import { businessDate } from '../utils/securityMetrics.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const reports = [
  { id: 'workforce', title: 'Employee directory', text: 'Status, department, position, and start date for every employee.', icon: Users },
  { id: 'attendance', title: 'Attendance register', text: 'Clock-ins, clock-outs, hours, and status for the selected period.', icon: CalendarClock },
  { id: 'requests', title: 'Leave and request decisions', text: 'Leave and HR requests with their outcome, for the selected period.', icon: ClipboardCheck },
  { id: 'payroll', title: 'Payroll totals', text: 'Each pay period’s stage, headcount, and gross and net totals.', icon: PhilippinePeso },
  { id: 'audit', title: 'Audit log', text: 'Sensitive actions, who did them, and what they affected.', icon: ShieldCheck },
] as const
type ReportId = typeof reports[number]['id']
const reportAccess: Record<string, ReportId[]> = {
  admin: ['workforce', 'attendance', 'requests', 'payroll', 'audit'],
  hr_admin: ['workforce', 'attendance', 'requests', 'audit'],
  payroll_admin: ['workforce', 'payroll', 'audit'],
  security_admin: ['audit'],
  auditor: ['workforce', 'attendance', 'requests', 'payroll', 'audit'],
}
const ranges = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: '365', label: 'Last 12 months', days: 365 },
  { id: 'all', label: 'All time', days: null },
] as const
const monthLabel = (month: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
const addDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)

export default function AdminAnalyticsReports() {
  const { data, recordActivity, user } = useHrms()
  const [rangeId, setRangeId] = useState<typeof ranges[number]['id']>('90')
  if (!data) return null
  const today = businessDate()
  const range = ranges.find((item) => item.id === rangeId)!
  const from = range.days ? addDays(today, -(range.days - 1)) : '0000-01-01'
  const inRange = (date?: string | null) => Boolean(date) && date!.slice(0, 10) >= from && date!.slice(0, 10) <= today
  const allowedReports = reportAccess[user?.role || ''] || []

  const employees = data.employees.filter((employee) => employee.role === 'employee')
  const active = employees.filter((employee) => ['Active', 'On Leave'].includes(employee.status))
  const attendance = data.attendance.filter((item) => inRange(item.date))
  const leave = data.leaveRequests.filter((item) => inRange(item.startDate))
  const requests = data.employeeRequests.filter((item) => inRange(item.createdAt))
  const countBy = <T,>(rows: T[], key: (row: T) => string) => Object.entries(rows.reduce<Record<string, number>>((totals, row) => { const value = key(row) || 'Not set'; totals[value] = (totals[value] ?? 0) + 1; return totals }, {}))
    .map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value)

  const tenureYears = (hireDate?: string) => hireDate ? (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${hireDate}T00:00:00Z`)) / (365.25 * 86_400_000) : null
  const tenures = active.map((employee) => tenureYears(employee.hireDate)).filter((value): value is number => value !== null && value >= 0)
  const averageTenure = tenures.length ? tenures.reduce((sum, value) => sum + value, 0) / tenures.length : null
  const tenureBuckets = [
    { label: 'Less than 1 year', test: (years: number) => years < 1 },
    { label: '1 to 2 years', test: (years: number) => years >= 1 && years < 2 },
    { label: '2 to 5 years', test: (years: number) => years >= 2 && years < 5 },
    { label: '5 years or more', test: (years: number) => years >= 5 },
  ].map((bucket) => ({ label: bucket.label, value: tenures.filter(bucket.test).length }))

  const months = Array.from({ length: 12 }, (_, index) => { const date = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - (11 - index)); return date.toISOString().slice(0, 7) })
  const hiresByMonth = months.map((month) => ({ label: monthLabel(month), values: [employees.filter((employee) => employee.hireDate?.startsWith(month)).length] }))

  const weeks = (() => {
    const span = range.days ? Math.min(range.days, 84) : 84
    const count = Math.max(1, Math.ceil(span / 7))
    return Array.from({ length: count }, (_, index) => { const end = addDays(today, -7 * (count - 1 - index)); return { start: addDays(end, -6), end } })
  })()
  const attendanceTrend = weeks.map((week) => {
    const rows = data.attendance.filter((item) => item.date >= week.start && item.date <= week.end && item.clockIn)
    return { label: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${week.start}T00:00:00Z`)), values: [rows.filter((item) => item.status !== 'Late').length, rows.filter((item) => item.status === 'Late').length] }
  })
  const clockIns = attendance.filter((item) => item.clockIn)
  const lateRate = clockIns.length ? Math.round((clockIns.filter((item) => item.status === 'Late').length / clockIns.length) * 100) : null
  const leaveByType = Object.entries(leave.filter((item) => ['Approved', 'Pending'].includes(item.status)).reduce<Record<string, { approved: number; pending: number }>>((totals, item) => {
    totals[item.type] ??= { approved: 0, pending: 0 }
    totals[item.type][item.status === 'Approved' ? 'approved' : 'pending'] += item.days
    return totals
  }, {})).map(([label, value]) => ({ label, value: value.approved, detail: value.pending ? `${value.pending} more day${value.pending === 1 ? '' : 's'} pending` : undefined })).sort((left, right) => right.value - left.value)
  const decided = requests.filter((item) => ['Approved', 'Rejected', 'Completed'].includes(item.status)).length
  const decisionRate = requests.length ? Math.round((decided / requests.length) * 100) : null
  const latestRun = data.payrollRuns[0]
  const payrollByDepartment = latestRun ? Object.entries(data.payroll.filter((item) => item.runId === latestRun.id || (!item.runId && item.period === latestRun.period)).reduce<Record<string, number>>((totals, record) => {
    const department = data.employees.find((employee) => employee.id === record.employeeId)?.department ?? 'Not set'
    totals[department] = (totals[department] ?? 0) + record.gross + record.allowances + record.bonuses
    return totals
  }, {})).map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value) : []
  const payrollTrend = [...data.payrollRuns].slice(0, 6).reverse().map((run) => ({ label: run.period.replace(/(\w{3})\w*\s(\d{4})/, '$1 $2'), values: [run.netTotal] }))
  const showPayroll = allowedReports.includes('payroll')
  const showPeople = allowedReports.includes('workforce')

  const generate = async (id: ReportId, title: string) => {
    let rows: object[]
    let columns: Array<{ label: string; key: string }>
    if (id === 'workforce') {
      rows = employees
      columns = [{ label: 'Employee ID', key: 'id' }, { label: 'First name', key: 'firstName' }, { label: 'Last name', key: 'lastName' }, { label: 'Department', key: 'department' }, { label: 'Position', key: 'position' }, { label: 'Employment type', key: 'employmentType' }, { label: 'Status', key: 'status' }, { label: 'Start date', key: 'hireDate' }]
    } else if (id === 'attendance') {
      rows = attendance
      columns = [{ label: 'Employee ID', key: 'employeeId' }, { label: 'Date', key: 'date' }, { label: 'Clock in', key: 'clockIn' }, { label: 'Clock out', key: 'clockOut' }, { label: 'Hours', key: 'hours' }, { label: 'Status', key: 'status' }]
    } else if (id === 'requests') {
      rows = [...requests, ...leave.map((item) => ({ ...item, subject: `${item.type} leave: ${item.startDate} to ${item.endDate}`, priority: 'Normal', type: 'Leave', createdAt: item.startDate }))]
      columns = [{ label: 'Request ID', key: 'id' }, { label: 'Employee ID', key: 'employeeId' }, { label: 'Type', key: 'type' }, { label: 'Subject', key: 'subject' }, { label: 'Priority', key: 'priority' }, { label: 'Status', key: 'status' }, { label: 'Decision note', key: 'decisionNote' }, { label: 'Date', key: 'createdAt' }]
    } else if (id === 'payroll') {
      rows = data.payrollRuns
      columns = [{ label: 'Period', key: 'period' }, { label: 'Stage', key: 'status' }, { label: 'Employee count', key: 'employeeCount' }, { label: 'Gross total', key: 'grossTotal' }, { label: 'Net total', key: 'netTotal' }, { label: 'Approved by', key: 'approvedBy' }, { label: 'Released at', key: 'releasedAt' }]
    } else {
      rows = data.auditLog
      columns = [{ label: 'Actor', key: 'actor' }, { label: 'Action', key: 'action' }, { label: 'Target', key: 'target' }, { label: 'Time', key: 'time' }]
    }
    const period = ['attendance', 'requests'].includes(id) ? `-${range.label.toLowerCase().replaceAll(' ', '-')}` : ''
    downloadCsv(`${title.toLowerCase().replaceAll(' ', '-')}${period}`, columns, rows)
    try { await recordActivity({ action: 'Exported authorized HR report', target: `${title}${period ? ` (${range.label})` : ''}` }) } catch { /* Download completed; shared toast reports audit failure. */ }
  }

  return <div className="page-stack">
    <SectionHeading
      title="Reports & Analytics"
      description="Workforce, attendance, leave, and payroll trends, plus downloadable reports. Every download is recorded in the audit log."
      actions={<label className="select-field"><span>Period</span><select value={rangeId} onChange={(event) => setRangeId(event.target.value as typeof rangeId)}>{ranges.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    />

    <section className="panel key-figures" aria-label="Key figures">
      {showPeople && <KeyFigure label="Headcount" value={active.length} detail={`${employees.filter((employee) => employee.status === 'Inactive').length} inactive accounts`} />}
      {showPeople && <KeyFigure label="Average tenure" value={averageTenure === null ? '—' : `${averageTenure.toFixed(1)} yrs`} detail="Active employees" />}
      {showPeople && <KeyFigure label="Late arrivals" value={lateRate === null ? '—' : `${lateRate}%`} detail={`Of ${clockIns.length} clock-ins · ${range.label.toLowerCase()}`} />}
      {showPeople && <KeyFigure label="Leave taken" value={`${leave.filter((item) => item.status === 'Approved').reduce((sum, item) => sum + item.days, 0)} days`} detail={range.label} />}
      {showPeople && <KeyFigure label="Requests decided" value={decisionRate === null ? '—' : `${decisionRate}%`} detail={`${decided} of ${requests.length} · ${requests.filter((item) => openRequestStatuses.includes(item.status)).length} still open`} />}
      {showPayroll && <KeyFigure label="Latest net payroll" value={latestRun ? formatMoney(latestRun.netTotal) : '—'} detail={latestRun ? `${latestRun.period} · ${latestRun.status}` : 'No run yet'} />}
    </section>

    {showPeople && <div className="content-grid content-grid-2">
      <ChartPanel title="Headcount by department" description="Active and on-leave employees"><BarList label="Headcount by department" data={countBy(active, (employee) => employee.department)} empty="No employees yet." /></ChartPanel>
      <ChartPanel title="Tenure" description="How long active employees have been with the company"><BarList label="Tenure distribution" data={tenureBuckets} tone="purple" empty="No start dates recorded." /></ChartPanel>
      <ChartPanel title="New hires" description="Employees by start month, last 12 months"><ColumnChart label="New hires by month" data={hiresByMonth} series={[{ name: 'New hires', tone: 'blue' }]} empty="No hires in the last 12 months." /></ChartPanel>
      <ChartPanel title="Employment type" description="Active employees"><BarList label="Employment type" data={countBy(active, (employee) => employee.employmentType ?? '')} tone="green" empty="No employees yet." /></ChartPanel>
      <ChartPanel title="Attendance by week" description={`On-time and late clock-ins · ${range.days && range.days < 84 ? range.label.toLowerCase() : 'last 12 weeks'}`}><ColumnChart label="Weekly attendance" data={attendanceTrend} series={[{ name: 'On time', tone: 'green' }, { name: 'Late', tone: 'amber' }]} empty="No clock-ins in this period." /></ChartPanel>
      <ChartPanel title="Leave taken by type" description={`Approved days · ${range.label.toLowerCase()}`}><BarList label="Leave days by type" data={leaveByType} tone="amber" format={(value) => `${value} day${value === 1 ? '' : 's'}`} empty="No leave in this period." /></ChartPanel>
      <ChartPanel title="HR requests by type" description={`Submitted · ${range.label.toLowerCase()}`}><BarList label="HR requests by type" data={countBy(requests, (item) => item.type)} empty="No requests in this period." /></ChartPanel>
      {showPayroll && <ChartPanel title="Payroll cost by department" description={latestRun ? `Total earnings · ${latestRun.period}` : 'No payroll run yet'}><BarList label="Payroll cost by department" data={payrollByDepartment} tone="green" format={formatMoney} empty="No payroll records yet." /></ChartPanel>}
    </div>}
    {showPayroll && !showPeople && <ChartPanel title="Payroll cost by department" description={latestRun ? `Total earnings · ${latestRun.period}` : 'No payroll run yet'}><BarList label="Payroll cost by department" data={payrollByDepartment} tone="green" format={formatMoney} empty="No payroll records yet." /></ChartPanel>}
    {showPayroll && <ChartPanel title="Net payroll by period" description="Most recent pay periods"><ColumnChart label="Net payroll by period" data={payrollTrend} series={[{ name: 'Net payroll', tone: 'green' }]} format={formatMoney} empty="No payroll runs yet." /></ChartPanel>}

    <section className="panel">
      <div className="panel-header"><div><h2>Download reports</h2><p>CSV files open in Excel or Google Sheets. Attendance and request reports follow the selected period.</p></div></div>
      <div className="report-list">{reports.filter((report) => allowedReports.includes(report.id)).map(({ id, title, text, icon: Icon }) => <article key={id}>
        <span className="report-list-icon" aria-hidden="true"><Icon /></span>
        <div><h3>{title}</h3><p>{text}</p></div>
        <button className="button button-secondary button-small" onClick={() => void generate(id, title)}><Download size={16} aria-hidden="true" />Download CSV</button>
      </article>)}</div>
    </section>
  </div>
}
