import type {
  AlertResponseRecord,
  AnnouncementRecord,
  AttendanceRecord,
  AuditRecord,
  BenefitRecord,
  DocumentAcknowledgementRecord,
  DocumentRecord,
  EmployeeRecord,
  EmployeeRequestRecord,
  GoalRecord,
  HrmsSnapshot,
  LeaveRequestRecord,
  LifecycleCaseRecord,
  LifecycleTaskRecord,
  NotificationSummary,
  PayrollRecord,
  PayrollRunRecord,
  PerformanceCycleRecord,
  PerformanceRecord,
  RequestCommentRecord,
  ScheduleRecord,
  SecurityAlertSummary,
  SessionRecord,
  ZapFinding,
  ZapScanRun,
} from '../types/hrms.js'
import type { Tables } from '../types/database.js'

export type DatabaseRow = Record<string, unknown>

const text = (value: unknown, fallback = ''): string => value == null ? fallback : String(value)
const optionalText = (value: unknown): string | undefined => value == null ? undefined : String(value)
const nullableText = (value: unknown): string | null => value == null ? null : String(value)
const numeric = (value: unknown): number => Number(value ?? 0)
const truthy = (value: unknown): boolean => value === true
const shortTime = (value: unknown): string | null => typeof value === 'string' ? value.slice(0, 5) : null

export const emptySnapshot = (): HrmsSnapshot => ({
  employees: [], attendance: [], leaveRequests: [], payroll: [], payrollRuns: [],
  performance: [], performanceCycles: [], announcements: [], securityAlerts: [],
  alertResponses: [], sessions: [], auditLog: [], zapScanRuns: [], zapFindings: [],
  employeeRequests: [], requestComments: [], notifications: [], documents: [],
  documentAcknowledgements: [], schedules: [], benefits: [], goals: [],
  lifecycleCases: [], lifecycleTasks: [],
})

export const employeeFromRow = (row: Tables<'profiles'>): EmployeeRecord & { authUserId?: string } => ({
  id: text(row.employee_code), authUserId: optionalText(row.auth_user_id),
  firstName: text(row.first_name), middleName: text(row.middle_name), lastName: text(row.last_name),
  preferredName: text(row.preferred_name), email: text(row.email), role: text(row.role),
  department: text(row.department), position: text(row.position), status: text(row.status),
  salary: numeric(row.salary), phone: text(row.phone), hireDate: optionalText(row.hire_date),
  employmentType: text(row.employment_type, 'Full-time'), workArrangement: text(row.work_arrangement, 'On-site'),
  workLocation: text(row.work_location, 'Main Office'), costCenter: text(row.cost_center),
  avatarPath: optionalText(row.avatar_path),
  avatarVersion: optionalText(row.updated_at),
  managerId: text(row.manager_code), emergencyContactName: text(row.emergency_contact_name),
  emergencyContactRelationship: text(row.emergency_contact_relationship),
  emergencyContactPhone: text(row.emergency_contact_phone),
})

export const attendanceFromRow = (row: Tables<'attendance'>): AttendanceRecord => ({
  id: text(row.id), employeeId: text(row.employee_code), date: text(row.work_date),
  clockIn: shortTime(row.clock_in), clockOut: shortTime(row.clock_out),
  status: text(row.status), hours: numeric(row.hours),
})

export const leaveFromRow = (row: Tables<'leave_requests'>): LeaveRequestRecord => ({
  id: text(row.id), employeeId: text(row.employee_code), type: text(row.leave_type),
  startDate: text(row.start_date), endDate: text(row.end_date), days: numeric(row.days),
  reason: text(row.reason), status: text(row.status),
})

export const payrollFromRow = (row: Tables<'payroll'>): PayrollRecord & { paymentDate?: string } => ({
  id: text(row.id), employeeId: text(row.employee_code), period: text(row.period),
  gross: numeric(row.gross), allowances: numeric(row.allowances), bonuses: numeric(row.bonuses),
  deductions: numeric(row.deductions), net: numeric(row.net), status: text(row.status),
  runId: row.payroll_run_id == null ? undefined : numeric(row.payroll_run_id),
  paymentDate: optionalText(row.payment_date),
})

export const payrollRunFromRow = (row: Tables<'payroll_runs'>): PayrollRunRecord & Record<string, unknown> => ({
  id: numeric(row.id), period: text(row.period), deductionRate: numeric(row.deduction_rate),
  status: text(row.status) as PayrollRunRecord['status'], employeeCount: numeric(row.employee_count),
  grossTotal: numeric(row.gross_total), netTotal: numeric(row.net_total),
  createdBy: optionalText(row.created_by), approvedBy: optionalText(row.approved_by),
  approvedAt: optionalText(row.approved_at), releasedAt: optionalText(row.released_at),
  paidAt: optionalText(row.paid_at), lockedAt: optionalText(row.locked_at), createdAt: optionalText(row.created_at),
})

export const performanceFromRow = (row: Tables<'performance_reviews'>): PerformanceRecord & { publishedAt?: string } => ({
  id: text(row.id), employeeId: text(row.employee_code), period: text(row.period), score: numeric(row.score),
  goalProgress: numeric(row.goal_progress), quality: numeric(row.quality_score ?? row.score),
  productivity: numeric(row.productivity_score ?? row.score), teamwork: numeric(row.teamwork_score ?? row.score),
  rating: text(row.rating), comments: text(row.comments),
  cycleId: row.cycle_id == null ? undefined : text(row.cycle_id), status: text(row.status, 'Published'),
  publishedAt: optionalText(row.published_at),
})

export const performanceCycleFromRow = (row: Tables<'performance_cycles'>): PerformanceCycleRecord => ({
  id: numeric(row.id), title: text(row.title), period: text(row.period), status: text(row.status),
  startDate: optionalText(row.start_date), endDate: optionalText(row.end_date),
})

export const announcementFromRow = (row: Tables<'announcements'>): AnnouncementRecord => ({
  id: text(row.id), title: text(row.title), content: text(row.content), priority: text(row.priority), date: text(row.published_on),
})

export const alertFromRow = (row: Tables<'security_alerts'>): SecurityAlertSummary & Record<string, unknown> => ({
  id: text(row.alert_code), employeeId: optionalText(row.employee_code), severity: text(row.severity),
  confidence: text(row.confidence), title: text(row.title), description: text(row.description),
  affected: text(row.affected_label), time: text(row.display_time), status: text(row.status),
  recommendedAction: text(row.recommended_action), whyItMatters: text(row.why_it_matters),
  createdAt: text(row.created_at), type: optionalText(row.event_type), assignedTo: optionalText(row.assigned_to),
  resolutionReason: optionalText(row.resolution_reason), resolutionNotes: optionalText(row.resolution_notes),
  updatedAt: optionalText(row.updated_at),
})

export const alertResponseFromRow = (row: Tables<'security_alert_responses'>): AlertResponseRecord & { note?: string } => ({
  id: text(row.id), alertId: text(row.alert_code), actorId: text(row.actor_employee_code),
  action: text(row.response_action), note: text(row.note), createdAt: text(row.created_at),
})

export const sessionFromRow = (row: Tables<'account_sessions'>, currentCode: string): SessionRecord & { lastActive?: string } => ({
  id: text(row.session_code), employeeId: text(row.employee_code), device: text(row.device),
  location: text(row.location), lastActive: optionalText(row.last_active_label),
  current: text(row.session_code) === currentCode, createdAt: optionalText(row.created_at),
  lastSeenAt: optionalText(row.last_seen_at), assuranceLevel: text(row.assurance_level, 'aal1'),
  trustStatus: text(row.trust_status, 'Recognized'),
})

export const auditFromRow = (row: Tables<'audit_logs'>): AuditRecord => ({
  id: text(row.id), actor: text(row.actor_label), action: text(row.action), target: text(row.target), time: text(row.display_time),
})

export const zapScanFromRow = (row: Tables<'zap_scan_runs'>): ZapScanRun & Record<string, unknown> => ({
  id: text(row.scan_code), type: text(row.scan_type), environment: text(row.environment),
  targetUrl: text(row.target_url), completedAt: optionalText(row.completed_at), status: text(row.status),
  high: numeric(row.high_count), medium: numeric(row.medium_count), low: numeric(row.low_count),
  informational: numeric(row.informational_count), reportSha256: text(row.report_sha256),
  version: text(row.zap_version, 'OWASP ZAP'), startedAt: optionalText(row.started_at),
  reportName: text(row.report_name), authorizedScope: optionalText(row.authorized_scope),
  reviewedBy: optionalText(row.reviewed_by), reviewedAt: optionalText(row.reviewed_at), notes: text(row.notes),
})

export const zapFindingFromRow = (row: Tables<'zap_findings'>): ZapFinding & Record<string, unknown> => ({
  id: text(row.id), scanId: text(row.scan_code), pluginId: optionalText(row.plugin_id), name: text(row.name),
  risk: text(row.risk), status: text(row.status), affectedUrl: text(row.affected_url),
  description: text(row.description), solution: text(row.solution), evidence: text(row.evidence),
  confidence: optionalText(row.confidence), referenceUrl: optionalText(row.reference_url),
})

export const requestFromRow = (row: Tables<'employee_requests'>): EmployeeRequestRecord & Record<string, unknown> => ({
  id: text(row.id), employeeId: text(row.employee_code), type: text(row.request_type), subject: text(row.subject),
  description: text(row.description), requestedDate: optionalText(row.requested_date), requestedValue: text(row.requested_value),
  priority: text(row.priority), status: text(row.status), decisionNote: text(row.decision_note),
  createdAt: text(row.created_at), updatedAt: text(row.updated_at), assignedTo: optionalText(row.assigned_to),
  reviewedBy: optionalText(row.reviewed_by), reviewedAt: optionalText(row.reviewed_at),
})

export const requestCommentFromRow = (row: Tables<'request_comments'>): RequestCommentRecord => ({
  id: text(row.id), requestId: text(row.request_id), authorId: text(row.author_employee_code),
  body: text(row.body), internal: truthy(row.is_internal), createdAt: text(row.created_at),
})

export const notificationFromRow = (row: Tables<'notifications'>): NotificationSummary => ({
  id: text(row.id), employeeId: text(row.employee_code), category: text(row.category), title: text(row.title),
  message: text(row.message), destination: optionalText(row.destination), actionLabel: optionalText(row.action_label),
  readAt: nullableText(row.read_at), createdAt: text(row.created_at),
})

export const documentFromRow = (row: Tables<'employee_documents'>): DocumentRecord & Record<string, unknown> => ({
  id: text(row.id), employeeId: nullableText(row.employee_code), title: text(row.title),
  type: text(row.document_type), period: optionalText(row.period), content: text(row.content),
  filename: text(row.filename), version: text(row.version), requiresAck: truthy(row.requires_ack),
  sensitive: truthy(row.sensitive), createdAt: text(row.created_at), expiresOn: optionalText(row.expires_on),
  uploadedBy: optionalText(row.uploaded_by),
})

export const acknowledgementFromRow = (row: Tables<'document_acknowledgements'>): DocumentAcknowledgementRecord => ({
  id: text(row.id), documentId: text(row.document_id), employeeId: text(row.employee_code),
  acknowledgedAt: optionalText(row.acknowledged_at),
})

export const scheduleFromRow = (row: Tables<'work_schedules'>): ScheduleRecord => ({
  id: text(row.id), employeeId: text(row.employee_code), date: text(row.work_date),
  shiftStart: shortTime(row.shift_start) ?? '', shiftEnd: shortTime(row.shift_end) ?? '',
  location: text(row.location), workMode: text(row.work_mode), notes: text(row.notes),
})

export const benefitFromRow = (row: Tables<'employee_benefits'>): BenefitRecord => ({
  id: text(row.id), employeeId: text(row.employee_code), type: text(row.benefit_type),
  provider: text(row.provider), planName: text(row.plan_name), employeeShare: numeric(row.employee_share),
  employerShare: numeric(row.employer_share), status: text(row.status), effectiveDate: optionalText(row.effective_date),
})

export const goalFromRow = (row: Tables<'employee_goals'>): GoalRecord & { createdBy?: string } => ({
  id: text(row.id), employeeId: text(row.employee_code), title: text(row.title), description: text(row.description),
  category: text(row.category), progress: numeric(row.progress), status: text(row.status),
  dueDate: optionalText(row.due_date), createdBy: optionalText(row.created_by),
})

export const lifecycleCaseFromRow = (row: Tables<'lifecycle_cases'>): LifecycleCaseRecord & Record<string, unknown> => ({
  id: text(row.id), employeeId: text(row.employee_code), type: text(row.case_type), status: text(row.status),
  targetDate: text(row.target_date), ownerId: optionalText(row.owner_code), createdAt: optionalText(row.created_at),
})

export const lifecycleTaskFromRow = (row: Tables<'lifecycle_tasks'>): LifecycleTaskRecord & Record<string, unknown> => ({
  id: text(row.id), caseId: text(row.case_id), title: text(row.title), category: text(row.category),
  status: text(row.status), employeeVisible: truthy(row.employee_visible),
  completedBy: optionalText(row.completed_by), completedAt: optionalText(row.completed_at),
})
