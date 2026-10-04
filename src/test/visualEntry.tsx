import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import AdminInviteSetupPage from '../pages/AdminInviteSetupPage.js'
import AdminPortal from '../pages/AdminPortal.js'
import EmployeePortal from '../pages/EmployeePortal.js'
import LoginPage from '../pages/LoginPage.js'
import { HrmsState } from '../state/HrmsState.js'
import type { AttendanceRecord, EmployeeRecord, HrmsSnapshot, PayrollRecord, PortalIdentity, ScheduleRecord } from '../types/hrms.js'
import { createTestContext, emptySnapshot } from './testContext.js'
import { saveThemePreference } from '../utils/theme.js'
import { businessDate } from '../utils/securityMetrics.js'
import { DEFAULT_LEAVE_POLICIES } from '../utils/leave.js'
import { phStatutoryDeductions } from '../utils/payrollPh.js'
import '@fontsource-variable/inter'
import '../styles.css'

// All fixture dates are relative to "today" so the screens look the same under
// the frozen Playwright clock and when the harness is opened by hand.
const today = businessDate()
const day = (offset: number) => new Date(new Date(`${today}T00:00:00Z`).getTime() + offset * 86_400_000).toISOString().slice(0, 10)
const at = (offset: number, time = '09:00') => `${day(offset)}T${time}:00+08:00`
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

const adminIdentity: PortalIdentity = {
  id: 'ADM001',
  portal: 'admin',
  firstName: 'Alex',
  lastName: 'Reyes',
  preferredName: 'Alex',
  position: 'System Administrator',
  department: 'People Operations',
  role: 'admin',
  status: 'Active',
  email: 'alex.reyes@quantum.example',
}

const employeeIdentity: PortalIdentity = {
  id: 'EMP001',
  portal: 'employee',
  firstName: 'Maya',
  lastName: 'Santos',
  preferredName: 'Maya',
  position: 'Product Designer',
  department: 'Creative Studio',
  role: 'employee',
  status: 'Active',
  email: 'maya.santos@quantum.example',
  phone: '+63 917 555 0134',
  employmentType: 'Full-time',
  workArrangement: 'Hybrid',
  workLocation: 'Makati HQ',
  costCenter: 'DSN-210',
  hireDate: '2025-02-10',
  mustChangePassword: false,
}

const person = (id: string, firstName: string, lastName: string, department: string, position: string, extra: Partial<EmployeeRecord> = {}): EmployeeRecord => ({
  id, firstName, lastName, preferredName: firstName, email: `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '') + '@quantum.example',
  role: 'employee', status: 'Active', department, position, employmentType: 'Full-time', workArrangement: 'On-site',
  workLocation: 'Makati HQ', managerId: 'ADM002', salary: 45000, hireDate: '2024-06-03', phone: '+63 917 555 0100', ...extra,
})

const employees: EmployeeRecord[] = [
  { ...adminIdentity, email: adminIdentity.email!, role: 'admin', status: 'Active', department: 'People Operations', position: 'System Administrator', employmentType: 'Full-time', workArrangement: 'Hybrid', workLocation: 'Makati HQ', costCenter: 'HR-100', hireDate: '2024-01-15' },
  person('ADM002', 'Sierra', 'Navarro', 'Human Resources', 'HR Manager', { role: 'hr_admin', managerId: 'ADM001', hireDate: '2023-03-01' }),
  { ...person('EMP001', 'Maya', 'Santos', 'Creative Studio', 'Product Designer', { workArrangement: 'Hybrid', costCenter: 'DSN-210', managerId: 'ADM001', salary: 56000, hireDate: '2025-02-10', phone: '+63 917 555 0134', emergencyContactName: 'Rosa Santos', emergencyContactRelationship: 'Mother', emergencyContactPhone: '+63 917 555 0199' }), email: 'maya.santos@quantum.example' },
  { ...person('EMP002', 'Noah', 'Villanueva', 'Finance', 'Finance Analyst', { costCenter: 'FIN-120', managerId: 'ADM001', salary: 52000, hireDate: '2025-06-02' }), email: 'noah.villanueva@quantum.example' },
  person('EMP003', 'Ana', 'Cruz', 'Operations', 'Operations Lead', { salary: 61000, hireDate: '2022-10-03' }),
  person('EMP004', 'Paolo', 'Reyes', 'Technology', 'Software Engineer', { workArrangement: 'Remote', workLocation: 'Home office', salary: 72000, hireDate: '2023-11-13' }),
  person('EMP005', 'Bea', 'Lim', 'Human Resources', 'HR Associate', { status: 'On Leave', salary: 38000, hireDate: '2024-09-16' }),
  person('EMP006', 'Carlo', 'Mendoza', 'Sales & Marketing', 'Account Manager', { employmentType: 'Contract', workArrangement: 'Hybrid', salary: 48000, hireDate: `${day(-400).slice(0, 7)}-${today.slice(8, 10)}` }),
  person('EMP007', 'Joy', 'Garcia', 'Technology', 'QA Analyst', { hireDate: day(-9), salary: 42000 }),
  person('EMP008', 'Luis', 'Tan', 'Operations', 'Warehouse Coordinator', { status: 'Inactive', hireDate: '2021-04-12', managerId: 'EMP003' }),
]
const activeStaff = employees.filter((item) => item.role === 'employee' && item.status === 'Active')

const schedules: ScheduleRecord[] = []
for (let offset = -14; offset <= 10; offset += 1) {
  const date = day(offset)
  const weekend = [0, 6].includes(weekday(date))
  for (const employee of activeStaff) {
    if (weekend) {
      if (offset >= -6 && offset <= 6) schedules.push({ id: `SCH-${employee.id}-${date}`, employeeId: employee.id, date, shiftStart: '00:00', shiftEnd: '00:00', workMode: 'Rest Day', location: 'Not scheduled' })
      continue
    }
    const remote = employee.workArrangement === 'Remote' || (employee.workArrangement === 'Hybrid' && weekday(date) === 5)
    schedules.push({ id: `SCH-${employee.id}-${date}`, employeeId: employee.id, date, shiftStart: '09:00', shiftEnd: '18:00', workMode: remote ? 'Remote' : employee.workArrangement === 'Hybrid' ? 'Hybrid' : 'On-site', location: remote ? 'Home office' : 'Makati HQ' })
  }
}

const attendance: AttendanceRecord[] = []
for (let offset = -30; offset <= 0; offset += 1) {
  const date = day(offset)
  if ([0, 6].includes(weekday(date))) continue
  activeStaff.forEach((employee, index) => {
    if (offset === 0 && index > 3) return
    if (employee.id === 'EMP003' && offset === 0) return
    const late = (offset + index) % 7 === 0
    const clockIn = late ? '09:18' : `08:${String(40 + ((index * 7 + offset * 3 + 60) % 19)).padStart(2, '0')}`
    attendance.push({ id: `ATT-${employee.id}-${date}`, employeeId: employee.id, date, clockIn, clockOut: offset === 0 ? null : '18:04', hours: offset === 0 ? 0.5 : late ? 8.8 : 9.2, status: offset === 0 ? (late ? 'Late' : 'Working') : late ? 'Late' : 'Present' })
  })
}

const payslip = (employeeId: string, runId: number, period: string, gross: number, status: string, allowances = 0, bonuses = 0): PayrollRecord => {
  // The latest run uses itemized Philippine statutory deductions.
  if (runId === 3) {
    const statutory = phStatutoryDeductions(gross)
    return { id: `PAY-${runId}-${employeeId}`, employeeId, runId, period, gross, allowances, bonuses, deductions: statutory.total, net: gross + allowances + bonuses - statutory.total, status, sss: statutory.sss, philhealth: statutory.philhealth, pagibig: statutory.pagibig, withholdingTax: statutory.withholdingTax }
  }
  const deductions = Math.round((gross + allowances + bonuses) * 0.0825)
  return { id: `PAY-${runId}-${employeeId}`, employeeId, runId, period, gross, allowances, bonuses, deductions, net: gross + allowances + bonuses - deductions, status }
}
const payrollStaff = activeStaff.filter((employee) => employee.id !== 'EMP007')
const payroll = [
  ...payrollStaff.map((employee) => payslip(employee.id, 3, 'August 2026', employee.salary ?? 40000, 'Released', 2000)),
  ...payrollStaff.map((employee) => payslip(employee.id, 2, 'July 2026', employee.salary ?? 40000, 'Paid', 2000)),
  ...payrollStaff.map((employee) => payslip(employee.id, 1, 'June 2026', employee.salary ?? 40000, 'Locked', 2000, employee.id === 'EMP001' ? 5000 : 0)),
]
const runTotal = (runId: number) => payroll.filter((item) => item.runId === runId)

const policyText = `Information Security Policy (version 3.1)

1. Purpose
This policy explains how every employee protects company and personal information.

2. Passwords and sign-in
Use a long, unique password for the HR portal and turn on two-step sign-in. Never share your password or verification codes.

3. Handling personal data
Only open employee records you need for your work. Do not send payslips or personal details by chat or personal email.

4. Reporting
Report lost devices or suspicious messages to HR or IT the same day.`

const demoSnapshot: HrmsSnapshot = {
  ...emptySnapshot,
  employees,
  attendance,
  schedules,
  leaveRequests: [
    { id: 'LR-101', employeeId: 'EMP001', status: 'Pending', type: 'Vacation', startDate: day(8), endDate: day(9), days: 2, reason: 'Family commitment' },
    { id: 'LR-102', employeeId: 'EMP003', status: 'Approved', type: 'Sick', startDate: day(0), endDate: day(1), days: 2, reason: 'Medical appointment and recovery' },
    { id: 'LR-103', employeeId: 'EMP004', status: 'Pending', type: 'Vacation', startDate: day(8), endDate: day(12), days: 5, reason: 'Out-of-town trip with family' },
    { id: 'LR-104', employeeId: 'EMP007', status: 'Pending', type: 'Emergency', startDate: day(2), endDate: day(2), days: 1, reason: 'Urgent family matter' },
    { id: 'LR-105', employeeId: 'EMP001', status: 'Approved', type: 'Vacation', startDate: day(-40), endDate: day(-38), days: 3, reason: 'Holiday trip', decisionNote: 'Approved. Enjoy the trip!' },
    { id: 'LR-106', employeeId: 'EMP002', status: 'Rejected', type: 'Vacation', startDate: day(-20), endDate: day(-19), days: 2, reason: 'Personal errands', decisionNote: 'Month-end close needs full coverage. Please choose dates after the 5th.' },
    { id: 'LR-108', employeeId: 'EMP001', status: 'Cancelled', type: 'Sick', startDate: day(-14), endDate: day(-14), days: 1, reason: 'Dental appointment', cancelledAt: at(-15, '17:00') },
    { id: 'LR-107', employeeId: 'EMP005', status: 'Approved', type: 'Other', startDate: day(-5), endDate: day(20), days: 26, reason: 'Extended personal leave approved by HR' },
  ],
  employeeRequests: [
    { id: 'REQ-204', employeeId: 'EMP001', status: 'Under Review', type: 'Attendance Correction', subject: 'Correct Friday clock-out', description: 'My approved off-site client meeting ended at 5:30 PM.', priority: 'Normal', requestedDate: day(-3), requestedValue: '5:30 PM', createdAt: at(-2, '10:15'), updatedAt: at(-1, '09:20') },
    { id: 'REQ-205', employeeId: 'EMP002', status: 'Submitted', type: 'Payroll Concern', subject: 'Missing transport allowance in July', description: 'My July payslip does not show the approved transport allowance.', priority: 'High', requestedDate: day(-10), requestedValue: '₱2,000', createdAt: at(-1, '14:05'), updatedAt: at(-1, '14:05') },
    { id: 'REQ-206', employeeId: 'EMP004', status: 'Completed', type: 'Document Request', subject: 'Certificate of employment for visa', description: 'I need a certificate of employment for my visa application.', priority: 'Normal', createdAt: at(-12, '11:00'), updatedAt: at(-9, '16:30'), decisionNote: 'Certificate issued and uploaded to your documents.' },
    { id: 'REQ-207', employeeId: 'EMP006', status: 'More Information', type: 'Overtime', subject: 'Overtime for client launch', description: 'Worked 3 extra hours for the product launch event.', priority: 'Urgent', requestedDate: day(-4), requestedValue: '3 hours', createdAt: at(-4, '19:30'), updatedAt: at(-3, '10:00') },
  ],
  requestComments: [
    { id: 'CMT-301', requestId: 'REQ-204', authorId: 'ADM001', body: 'We are validating the approved client schedule.', createdAt: at(-1, '09:20') },
    { id: 'CMT-302', requestId: 'REQ-207', authorId: 'ADM002', body: 'Please add the name of the manager who approved the overtime.', createdAt: at(-3, '10:00') },
  ],
  securityAlerts: [
    { id: 'ALT-701', employeeId: 'EMP001', status: 'Investigating', severity: 'High', confidence: 'High', title: 'New sign-in from an unfamiliar browser', description: 'A successful sign-in used a browser that is not in the employee’s recent session history.', affected: 'Maya Santos · EMP001', time: '18 minutes ago', whyItMatters: 'An unfamiliar browser can indicate that account access should be confirmed.', recommendedAction: 'Review the session and confirm whether the sign-in was yours.', createdAt: at(0, '08:42') },
    { id: 'ALT-702', employeeId: 'EMP002', status: 'New', severity: 'Medium', confidence: 'Medium', title: 'Repeated sign-in attempts detected', description: 'Several unsuccessful sign-in attempts were recorded before normal access resumed.', affected: 'Noah Villanueva · EMP002', time: '1 hour ago', whyItMatters: 'Repeated attempts can signal a forgotten password or unauthorized access attempt.', recommendedAction: 'Ask the employee to review recent activity and turn on two-step sign-in.', createdAt: at(0, '08:05') },
  ],
  notifications: [
    { id: 'NTF-501', employeeId: 'EMP001', readAt: null, category: 'Security', createdAt: at(0, '08:42'), title: 'Please review a recent sign-in', message: 'Confirm whether the unfamiliar browser session belongs to you.', destination: 'account-security', actionLabel: 'Review sign-in' },
    { id: 'NTF-502', employeeId: 'EMP001', readAt: null, category: 'HR request', createdAt: at(-1, '09:20'), title: 'Your request is under review', message: 'HR is validating your attendance correction.', destination: 'requests', actionLabel: 'View request' },
    { id: 'NTF-503', employeeId: 'EMP001', readAt: at(-5, '10:00'), category: 'Payroll', createdAt: at(-5, '09:00'), title: 'Your August payslip is ready', message: 'View or print it from Pay & Benefits.', destination: 'pay', actionLabel: 'Open payslip' },
  ],
  sessions: [
    { id: 'SES-801', authSessionId: '00000000-0000-4000-8000-000000000001', employeeId: 'EMP001', device: 'Chrome on macOS', location: 'Makati, Philippines', assuranceLevel: 'aal2', current: true, lastSeenAt: at(0, '09:30'), createdAt: at(0, '08:40'), trustStatus: 'Trusted' },
    { id: 'SES-802', authSessionId: '00000000-0000-4000-8000-000000000001', employeeId: 'EMP002', device: 'Edge on Windows', location: 'Quezon City, Philippines', assuranceLevel: 'aal1', current: false, lastSeenAt: at(0, '08:55'), createdAt: at(-1, '16:15'), trustStatus: 'Review' },
    { id: 'SES-803', authSessionId: '00000000-0000-4000-8000-000000000003', employeeId: 'ADM001', device: 'Safari on macOS', location: 'Makati, Philippines', assuranceLevel: 'aal2', current: false, lastSeenAt: at(0, '09:10'), createdAt: at(0, '07:55'), trustStatus: 'Trusted' },
  ],
  auditLog: [
    { id: 'AUD-901', actor: 'Alex Reyes', action: 'Started security alert investigation', target: 'ALT-701 · EMP001', time: 'Today, 9:12 AM' },
    { id: 'AUD-902', actor: 'Maya Santos', action: 'Submitted attendance correction', target: 'REQ-204 · EMP001', time: 'Yesterday, 10:15 AM' },
    { id: 'AUD-903', actor: 'Sierra Navarro', action: 'Released payroll period', target: 'August 2026', time: '5 days ago' },
    { id: 'AUD-904', actor: 'Alex Reyes', action: 'Created employee account', target: 'EMP007 · Joy Garcia', time: '9 days ago' },
  ],
  zapScanRuns: [
    { id: 'ZAP-601', type: 'Baseline', environment: 'Production', status: 'Reviewed', targetUrl: 'https://quantumnhr.com', completedAt: at(-3, '16:40'), high: 0, medium: 1, low: 2, informational: 4, reportSha256: 'demo-only-redacted-sha256' },
  ],
  zapFindings: [
    { id: 'ZPF-610', scanId: 'ZAP-601', pluginId: '10038', risk: 'Medium', status: 'Review', name: 'Content Security Policy header review', affectedUrl: 'https://quantumnhr.com/', description: 'The imported baseline report identified a response-header configuration for manual review.', solution: 'Validate the deployed policy and document the approved directives.', evidence: 'Header metadata preserved in the authorized report.' },
  ],
  announcements: [
    { id: 'ANN-101', priority: 'High', date: day(-1), title: 'Quarterly town hall', content: 'Join the company update on Wednesday at 3:00 PM in the Makati HQ function room or online.' },
    { id: 'ANN-102', priority: 'Normal', date: day(-3), title: 'Benefits enrollment reminder', content: 'Review your current benefit selections before the end of the month.', updatedAt: at(-2, '10:00') },
    { id: 'ANN-103', priority: 'Normal', date: day(-12), title: 'New hybrid work guidelines', content: 'Updated guidelines for hybrid schedules are now in Documents.' },
  ],
  documents: [
    { id: 'DOC-101', employeeId: null, title: 'Information Security Policy', type: 'Policy', version: '3.1', requiresAck: true, filename: 'information-security-policy.txt', content: '', sensitive: false, createdAt: at(-6, '09:00') },
    { id: 'DOC-102', employeeId: null, title: 'Hybrid Work Guidelines', type: 'Policy', version: '1.2', requiresAck: true, filename: 'hybrid-work-guidelines.txt', content: '', sensitive: false, createdAt: at(-12, '09:00') },
    { id: 'DOC-103', employeeId: 'EMP004', title: 'Certificate of Employment', type: 'Certificate', version: '1.0', requiresAck: false, filename: 'certificate-of-employment.pdf', content: '', sensitive: true, createdAt: at(-9, '16:30'), filePath: '7c9e6679-7425-40de-944b-e07fc1f90ae7/certificate-of-employment.pdf', fileSize: 184320, mimeType: 'application/pdf' },
    { id: 'DOC-104', employeeId: 'EMP001', title: 'Employment Contract', type: 'Contract', version: '1.0', requiresAck: true, filename: 'employment-contract.pdf', content: '', sensitive: true, createdAt: at(-30, '09:00'), filePath: '3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f/employment-contract.pdf', fileSize: 512000, mimeType: 'application/pdf' },
  ],
  documentAcknowledgements: [
    { id: 'ACK-1', documentId: 'DOC-102', employeeId: 'EMP001', acknowledgedAt: at(-10, '10:00') },
    { id: 'ACK-2', documentId: 'DOC-101', employeeId: 'EMP003', acknowledgedAt: at(-5, '11:00') },
    { id: 'ACK-3', documentId: 'DOC-102', employeeId: 'EMP003', acknowledgedAt: at(-11, '11:00') },
  ],
  payrollRuns: [
    { id: 3, period: 'August 2026', status: 'Released', calculationMethod: 'Philippine statutory', employeeCount: runTotal(3).length, grossTotal: runTotal(3).reduce((sum, item) => sum + item.gross + item.allowances + item.bonuses, 0), netTotal: runTotal(3).reduce((sum, item) => sum + item.net, 0), deductionRate: 0 },
    { id: 2, period: 'July 2026', status: 'Paid', employeeCount: runTotal(2).length, grossTotal: runTotal(2).reduce((sum, item) => sum + item.gross + item.allowances + item.bonuses, 0), netTotal: runTotal(2).reduce((sum, item) => sum + item.net, 0), deductionRate: 8.25 },
    { id: 1, period: 'June 2026', status: 'Locked', employeeCount: runTotal(1).length, grossTotal: runTotal(1).reduce((sum, item) => sum + item.gross + item.allowances + item.bonuses, 0), netTotal: runTotal(1).reduce((sum, item) => sum + item.net, 0), deductionRate: 8.25 },
  ],
  payroll,
  leavePolicies: DEFAULT_LEAVE_POLICIES,
  performanceCycles: [{ id: 1, title: 'Quarterly performance and development review', period: 'Q3 2026', status: 'Active', startDate: '2026-07-01', endDate: '2026-09-30' }],
  performance: [
    { id: 'REV-1', employeeId: 'EMP001', cycleId: 1, period: 'Q2 2026', score: 86, goalProgress: 90, quality: 88, productivity: 84, teamwork: 82, rating: 'Exceeds expectations', status: 'Published', comments: 'Maya led the onboarding redesign and mentored two new designers.' },
    { id: 'REV-2', employeeId: 'EMP002', cycleId: 1, period: 'Q3 2026', score: 78, goalProgress: 75, quality: 80, productivity: 78, teamwork: 79, rating: 'Meets expectations', status: 'Draft', comments: 'Solid month-end close; continue automating reconciliations.' },
  ],
  goals: [
    { id: 'GOAL-1', employeeId: 'EMP001', title: 'Deliver an accessible employee onboarding experience', description: 'Review keyboard access and readable content across the employee journey.', category: 'Delivery', dueDate: day(10), progress: 65, status: 'Active' },
    { id: 'GOAL-2', employeeId: 'EMP001', title: 'Complete the UX research certificate', description: 'Finish the remaining two modules and share key learnings with the team.', category: 'Growth', dueDate: day(45), progress: 40, status: 'Active' },
    { id: 'GOAL-3', employeeId: 'EMP004', title: 'Reduce payroll export time by half', description: 'Automate the monthly export and add validation.', category: 'Role', dueDate: day(-3), progress: 70, status: 'Active' },
  ],
  lifecycleCases: [{ id: 'LC-1', employeeId: 'EMP007', type: 'Onboarding', status: 'Active', targetDate: day(5) }],
  lifecycleTasks: [
    { id: 'LT-1', caseId: 'LC-1', title: 'Confirm employee profile and emergency contact', category: 'People', status: 'Complete', employeeVisible: true },
    { id: 'LT-2', caseId: 'LC-1', title: 'Set up HR portal access', category: 'Access', status: 'Complete', employeeVisible: false },
    { id: 'LT-3', caseId: 'LC-1', title: 'Acknowledge company policies', category: 'Compliance', status: 'Pending', employeeVisible: true },
    { id: 'LT-4', caseId: 'LC-1', title: 'Complete first-week orientation', category: 'Experience', status: 'Pending', employeeVisible: true },
  ],
  benefits: [
    { id: 'BEN-1', employeeId: 'EMP001', type: 'Health', provider: 'Example Healthcare', planName: 'Employee comprehensive medical coverage', employeeShare: 250.5, employerShare: 750, status: 'Active', effectiveDate: '2025-03-01' },
    { id: 'BEN-2', employeeId: 'EMP001', type: 'Life insurance', provider: 'Example Life', planName: 'Group term life insurance', employeeShare: 0, employerShare: 320, status: 'Active', effectiveDate: '2025-03-01' },
  ],
}

const params = new URLSearchParams(window.location.search)
const fixtureTheme = params.get('theme')
if (fixtureTheme === 'light' || fixtureTheme === 'dark') {
  saveThemePreference(fixtureTheme)
  document.documentElement.dataset.theme = fixtureTheme
}
const screen = params.get('screen') ?? 'admin'
const isEmployee = screen.startsWith('employee')
// Opt-in first sign-in state shows the required password setup dialog.
const user = isEmployee ? { ...employeeIdentity, mustChangePassword: params.has('firstLogin') } : { ...adminIdentity, role: params.get('role') ?? 'admin' }
const context = createTestContext({
  user,
  data: params.get('audit') === 'empty' ? emptySnapshot : demoSnapshot,
  getOrganizationSecuritySummary: async () => ({ totalAccounts: 9, mfaEnabled: 6, mfaPending: 3, privilegedAccounts: 2, privilegedMfaEnabled: 2 }),
  lastSyncedAt: at(0, '09:30'),
  readDocument: async () => policyText,
  saveSchedules: async () => demoSnapshot,
  getDocumentFileUrl: async () => '#',
  getSecurityOverview: async (days) => ({
    asOf: at(0, '09:30'), windowDays: days,
    accounts: { total: 9, mfaEnabled: 6, privileged: 2, privilegedMfaEnabled: 2 },
    alerts: { open: 12, critical: 1, resolvedInWindow: 8, falsePositivesInWindow: 2 },
    sessions: { observedRecently: 2, legacyObservations: 1 },
    trend: Array.from({ length: days }, (_, index) => ({ date: day(index - days + 1), total: index % 6, high: index % 9 === 0 ? 1 : 0 })),
    bySeverity: [{ severity: 'Critical', total: 1 }, { severity: 'High', total: 2 }, { severity: 'Medium', total: 3 }, { severity: 'Low', total: 6 }],
    byStatus: [{ status: 'New', total: 6 }, { status: 'Investigating', total: 6 }],
    latestScan: { scan_code: 'ZAP-VISUAL', scan_type: 'Baseline', completed_at: at(-1, '12:00'), status: 'Review Needed', high_count: 0, medium_count: 1, low_count: 2, informational_count: 4, target_url: 'https://quantumnhr.com' },
    recentAlerts: [{ alert_code: 'ALT-VISUAL', title: 'Review an unfamiliar browser session', severity: 'High', status: 'Investigating', created_at: at(0, '09:00') }],
  }),
  // Fictional login states for layout QA only; never call hosted Auth.
  ...(params.get('loginState') === 'error' ? {
    login: async () => { throw new Error('We could not verify this fictional account. Check your work email and password, then try again. Contact your administrator if you still need help.') },
  } : {}),
  ...(params.get('loginState') === 'mfa' ? {
    login: async () => ({ mfaRequired: true as const, factorId: 'visual-only-factor', portal: user.portal, email: 'visual@example.test' }),
    verifyMfaLogin: async () => { throw new Error('This fictional verification code has expired. Enter the latest code from your authenticator app.') },
  } : {}),
})

const view = screen === 'admin-login'
  ? <LoginPage portal="admin" />
  : screen === 'admin-invite'
    ? <AdminInviteSetupPage preview={{ email: 'sierra.reviewer@quantum.example', firstName: 'Sierra', lastName: 'Reviewer', role: 'security_admin' }} />
  : screen === 'employee-login'
    ? <LoginPage portal="employee" />
    : isEmployee
      ? <EmployeePortal />
      : <AdminPortal />

// ?path=/admin/people/EMP001 opens a deep link inside the portal.
const initialPath = params.get('path') ?? '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[initialPath]}>
      <HrmsState.Provider value={context}>{view}</HrmsState.Provider>
    </MemoryRouter>
  </StrictMode>,
)
