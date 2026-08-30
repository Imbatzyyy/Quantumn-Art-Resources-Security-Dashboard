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
  mustSetPassword?: boolean
  mustChangePassword?: boolean
}

export interface EmployeeRecord extends PortalIdentity {
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
  net: number
  status: string
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
  rating: string
  status: string
}

export interface DocumentRecord {
  id: string
  employeeId?: string | null
  title: string
  type: string
  version: string
  requiresAck: boolean
}

export interface DocumentAcknowledgementRecord {
  id?: string
  documentId: string
  employeeId: string
}

export interface EmployeeRequestRecord {
  id: string
  employeeId: string
  status: string
}

export interface LeaveRequestRecord {
  id: string
  employeeId: string
  status: string
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
  employeeId: string
  readAt?: string | null
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
}

export interface MfaEnrollment {
  factorId: string
  qrCode: string
  secret: string
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
}

export interface ToastMessage {
  message: string
  tone: 'success' | 'error' | 'warning' | 'info'
  exiting?: boolean
}

export interface HrmsContextValue {
  user: PortalIdentity | null
  data: HrmsSnapshot | null
  loading: boolean
  toast: ToastMessage | null
  logout: () => Promise<void>
  refreshData: () => Promise<unknown>
  inviteAdminAccount: (input: AdminInviteInput) => Promise<unknown>
  addSecurityAlert: (input: SecurityAlertInput) => Promise<unknown>
  updateSecurityInvestigation: (input: SecurityInvestigationInput) => Promise<unknown>
  endSession: (id: string) => Promise<unknown>
  importZapReport: (input: ZapImportInput) => Promise<unknown>
  recordActivity: (input: { action: string; target: string }) => Promise<unknown>
  getOrganizationSecuritySummary: () => Promise<OrganizationSecuritySummary>
  respondToAlert: (id: string, action: string, note?: string) => Promise<unknown>
  changePassword: (input: { currentPassword: string; newPassword: string; confirmPassword?: string }) => Promise<unknown>
  getMfaStatus: () => Promise<MfaStatus>
  beginMfaEnrollment: () => Promise<MfaEnrollment>
  verifyMfaEnrollment: (input: { factorId: string; code: string }) => Promise<MfaStatus>
  disableMfa: (factorId: string | null) => Promise<MfaStatus>
  addEmployee: (input: EmployeeProvisionInput) => Promise<unknown>
  updateEmployee: (id: string, changes: Partial<EmployeeUpdateInput>) => Promise<unknown>
  saveBenefit: (input: BenefitInput) => Promise<unknown>
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type StatTone = 'blue' | 'green' | 'amber' | 'purple' | 'red'
