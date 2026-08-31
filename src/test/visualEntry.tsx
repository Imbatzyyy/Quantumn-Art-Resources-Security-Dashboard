import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import AdminPortal from '../pages/AdminPortal.js'
import EmployeePortal from '../pages/EmployeePortal.js'
import LoginPage from '../pages/LoginPage.js'
import { HrmsState } from '../state/HrmsState.js'
import type { HrmsSnapshot, PortalIdentity } from '../types/hrms.js'
import { createTestContext, emptySnapshot } from './testContext.js'
import { saveThemePreference } from '../utils/theme.js'
import '../styles.css'
import '../workspace-redesign.css'

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
  mustChangePassword: false,
}

const demoSnapshot: HrmsSnapshot = {
  ...emptySnapshot,
  employees: [
    { ...adminIdentity, email: adminIdentity.email!, role: 'admin', status: 'Active', department: 'People Operations', position: 'System Administrator', employmentType: 'Full-time', workArrangement: 'Hybrid', workLocation: 'Makati HQ', costCenter: 'HR-100', hireDate: '2024-01-15' },
    { ...employeeIdentity, email: employeeIdentity.email!, role: 'employee', status: 'Active', department: 'Creative Studio', position: 'Product Designer', employmentType: 'Full-time', workArrangement: 'Hybrid', workLocation: 'Makati HQ', costCenter: 'DSN-210', managerId: 'ADM001', salary: 56000, hireDate: '2025-02-10', phone: '+63 917 555 0134' },
    { id: 'EMP002', portal: 'employee', firstName: 'Noah', lastName: 'Villanueva', preferredName: 'Noah', email: 'noah.villanueva@quantum.example', role: 'employee', status: 'Active', department: 'Finance', position: 'Finance Analyst', employmentType: 'Full-time', workArrangement: 'On-site', workLocation: 'Makati HQ', costCenter: 'FIN-120', managerId: 'ADM001', salary: 52000, hireDate: '2025-06-02' },
  ],
  leaveRequests: [
    { id: 'LR-101', employeeId: 'EMP001', status: 'Pending', type: 'Vacation', startDate: '2026-09-07', endDate: '2026-09-08', days: 2, reason: 'Family commitment' },
  ],
  employeeRequests: [
    { id: 'REQ-204', employeeId: 'EMP001', status: 'Under Review', type: 'Attendance Correction', subject: 'Correct Friday clock-out', description: 'My approved off-site client meeting ended at 5:30 PM.', priority: 'Normal', requestedDate: '2026-08-28', requestedValue: '5:30 PM', createdAt: '2026-08-28T10:15:00+08:00', updatedAt: '2026-08-29T09:20:00+08:00' },
  ],
  requestComments: [
    { id: 'CMT-301', requestId: 'REQ-204', authorId: 'ADM001', body: 'We are validating the approved client schedule.', createdAt: '2026-08-29T09:20:00+08:00' },
  ],
  securityAlerts: [
    { id: 'ALT-701', employeeId: 'EMP001', status: 'Investigating', severity: 'High', confidence: 'High', title: 'New sign-in from an unfamiliar browser', description: 'A successful sign-in used a browser that is not in the employee’s recent session history.', affected: 'Maya Santos · EMP001', time: '18 minutes ago', whyItMatters: 'An unfamiliar browser can indicate that account access should be confirmed.', recommendedAction: 'Review the session and confirm whether the sign-in was yours.', createdAt: '2026-08-30T08:42:00+08:00' },
    { id: 'ALT-702', employeeId: 'EMP002', status: 'New', severity: 'Medium', confidence: 'Medium', title: 'Repeated sign-in attempts detected', description: 'Several unsuccessful sign-in attempts were recorded before normal access resumed.', affected: 'Noah Villanueva · EMP002', time: '1 hour ago', whyItMatters: 'Repeated attempts can signal a forgotten password or unauthorized access attempt.', recommendedAction: 'Ask the employee to review recent activity and enable MFA.', createdAt: '2026-08-30T08:05:00+08:00' },
  ],
  notifications: [
    { id: 'NTF-501', employeeId: 'EMP001', readAt: null, category: 'Security', createdAt: '2026-08-30T08:42:00+08:00', title: 'Please review a recent sign-in', message: 'Confirm whether the unfamiliar browser session belongs to you.', destination: 'account-security', actionLabel: 'Review session' },
    { id: 'NTF-502', employeeId: 'EMP001', readAt: null, category: 'HR request', createdAt: '2026-08-29T09:20:00+08:00', title: 'Your request is under review', message: 'HR is validating your attendance correction.', destination: 'requests', actionLabel: 'View request' },
  ],
  sessions: [
    { id: 'SES-801', employeeId: 'EMP001', device: 'Chrome on macOS', location: 'Makati, Philippines', assuranceLevel: 'aal2', current: true, lastSeenAt: '2026-08-30T09:30:00+08:00', createdAt: '2026-08-30T08:40:00+08:00', trustStatus: 'Trusted' },
    { id: 'SES-802', employeeId: 'EMP002', device: 'Edge on Windows', location: 'Quezon City, Philippines', assuranceLevel: 'aal1', current: false, lastSeenAt: '2026-08-30T08:55:00+08:00', createdAt: '2026-08-29T16:15:00+08:00', trustStatus: 'Review' },
  ],
  auditLog: [
    { id: 'AUD-901', actor: 'Alex Reyes', action: 'Started security alert investigation', target: 'ALT-701 · EMP001', time: 'Aug 30, 2026, 9:12 AM' },
    { id: 'AUD-902', actor: 'Maya Santos', action: 'Submitted attendance correction', target: 'REQ-204', time: 'Aug 28, 2026, 10:15 AM' },
    { id: 'AUD-903', actor: 'Alex Reyes', action: 'Imported authorized OWASP ZAP report', target: 'ZAP-601 · Production', time: 'Aug 27, 2026, 4:40 PM' },
  ],
  zapScanRuns: [
    { id: 'ZAP-601', type: 'Baseline', environment: 'Production', status: 'Reviewed', targetUrl: 'https://quantumnhr.com', completedAt: '2026-08-27T16:40:00+08:00', high: 0, medium: 1, low: 2, informational: 4, reportSha256: 'demo-only-redacted-sha256' },
  ],
  zapFindings: [
    { id: 'ZPF-610', scanId: 'ZAP-601', pluginId: '10038', risk: 'Medium', status: 'Review', name: 'Content Security Policy header review', affectedUrl: 'https://quantumnhr.com/', description: 'The imported baseline report identified a response-header configuration for manual review.', solution: 'Validate the deployed policy and document the approved directives.', evidence: 'Header metadata preserved in the authorized report.' },
  ],
  attendance: [
    { id: 'ATT-401', employeeId: 'EMP001', date: '2026-08-30', clockIn: '08:58', clockOut: null, hours: 0.5, status: 'Working' },
  ],
  schedules: [
    { id: 'SCH-410', employeeId: 'EMP001', date: '2026-08-30', shiftStart: '09:00', shiftEnd: '18:00', workMode: 'Hybrid', location: 'Makati HQ' },
    { id: 'SCH-411', employeeId: 'EMP001', date: '2026-08-31', shiftStart: '09:00', shiftEnd: '18:00', workMode: 'Remote', location: 'Home office' },
  ],
  announcements: [
    { id: 'ANN-101', priority: 'High', date: '2026-08-29', title: 'Quarterly town hall', content: 'Join the organization update on Wednesday at 3:00 PM.' },
    { id: 'ANN-102', priority: 'Normal', date: '2026-08-27', title: 'Benefits enrollment reminder', content: 'Review your current benefit selections before September 5.' },
  ],
  documents: [
    { id: 'DOC-101', employeeId: null, title: 'Information Security Policy', type: 'Policy', version: '3.1', requiresAck: true, filename: 'information-security-policy.txt', content: 'Fictional visual-test policy content.', sensitive: false, createdAt: '2026-08-25T09:00:00+08:00' },
  ],
}

const params = new URLSearchParams(window.location.search)
const fixtureTheme = params.get('theme')
if (fixtureTheme === 'light' || fixtureTheme === 'dark') {
  saveThemePreference(fixtureTheme)
  if (params.get('screen')?.endsWith('-login')) document.documentElement.dataset.theme = fixtureTheme
}
// Opt-in populated records keep the original visual baselines stable while the
// compatibility suite exercises tables, detail panels, and long real-world copy.
const auditSnapshot: HrmsSnapshot = {
  ...demoSnapshot,
  payrollRuns: [{ id: 1, period: 'August 2026', status: 'Draft', employeeCount: 2, grossTotal: 108000, netTotal: 99090, deductionRate: 8.25 }],
  payroll: [{ id: 'PAY-1', employeeId: 'EMP001', runId: 1, period: 'August 2026', gross: 56000, allowances: 0, bonuses: 0, deductions: 4620, net: 51380, status: 'Draft' }],
  performanceCycles: [{ id: 1, title: 'Quarterly performance and development review', period: 'Q3 2026', status: 'Active', startDate: '2026-07-01', endDate: '2026-09-30' }],
  performance: [{ id: 'REV-1', employeeId: 'EMP001', cycleId: 1, period: 'Q3 2026', score: 80, goalProgress: 80, quality: 80, productivity: 80, teamwork: 80, rating: 'Meets expectations', status: 'Draft', comments: 'Fictional review for display testing.' }],
  goals: [{ id: 'GOAL-1', employeeId: 'EMP001', title: 'Deliver an accessible employee onboarding experience', description: 'Review keyboard access and readable content across the employee journey.', category: 'Professional development', dueDate: '2026-09-30', progress: 65, status: 'Active' }],
  lifecycleCases: [{ id: 'LC-1', employeeId: 'EMP002', type: 'Onboarding', status: 'In Progress', targetDate: '2026-09-07' }],
  lifecycleTasks: [{ id: 'LT-1', caseId: 'LC-1', title: 'Review organization security and acceptable use policies', category: 'Compliance', status: 'Pending', employeeVisible: true }],
  benefits: [{ id: 'BEN-1', employeeId: 'EMP001', type: 'Health', provider: 'Example Healthcare', planName: 'Employee comprehensive medical coverage', employeeShare: 250.5, employerShare: 750, status: 'Active', effectiveDate: '2026-08-01' }],
}
const screen = params.get('screen') ?? 'admin'
const isEmployee = screen.startsWith('employee')
const user = isEmployee ? employeeIdentity : adminIdentity
const context = createTestContext({
  user,
  data: params.get('audit') === 'empty' ? emptySnapshot : params.has('audit') ? auditSnapshot : demoSnapshot,
  getOrganizationSecuritySummary: async () => ({ totalAccounts: 3, mfaEnabled: 2, mfaPending: 1, privilegedAccounts: 1, privilegedMfaEnabled: 1 }),
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
  : screen === 'employee-login'
    ? <LoginPage portal="employee" />
    : isEmployee
      ? <EmployeePortal />
      : <AdminPortal />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <HrmsState.Provider value={context}>{view}</HrmsState.Provider>
    </MemoryRouter>
  </StrictMode>,
)
