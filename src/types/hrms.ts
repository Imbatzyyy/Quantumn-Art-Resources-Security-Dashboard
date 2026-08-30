import type { LucideIcon } from 'lucide-react'

export type PortalKind = 'admin' | 'employee'
export type ThemeMode = 'light' | 'dark'

export interface PortalNavigationItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: 'alerts' | 'inbox' | 'approvals' | number | string
  group?: string
}

export interface PortalIdentity {
  id: string
  portal: PortalKind
  firstName: string
  lastName: string
  preferredName?: string
  position?: string
  department?: string
  role?: string
  email?: string
  status?: string
  middleName?: string
  phone?: string
  employmentType?: string
  workArrangement?: string
  workLocation?: string
  costCenter?: string
  hireDate?: string
  avatarPath?: string
  avatarUrl?: string
  mustSetPassword?: boolean
  mustChangePassword?: boolean
}

export interface LoginCredentials {
  email: string
  password: string
  portal: PortalKind
}

export interface MfaLoginInput {
  factorId: string
  code: string
  portal: PortalKind
}

export interface MfaChallenge {
  mfaRequired: true
  factorId: string
  portal: PortalKind
  email: string
}

export type AuthenticationResult = PortalIdentity | MfaChallenge

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
  confirmPassword?: string
}

export interface InitialPasswordInput {
  currentPassword: string
  newPassword: string
}

export interface AdminInvitationCompletionInput {
  newPassword: string
}

export interface EmployeeRecord extends Omit<PortalIdentity, 'portal'> {
  portal?: PortalKind
  email: string
  role: string
  status: string
  department: string
  position: string
  phone?: string
  employmentType?: string
  workArrangement?: string
  workLocation?: string
  costCenter?: string
  managerId?: string
  salary?: number
  hireDate?: string
  emergencyContactName?: string
  emergencyContactRelationship?: string
  emergencyContactPhone?: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  clockIn?: string | null
  clockOut?: string | null
  hours: number
  status: string
}

export interface PayrollRecord {
  id: string
  employeeId: string
  period: string
  gross: number
  allowances: number
  bonuses: number
  deductions: number
  net: number
  status: string
  runId?: number
}

export type PayrollStage = 'Draft' | 'Validation' | 'Approved' | 'Released' | 'Paid' | 'Locked'

export interface PayrollRunRecord {
  id: number
  period: string
  status: PayrollStage
  employeeCount: number
  grossTotal: number
  netTotal: number
  deductionRate: number
  approvedBy?: string
  releasedAt?: string
}

export interface PayrollGenerationInput {
  period: string
  deductionRate: number
}

export interface BenefitRecord {
  id: string
  employeeId: string
  type: string
  provider?: string
  planName: string
  employeeShare?: number
  employerShare: number
  status: string
  effectiveDate?: string
}

export interface GoalRecord {
  id: string
  employeeId: string
  title: string
  description: string
  category: string
  dueDate?: string
  progress: number
  status: string
}

export interface PerformanceRecord {
  id: string
  employeeId: string
  period: string
  score: number
  goalProgress: number
  quality: number
  productivity: number
  teamwork: number
  rating: string
  status: string
  comments?: string
  cycleId?: number | string
}

export interface PerformanceCycleRecord {
  id: number
  title: string
  period: string
  status: string
  startDate?: string
  endDate?: string
}

export interface PerformanceCycleInput {
  title: string
  period: string
  status: string
  startDate: string
  endDate: string
}

export interface PerformanceReviewInput {
  id?: string
  employeeId: string
  cycleId: number | string
  period: string
  score: number
  goalProgress: number
  quality: number
  productivity: number
  teamwork: number
  comments: string
  rating?: string
  status?: string
}

export type GoalInput = Omit<GoalRecord, 'id'> & { id?: string }

export interface DocumentRecord {
  id: string
  employeeId?: string | null
  title: string
  type: string
  version: string
  requiresAck: boolean
  filename: string
  content: string
  sensitive: boolean
  period?: string
  createdAt: string
}

export interface DocumentInput {
  employeeId: string
  title: string
  type: string
  period: string
  content: string
  filename: string
  version: string
  requiresAck: boolean
  sensitive: boolean
  expiresOn: string
}

export interface AnnouncementInput {
  title: string
  content: string
  priority: string
}

export interface DocumentAcknowledgementRecord {
  id?: string
  documentId: string
  employeeId: string
  acknowledgedAt?: string
}

export interface EmployeeRequestRecord {
  id: string
  employeeId: string
  status: string
  type: string
  subject: string
  description: string
  priority: string
  requestedDate?: string
  requestedValue?: string
  decisionNote?: string
  createdAt: string
  updatedAt: string
}

export interface LeaveRequestRecord {
  id: string
  employeeId: string
  status: string
  type: string
  startDate: string
  endDate: string
  days: number
  reason: string
}

export interface ScheduleRecord {
  id: string
  employeeId: string
  date: string
  shiftStart: string
  shiftEnd: string
  workMode: string
  location: string
  notes?: string
}

export type ScheduleInput = Omit<ScheduleRecord, 'id'>

export interface AnnouncementRecord {
  id: string
  priority: string
  date: string
  title: string
  content: string
}

export interface RequestCommentRecord {
  id: string
  requestId: string
  authorId: string
  body: string
  createdAt: string
  internal?: boolean
}

export interface LifecycleCaseRecord {
  id: string
  employeeId: string
  type: string
  status: string
  targetDate: string
}

export interface LifecycleCaseInput {
  employeeId: string
  type: string
  targetDate: string
}

export interface LifecycleTaskRecord {
  id: string
  caseId: string
  title: string
  category: string
  status: string
  employeeVisible: boolean
}

export interface LeaveRequestInput {
  employeeId: string
  type: string
  startDate: string
  endDate: string
  reason: string
}

export interface EmployeeRequestInput {
  type: string
  subject: string
  description: string
  requestedDate: string
  requestedValue: string
  priority: string
}

export interface EmployeeProvisionInput {
  firstName: string
  middleName: string
  lastName: string
  preferredName: string
  email: string
  phone: string
  department: string
  position: string
  employmentType: string
  workArrangement: string
  workLocation: string
  costCenter: string
  managerId: string
  salary: number | string
  hireDate: string
  emergencyContactName: string
  emergencyContactRelationship: string
  emergencyContactPhone: string
  temporaryPassword: string
}

export type EmployeeUpdateInput = Omit<EmployeeProvisionInput, 'email' | 'temporaryPassword'> & { status?: string }

export interface BenefitInput {
  employeeId: string
  type: string
  provider: string
  planName: string
  employeeShare: number | string
  employerShare: number | string
  status: string
  effectiveDate: string
}

export interface SecurityAlertSummary {
  id: string
  employeeId?: string
  status: string
  severity: string
  confidence: string
  title: string
  description: string
  affected: string
  time: string
  whyItMatters: string
  recommendedAction: string
  createdAt: string
}

export interface NotificationSummary {
  id: string
  employeeId: string
  readAt?: string | null
  category: string
  createdAt: string
  title: string
  message: string
  destination?: string
  actionLabel?: string
}

export interface WorkflowSummary {
  status: string
}

export interface SessionRecord {
  id: string
  employeeId: string
  device: string
  location: string
  assuranceLevel: string
  current: boolean
  lastSeenAt?: string
  createdAt?: string
  trustStatus: string
}

export interface AlertResponseRecord {
  id: string
  actorId: string
  alertId: string
  action: string
  createdAt: string
}

export interface MfaStatus {
  enabled: boolean
  factorId: string | null
  currentLevel: string
  friendlyName?: string
}

export interface MfaEnrollment {
  factorId: string
  qrCode: string
  secret: string
  uri?: string
}

export interface AuditRecord {
  id: string
  actor: string
  action: string
  target: string
  time: string
}

export interface ZapScanRun {
  id: string
  type: string
  environment: string
  status: string
  targetUrl: string
  completedAt?: string
  high: number
  medium: number
  low: number
  informational: number
  reportSha256: string
}

export interface ZapFinding {
  id: string
  scanId: string
  pluginId?: string
  risk: string
  status: string
  name: string
  affectedUrl: string
  description: string
  solution?: string
  evidence?: string
}

export interface AdminInviteInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: 'admin' | 'hr_admin' | 'payroll_admin' | 'security_admin' | 'auditor'
  confirmed: boolean
}

export interface SecurityAlertInput {
  employeeCode: string
  severity: string
  confidence?: string
  eventType: string
  title: string
  description: string
  whyItMatters?: string
  recommendedAction: string
}

export interface SecurityInvestigationInput {
  alertCode: string
  status: string
  note: string
  resolutionReason: string
}

export interface ZapImportInput {
  report: string
  reportName: string
  targetUrl: string
  environment: string
  scanType: string
  authorizedScope: string
  notes: string
}

export interface OrganizationSecuritySummary {
  totalAccounts: number
  mfaEnabled: number
  mfaPending: number
  privilegedAccounts: number
  privilegedMfaEnabled: number
}

export interface HrmsSnapshot {
  employees: EmployeeRecord[]
  securityAlerts: SecurityAlertSummary[]
  notifications: NotificationSummary[]
  leaveRequests: LeaveRequestRecord[]
  employeeRequests: EmployeeRequestRecord[]
  sessions: SessionRecord[]
  auditLog: AuditRecord[]
  zapScanRuns: ZapScanRun[]
  zapFindings: ZapFinding[]
  alertResponses: AlertResponseRecord[]
  attendance: AttendanceRecord[]
  payroll: PayrollRecord[]
  benefits: BenefitRecord[]
  goals: GoalRecord[]
  performance: PerformanceRecord[]
  documents: DocumentRecord[]
  documentAcknowledgements: DocumentAcknowledgementRecord[]
  schedules: ScheduleRecord[]
  announcements: AnnouncementRecord[]
  requestComments: RequestCommentRecord[]
  lifecycleCases: LifecycleCaseRecord[]
  lifecycleTasks: LifecycleTaskRecord[]
  payrollRuns: PayrollRunRecord[]
  performanceCycles: PerformanceCycleRecord[]
}

export interface ToastMessage {
  id: number
  message: string
  tone: 'success' | 'error' | 'warning' | 'info'
  exiting?: boolean
}

export type ToastTone = ToastMessage['tone']

export interface ActivityInput {
  action: string
  target: string
}

export interface HrmsDataProvider {
  getSnapshot: () => Promise<HrmsSnapshot>
  refresh?: () => Promise<HrmsSnapshot>
  subscribeToChanges?: (onChange: () => void | Promise<void>) => (() => void) | undefined
  getCurrentUser: () => Promise<PortalIdentity | null>
  authenticate: (credentials: LoginCredentials) => Promise<AuthenticationResult>
  verifyMfaLogin: (input: MfaLoginInput) => Promise<PortalIdentity>
  signOut?: () => Promise<void>
  recordCurrentSession?: () => Promise<string | null>
  getMfaStatus: () => Promise<MfaStatus>
  getOrganizationSecuritySummary: () => Promise<OrganizationSecuritySummary>
  beginMfaEnrollment: () => Promise<MfaEnrollment>
  verifyMfaEnrollment: (input: { factorId: string; code: string }) => Promise<MfaStatus>
  disableMfa: (factorId: string | null) => Promise<MfaStatus>
  addEmployee: (input: EmployeeProvisionInput) => Promise<HrmsSnapshot>
  inviteAdminAccount: (input: AdminInviteInput) => Promise<HrmsSnapshot>
  completeAdminInvitation: (input: AdminInvitationCompletionInput) => Promise<unknown>
  completeInitialPassword: (input: InitialPasswordInput) => Promise<HrmsSnapshot>
  updateEmployee: (id: string, changes: Partial<EmployeeUpdateInput>) => Promise<HrmsSnapshot>
  updateProfilePhoto: (photo: Blob) => Promise<HrmsSnapshot>
  submitLeave: (input: LeaveRequestInput) => Promise<HrmsSnapshot>
  reviewLeave: (id: string, status: string) => Promise<HrmsSnapshot>
  submitRequest: (input: EmployeeRequestInput) => Promise<HrmsSnapshot>
  reviewRequest: (id: string, status: string, reason: string) => Promise<HrmsSnapshot>
  addRequestComment: (id: string, body: string, internal?: boolean) => Promise<HrmsSnapshot>
  cancelRequest: (id: string) => Promise<HrmsSnapshot>
  markNotificationRead: (id: string) => Promise<HrmsSnapshot>
  markAllNotificationsRead: () => Promise<HrmsSnapshot>
  acknowledgeDocument: (id: string) => Promise<HrmsSnapshot>
  updateGoalProgress: (id: string, progress: number) => Promise<HrmsSnapshot>
  clock: (employeeId?: string) => Promise<HrmsSnapshot>
  updateAlert: (id: string, status: string) => Promise<HrmsSnapshot>
  addSecurityAlert: (input: SecurityAlertInput) => Promise<HrmsSnapshot>
  respondToAlert: (id: string, action: string, note?: string) => Promise<HrmsSnapshot>
  updateSecurityInvestigation: (input: SecurityInvestigationInput) => Promise<HrmsSnapshot>
  importZapReport: (input: ZapImportInput) => Promise<HrmsSnapshot>
  endSession: (id: string) => Promise<HrmsSnapshot>
  changePassword: (input: PasswordChangeInput) => Promise<HrmsSnapshot>
  addAnnouncement: (input: AnnouncementInput) => Promise<HrmsSnapshot>
  createDocument: (input: DocumentInput) => Promise<HrmsSnapshot>
  saveSchedule: (input: ScheduleInput) => Promise<HrmsSnapshot>
  saveBenefit: (input: BenefitInput) => Promise<HrmsSnapshot>
  saveGoal: (input: GoalInput) => Promise<HrmsSnapshot>
  createLifecycleCase: (input: LifecycleCaseInput) => Promise<HrmsSnapshot>
  updateLifecycleTask: (id: string, status: string) => Promise<HrmsSnapshot>
  generatePayroll: (input: PayrollGenerationInput) => Promise<HrmsSnapshot>
  transitionPayrollRun: (id: number, status: PayrollStage) => Promise<HrmsSnapshot>
  savePerformance: (input: PerformanceReviewInput) => Promise<HrmsSnapshot>
  publishPerformance: (id: string) => Promise<HrmsSnapshot>
  createPerformanceCycle: (input: PerformanceCycleInput) => Promise<HrmsSnapshot>
  recordActivity: (input: ActivityInput) => Promise<HrmsSnapshot>
}

export interface HrmsContextValue {
  user: PortalIdentity | null
  data: HrmsSnapshot | null
  loading: boolean
  toast: ToastMessage | null
  notify: (message: string, tone?: ToastTone) => void
  login: (credentials: LoginCredentials) => Promise<AuthenticationResult>
  verifyMfaLogin: (input: MfaLoginInput) => Promise<PortalIdentity>
  logout: () => Promise<void>
  refreshData: () => Promise<unknown>
  inviteAdminAccount: (input: AdminInviteInput) => Promise<unknown>
  completeAdminInvitation: (input: AdminInvitationCompletionInput) => Promise<unknown>
  addSecurityAlert: (input: SecurityAlertInput) => Promise<unknown>
  updateSecurityInvestigation: (input: SecurityInvestigationInput) => Promise<unknown>
  endSession: (id: string) => Promise<unknown>
  importZapReport: (input: ZapImportInput) => Promise<unknown>
  recordActivity: (input: { action: string; target: string }) => Promise<unknown>
  getOrganizationSecuritySummary: () => Promise<OrganizationSecuritySummary>
  respondToAlert: (id: string, action: string, note?: string) => Promise<unknown>
  updateAlert: (id: string, status: string) => Promise<unknown>
  changePassword: (input: PasswordChangeInput) => Promise<unknown>
  getMfaStatus: () => Promise<MfaStatus>
  beginMfaEnrollment: () => Promise<MfaEnrollment>
  verifyMfaEnrollment: (input: { factorId: string; code: string }) => Promise<MfaStatus>
  disableMfa: (factorId: string | null) => Promise<MfaStatus>
  addEmployee: (input: EmployeeProvisionInput) => Promise<unknown>
  updateEmployee: (id: string, changes: Partial<EmployeeUpdateInput>) => Promise<unknown>
  updateProfilePhoto: (photo: Blob) => Promise<unknown>
  saveBenefit: (input: BenefitInput) => Promise<unknown>
  clock: (employeeId: string) => Promise<unknown>
  submitLeave: (input: LeaveRequestInput) => Promise<unknown>
  submitRequest: (input: EmployeeRequestInput) => Promise<unknown>
  addRequestComment: (id: string, body: string, internal: boolean) => Promise<unknown>
  cancelRequest: (id: string) => Promise<unknown>
  markNotificationRead: (id: string) => Promise<unknown>
  markAllNotificationsRead: () => Promise<unknown>
  updateGoalProgress: (id: string, progress: number) => Promise<unknown>
  acknowledgeDocument: (id: string) => Promise<unknown>
  saveSchedule: (input: ScheduleInput) => Promise<unknown>
  reviewLeave: (id: string, status: string) => Promise<unknown>
  reviewRequest: (id: string, status: string, reason: string) => Promise<unknown>
  createLifecycleCase: (input: LifecycleCaseInput) => Promise<unknown>
  updateLifecycleTask: (id: string, status: string) => Promise<unknown>
  completeInitialPassword: (input: InitialPasswordInput) => Promise<PortalIdentity | null>
  generatePayroll: (input: PayrollGenerationInput) => Promise<unknown>
  transitionPayrollRun: (id: number, status: PayrollStage) => Promise<unknown>
  savePerformance: (input: PerformanceReviewInput) => Promise<unknown>
  publishPerformance: (id: string) => Promise<unknown>
  createPerformanceCycle: (input: PerformanceCycleInput) => Promise<unknown>
  saveGoal: (input: GoalInput) => Promise<unknown>
  createDocument: (input: DocumentInput) => Promise<unknown>
  addAnnouncement: (input: AnnouncementInput) => Promise<unknown>
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type StatTone = 'blue' | 'green' | 'amber' | 'purple' | 'red'
