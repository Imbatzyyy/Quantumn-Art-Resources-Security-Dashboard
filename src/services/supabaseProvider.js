import { requireSupabase } from './supabaseClient.js'
import { validatePermanentPassword } from '../utils/passwordPolicy.js'

const sessionKey = (authUserId) => `quantum-hrms-session-${authUserId}`

/** @returns {'admin' | 'employee'} */
const portalForRole = (role) => role === 'employee' ? 'employee' : 'admin'

const currentBrowserSessionCode = (authUserId) => {
  if (!authUserId || typeof window === 'undefined') return ''
  const key = sessionKey(authUserId)
  let code = window.localStorage.getItem(key)
  if (!code) {
    code = `SES-${window.crypto.randomUUID().replaceAll('-', '').toUpperCase()}`
    window.localStorage.setItem(key, code)
  }
  return code
}

const browserDeviceLabel = () => {
  if (typeof navigator === 'undefined') return 'Web browser'
  const agent = navigator.userAgent
  const browser = agent.includes('Edg/') ? 'Microsoft Edge'
    : agent.includes('Chrome/') ? 'Google Chrome'
      : agent.includes('Safari/') ? 'Safari'
        : agent.includes('Firefox/') ? 'Firefox'
          : 'Web browser'
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Unknown device'
  return `${browser} on ${platform}`
}

async function securityOperation(input) {
  const session = await currentSession()
  if (!session) throw new Error('Your session has expired. Sign in again.')
  const response = await fetch('/api/security-operations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The security operation could not be completed.')
  return result
}

const emptySnapshot = () => ({
  employees: [],
  attendance: [],
  leaveRequests: [],
  payroll: [],
  payrollRuns: [],
  performance: [],
  performanceCycles: [],
  announcements: [],
  securityAlerts: [],
  alertResponses: [],
  sessions: [],
  auditLog: [],
  zapScanRuns: [],
  zapFindings: [],
  employeeRequests: [],
  requestComments: [],
  notifications: [],
  documents: [],
  documentAcknowledgements: [],
  schedules: [],
  benefits: [],
  goals: [],
  lifecycleCases: [],
  lifecycleTasks: [],
})

const throwIfError = ({ error }) => {
  if (error) throw error
}

const employeeFromRow = (row) => ({
  id: row.employee_code,
  authUserId: row.auth_user_id,
  firstName: row.first_name,
  middleName: row.middle_name ?? '',
  lastName: row.last_name,
  preferredName: row.preferred_name ?? '',
  email: row.email,
  role: row.role,
  department: row.department,
  position: row.position,
  status: row.status,
  salary: Number(row.salary ?? 0),
  phone: row.phone ?? '',
  hireDate: row.hire_date,
  employmentType: row.employment_type ?? 'Full-time',
  workArrangement: row.work_arrangement ?? 'On-site',
  workLocation: row.work_location ?? 'Main Office',
  costCenter: row.cost_center ?? '',
  managerId: row.manager_code ?? '',
  emergencyContactName: row.emergency_contact_name ?? '',
  emergencyContactRelationship: row.emergency_contact_relationship ?? '',
  emergencyContactPhone: row.emergency_contact_phone ?? '',
})

const attendanceFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  date: row.work_date,
  clockIn: row.clock_in?.slice(0, 5) ?? null,
  clockOut: row.clock_out?.slice(0, 5) ?? null,
  status: row.status,
  hours: Number(row.hours ?? 0),
})

const leaveFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  type: row.leave_type,
  startDate: row.start_date,
  endDate: row.end_date,
  days: Number(row.days),
  reason: row.reason,
  status: row.status,
})

const payrollFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  period: row.period,
  gross: Number(row.gross),
  allowances: Number(row.allowances ?? 0),
  bonuses: Number(row.bonuses ?? 0),
  deductions: Number(row.deductions),
  net: Number(row.net),
  status: row.status,
  runId: row.payroll_run_id,
  paymentDate: row.payment_date,
})

const payrollRunFromRow = (row) => ({
  id: row.id,
  period: row.period,
  deductionRate: Number(row.deduction_rate),
  status: row.status,
  employeeCount: Number(row.employee_count),
  grossTotal: Number(row.gross_total),
  netTotal: Number(row.net_total),
  createdBy: row.created_by,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  releasedAt: row.released_at,
  paidAt: row.paid_at,
  lockedAt: row.locked_at,
  createdAt: row.created_at,
})

const performanceFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  period: row.period,
  score: Number(row.score),
  goalProgress: Number(row.goal_progress),
  quality: Number(row.quality_score ?? row.score),
  productivity: Number(row.productivity_score ?? row.score),
  teamwork: Number(row.teamwork_score ?? row.score),
  rating: row.rating,
  comments: row.comments ?? '',
  cycleId: row.cycle_id,
  status: row.status ?? 'Published',
  publishedAt: row.published_at,
})

const performanceCycleFromRow = (row) => ({
  id: row.id,
  title: row.title,
  period: row.period,
  status: row.status,
  startDate: row.start_date,
  endDate: row.end_date,
})

const announcementFromRow = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  priority: row.priority,
  date: row.published_on,
})

const alertFromRow = (row) => ({
  id: row.alert_code,
  employeeId: row.employee_code,
  severity: row.severity,
  type: row.event_type,
  title: row.title,
  description: row.description,
  affected: row.affected_label,
  time: row.display_time,
  status: row.status,
  recommendedAction: row.recommended_action,
  whyItMatters: row.why_it_matters,
  assignedTo: row.assigned_to,
  resolutionReason: row.resolution_reason,
  resolutionNotes: row.resolution_notes,
  confidence: row.confidence,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const alertResponseFromRow = (row) => ({
  id: row.id,
  alertId: row.alert_code,
  actorId: row.actor_employee_code,
  action: row.response_action,
  note: row.note ?? '',
  createdAt: row.created_at,
})

const sessionFromRow = (row, currentCode) => ({
  id: row.session_code,
  employeeId: row.employee_code,
  device: row.device,
  location: row.location,
  lastActive: row.last_active_label,
  current: row.session_code === currentCode,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
  assuranceLevel: row.assurance_level ?? 'aal1',
  trustStatus: row.trust_status ?? 'Recognized',
})

const auditFromRow = (row) => ({
  id: row.id,
  actor: row.actor_label,
  action: row.action,
  target: row.target,
  time: row.display_time,
})

const zapScanFromRow = (row) => ({
  id: row.scan_code,
  type: row.scan_type,
  environment: row.environment,
  targetUrl: row.target_url,
  version: row.zap_version ?? 'OWASP ZAP',
  startedAt: row.started_at,
  completedAt: row.completed_at,
  status: row.status,
  high: row.high_count,
  medium: row.medium_count,
  low: row.low_count,
  informational: row.informational_count,
  reportName: row.report_name ?? '',
  reportSha256: row.report_sha256 ?? '',
  authorizedScope: row.authorized_scope,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  notes: row.notes ?? '',
})

const zapFindingFromRow = (row) => ({
  id: row.id,
  scanId: row.scan_code,
  pluginId: row.plugin_id ?? '',
  name: row.name,
  risk: row.risk,
  confidence: row.confidence,
  description: row.description ?? '',
  solution: row.solution ?? '',
  referenceUrl: row.reference_url ?? '',
  affectedUrl: row.affected_url ?? '',
  evidence: row.evidence ?? '',
  status: row.status,
})

const requestFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  type: row.request_type,
  subject: row.subject,
  description: row.description,
  requestedDate: row.requested_date,
  requestedValue: row.requested_value ?? '',
  priority: row.priority,
  status: row.status,
  assignedTo: row.assigned_to,
  decisionNote: row.decision_note ?? '',
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const requestCommentFromRow = (row) => ({
  id: row.id,
  requestId: row.request_id,
  authorId: row.author_employee_code,
  body: row.body,
  internal: row.is_internal,
  createdAt: row.created_at,
})

const notificationFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  category: row.category,
  title: row.title,
  message: row.message,
  destination: row.destination,
  actionLabel: row.action_label,
  readAt: row.read_at,
  createdAt: row.created_at,
})

const documentFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  title: row.title,
  type: row.document_type,
  period: row.period,
  content: row.content,
  filename: row.filename,
  version: row.version,
  requiresAck: row.requires_ack,
  sensitive: row.sensitive,
  expiresOn: row.expires_on,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
})

const acknowledgementFromRow = (row) => ({
  id: row.id,
  documentId: row.document_id,
  employeeId: row.employee_code,
  acknowledgedAt: row.acknowledged_at,
})

const scheduleFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  date: row.work_date,
  shiftStart: row.shift_start?.slice(0, 5) ?? null,
  shiftEnd: row.shift_end?.slice(0, 5) ?? null,
  location: row.location,
  workMode: row.work_mode,
  notes: row.notes ?? '',
})

const benefitFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  type: row.benefit_type,
  provider: row.provider ?? '',
  planName: row.plan_name,
  employeeShare: Number(row.employee_share),
  employerShare: Number(row.employer_share),
  status: row.status,
  effectiveDate: row.effective_date,
})

const goalFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  title: row.title,
  description: row.description,
  category: row.category,
  progress: Number(row.progress),
  status: row.status,
  dueDate: row.due_date,
  createdBy: row.created_by,
})

const lifecycleCaseFromRow = (row) => ({
  id: row.id,
  employeeId: row.employee_code,
  type: row.case_type,
  status: row.status,
  targetDate: row.target_date,
  ownerId: row.owner_code,
  createdAt: row.created_at,
})

const lifecycleTaskFromRow = (row) => ({
  id: row.id,
  caseId: row.case_id,
  title: row.title,
  category: row.category,
  status: row.status,
  employeeVisible: row.employee_visible,
  completedBy: row.completed_by,
  completedAt: row.completed_at,
})

async function currentSession() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}

async function getProfileByAuthId(authUserId) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('This account is authenticated but has no HRMS employee profile.')
    }
    throw error
  }

  return employeeFromRow(data)
}

async function fetchSnapshot() {
  const client = requireSupabase()
  const session = await currentSession()
  if (!session) return emptySnapshot()

  const [
    profiles,
    attendance,
    leaveRequests,
    payroll,
    payrollRuns,
    performance,
    performanceCycles,
    announcements,
    securityAlerts,
    alertResponses,
    sessions,
    auditLog,
    zapScanRuns,
    zapFindings,
    employeeRequests,
    requestComments,
    notifications,
    documents,
    documentAcknowledgements,
    schedules,
    benefits,
    goals,
    lifecycleCases,
    lifecycleTasks,
  ] = await Promise.all([
    client.from('profiles').select('*').order('employee_code'),
    client.from('attendance').select('*').order('work_date', { ascending: false }),
    client.from('leave_requests').select('*').order('created_at', { ascending: false }),
    client.from('payroll').select('*').order('id', { ascending: false }),
    client.from('payroll_runs').select('*').order('created_at', { ascending: false }),
    client.from('performance_reviews').select('*').order('id', { ascending: false }),
    client.from('performance_cycles').select('*').order('created_at', { ascending: false }),
    client.from('announcements').select('*').order('published_on', { ascending: false }),
    client.from('security_alerts').select('*').order('created_at', { ascending: false }),
    client.from('security_alert_responses').select('*').order('created_at', { ascending: false }),
    client.from('account_sessions').select('*').order('created_at', { ascending: false }),
    client.from('audit_logs').select('*').order('created_at', { ascending: false }),
    client.from('zap_scan_runs').select('*').order('completed_at', { ascending: false }),
    client.from('zap_findings').select('*').order('id', { ascending: false }),
    client.from('employee_requests').select('*').order('created_at', { ascending: false }),
    client.from('request_comments').select('*').order('created_at', { ascending: true }),
    client.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
    client.from('employee_documents').select('*').order('created_at', { ascending: false }),
    client.from('document_acknowledgements').select('*').order('acknowledged_at', { ascending: false }),
    client.from('work_schedules').select('*').order('work_date', { ascending: true }),
    client.from('employee_benefits').select('*').order('benefit_type', { ascending: true }),
    client.from('employee_goals').select('*').order('due_date', { ascending: true }),
    client.from('lifecycle_cases').select('*').order('created_at', { ascending: false }),
    client.from('lifecycle_tasks').select('*').order('id', { ascending: true }),
  ])

  ;[
    profiles,
    attendance,
    leaveRequests,
    payroll,
    payrollRuns,
    performance,
    performanceCycles,
    announcements,
    securityAlerts,
    alertResponses,
    sessions,
    auditLog,
    zapScanRuns,
    zapFindings,
    employeeRequests,
    requestComments,
    notifications,
    documents,
    documentAcknowledgements,
    schedules,
    benefits,
    goals,
    lifecycleCases,
    lifecycleTasks,
  ].forEach(throwIfError)

  const currentCode = currentBrowserSessionCode(session.user.id)

  return {
    employees: profiles.data.map(employeeFromRow),
    attendance: attendance.data.map(attendanceFromRow),
    leaveRequests: leaveRequests.data.map(leaveFromRow),
    payroll: payroll.data.map(payrollFromRow),
    payrollRuns: payrollRuns.data.map(payrollRunFromRow),
    performance: performance.data.map(performanceFromRow),
    performanceCycles: performanceCycles.data.map(performanceCycleFromRow),
    announcements: announcements.data.map(announcementFromRow),
    securityAlerts: securityAlerts.data.map(alertFromRow),
    alertResponses: alertResponses.data.map(alertResponseFromRow),
    sessions: sessions.data.map((row) => sessionFromRow(row, currentCode)),
    auditLog: auditLog.data.map(auditFromRow),
    zapScanRuns: zapScanRuns.data.map(zapScanFromRow),
    zapFindings: zapFindings.data.map(zapFindingFromRow),
    employeeRequests: employeeRequests.data.map(requestFromRow),
    requestComments: requestComments.data.map(requestCommentFromRow),
    notifications: notifications.data.map(notificationFromRow),
    documents: documents.data.map(documentFromRow),
    documentAcknowledgements: documentAcknowledgements.data.map(acknowledgementFromRow),
    schedules: schedules.data.map(scheduleFromRow),
    benefits: benefits.data.map(benefitFromRow),
    goals: goals.data.map(goalFromRow),
    lifecycleCases: lifecycleCases.data.map(lifecycleCaseFromRow),
    lifecycleTasks: lifecycleTasks.data.map(lifecycleTaskFromRow),
  }
}

export const supabaseProvider = {
  getSnapshot: fetchSnapshot,

  subscribeToChanges(onChange) {
    const client = requireSupabase()
    const tables = [
      'profiles', 'attendance', 'leave_requests', 'payroll', 'payroll_runs',
      'performance_reviews', 'performance_cycles', 'announcements',
      'security_alerts', 'security_alert_responses', 'account_sessions', 'audit_logs',
      'zap_scan_runs', 'zap_findings', 'employee_requests',
      'request_comments', 'notifications', 'employee_documents',
      'document_acknowledgements', 'work_schedules', 'employee_benefits',
      'employee_goals', 'lifecycle_cases', 'lifecycle_tasks',
    ]
    let debounceTimer
    let channel = client.channel(`hrms-live-${Date.now()}`)
    const queueRefresh = () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(onChange, 250)
    }

    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        queueRefresh,
      )
    })
    channel.subscribe()

    return () => {
      window.clearTimeout(debounceTimer)
      client.removeChannel(channel)
    }
  },

  async getCurrentUser() {
    const session = await currentSession()
    if (!session) return null
    const client = requireSupabase()
    const profile = await getProfileByAuthId(session.user.id)
    if (!['Active', 'On Leave'].includes(profile.status)) {
      await client.auth.signOut()
      throw new Error('This account is inactive. Contact an HR administrator.')
    }

    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!assuranceError && assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
      await client.auth.signOut()
      return null
    }
    return {
      ...profile,
      portal: portalForRole(profile.role),
      mustChangePassword: session.user.app_metadata?.must_change_password === true,
      mustSetPassword: session.user.app_metadata?.must_set_password === true,
    }
  },

  async authenticate({ email, password, portal }) {
    const client = requireSupabase()
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) throw new Error('Email or password is incorrect.')

    try {
      const profile = await getProfileByAuthId(data.user.id)
      if (!['Active', 'On Leave'].includes(profile.status)) {
        throw new Error('This account is inactive. Contact an HR administrator.')
      }
      const resolvedPortal = portalForRole(profile.role)

      if (resolvedPortal !== portal) {
        await client.auth.signOut()
        throw new Error(
          portal === 'admin'
            ? 'This account does not have administrator access.'
            : 'Use the administrator portal for this account.',
        )
      }
      if (resolvedPortal === 'admin' && data.user.app_metadata?.must_set_password === true) {
        await client.auth.signOut()
        throw new Error('Accept the invitation email and create your password before signing in.')
      }

      const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError) throw assuranceError
      if (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
        const { data: factors, error: factorsError } = await client.auth.mfa.listFactors()
        if (factorsError) throw factorsError
        const factor = factors.totp?.[0]
        if (!factor) throw new Error('Your multi-factor authentication setup is incomplete. Contact an administrator.')
        return {
          mfaRequired: /** @type {true} */ (true),
          factorId: factor.id,
          portal: resolvedPortal,
          email: profile.email,
        }
      }

      return {
        ...profile,
        portal: resolvedPortal,
        mustChangePassword: data.user.app_metadata?.must_change_password === true,
        mustSetPassword: false,
      }
    } catch (errorReason) {
      await client.auth.signOut()
      throw errorReason
    }
  },

  async signOut() {
    const client = requireSupabase()
    const session = await currentSession()
    if (session) {
      const currentSessionCode = currentBrowserSessionCode(session.user.id)
      try { await securityOperation({ action: 'end-current-session', currentSessionCode }) } catch { /* Authentication sign-out still proceeds. */ }
      window.localStorage.removeItem(sessionKey(session.user.id))
    }
    const { error } = await client.auth.signOut()
    if (error) throw error
  },

  async verifyMfaLogin({ factorId, code, portal }) {
    const client = requireSupabase()
    const normalizedCode = String(code ?? '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(normalizedCode)) throw new Error('Enter the 6-digit authenticator code.')
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: normalizedCode })
    if (error) throw new Error('The authenticator code is invalid or expired.')

    const profile = await getProfileByAuthId((await currentSession()).user.id)
    const resolvedPortal = portalForRole(profile.role)
    if (resolvedPortal !== portal) {
      await client.auth.signOut()
      throw new Error('This account cannot access the selected portal.')
    }
    return { ...profile, portal: resolvedPortal, mustChangePassword: false }
  },

  async recordCurrentSession() {
    const session = await currentSession()
    if (!session) return null
    const sessionCode = currentBrowserSessionCode(session.user.id)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Location unavailable'
    const { data: assurance } = await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel()
    await securityOperation({
      action: 'record-session',
      sessionCode,
      device: browserDeviceLabel(),
      location: timeZone === 'Asia/Manila' ? 'Philippines · Asia/Manila' : timeZone,
      assuranceLevel: assurance?.currentLevel ?? 'aal1',
    })
    return sessionCode
  },

  async getMfaStatus() {
    const client = requireSupabase()
    const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] = await Promise.all([
      client.auth.mfa.listFactors(),
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    if (factorsError) throw factorsError
    if (assuranceError) throw assuranceError
    const verifiedFactor = factors.totp?.[0] ?? null
    return {
      enabled: Boolean(verifiedFactor),
      factorId: verifiedFactor?.id ?? null,
      friendlyName: verifiedFactor?.friendly_name || 'Quantum HRMS Authenticator',
      currentLevel: assurance?.currentLevel ?? 'aal1',
    }
  },

  async getOrganizationSecuritySummary() {
    return securityOperation({ action: 'organization-summary' })
  },

  async beginMfaEnrollment() {
    const client = requireSupabase()
    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors()
    if (factorsError) throw factorsError
    if (factors.totp?.length) throw new Error('Authenticator MFA is already enabled for this account.')
    for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status !== 'verified')) {
      await client.auth.mfa.unenroll({ factorId: factor.id })
    }
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Quantum HRMS Authenticator',
    })
    if (error) throw error
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    }
  },

  async verifyMfaEnrollment({ factorId, code }) {
    const client = requireSupabase()
    const normalizedCode = String(code ?? '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(normalizedCode)) throw new Error('Enter the 6-digit code from your authenticator app.')
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: normalizedCode })
    if (error) throw new Error('The authenticator code is invalid or expired.')
    await client.rpc('record_user_activity', {
      activity_action: 'Enabled multi-factor authentication',
      activity_target: 'Own administrator account',
    })
    return this.getMfaStatus()
  },

  async disableMfa(factorId) {
    const client = requireSupabase()
    const { error } = await client.auth.mfa.unenroll({ factorId })
    if (error) throw new Error('Re-authenticate with your authenticator before disabling MFA.')
    await client.rpc('record_user_activity', {
      activity_action: 'Disabled multi-factor authentication',
      activity_target: 'Own administrator account',
    })
    return this.getMfaStatus()
  },

  async addEmployee(input) {
    const session = await currentSession()
    if (!session) throw new Error('Administrator authentication is required.')

    const response = await fetch('/api/admin-create-employee', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'The employee account could not be created.')
    }
    return fetchSnapshot()
  },

  async inviteAdminAccount(input) {
    const session = await currentSession()
    if (!session) throw new Error('System Administrator authentication is required.')
    const response = await fetch('/api/admin-invite-account', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'The administrator invitation could not be sent.')
    return fetchSnapshot()
  },

  async completeAdminInvitation({ newPassword }) {
    const session = await currentSession()
    if (!session) throw new Error('This invitation link is invalid or has expired.')
    const response = await fetch('/api/complete-admin-invite', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ newPassword }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Your administrator password could not be created.')
    await this.signOut()
    return result
  },

  async completeInitialPassword({ currentPassword, newPassword }) {
    const client = requireSupabase()
    const session = await currentSession()
    if (!session) throw new Error('Your employee session has expired. Sign in again.')

    const response = await fetch('/api/complete-initial-password', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'The new password could not be saved.')

    // Supabase can invalidate the existing refresh token when an administrator
    // changes a password. Establish a fresh employee session with the new
    // password so the cleared must_change_password app metadata is available
    // immediately and the setup modal can close without a manual sign-in.
    await client.auth.signOut({ scope: 'others' })
    const { error: signInError } = await client.auth.signInWithPassword({
      email: session.user.email,
      password: newPassword,
    })
    if (signInError) {
      await client.auth.signOut({ scope: 'local' })
      throw new Error('Your password was changed. Sign in again with your new password.')
    }
    return fetchSnapshot()
  },

  async updateEmployee(id, changes) {
    const client = requireSupabase()
    const profile = await this.getCurrentUser()

    if (changes.managerId) {
      const { data: manager, error: managerError } = await client
        .from('profiles')
        .select('employee_code')
        .eq('employee_code', changes.managerId)
        .in('role', ['admin', 'hr_admin'])
        .in('status', ['Active', 'On Leave'])
        .maybeSingle()
      if (managerError || !manager) {
        throw new Error('Select an active administrator as the reporting manager.')
      }
    }

    if (profile.id === id) {
      const { error } = await client.rpc('update_own_profile', {
        new_phone: changes.phone ?? profile.phone,
      })
      if (error) throw error
    } else {
      const update = {}
      if (changes.phone !== undefined) update.phone = changes.phone
      if (changes.position !== undefined) update.position = changes.position
      if (changes.status !== undefined) update.status = changes.status
      if (changes.department !== undefined) update.department = changes.department
      if (changes.salary !== undefined) update.salary = Number(changes.salary)
      if (changes.firstName !== undefined) update.first_name = changes.firstName.trim()
      if (changes.middleName !== undefined) update.middle_name = changes.middleName.trim() || null
      if (changes.lastName !== undefined) update.last_name = changes.lastName.trim()
      if (changes.preferredName !== undefined) update.preferred_name = changes.preferredName.trim() || null
      if (changes.hireDate !== undefined) update.hire_date = changes.hireDate
      if (changes.employmentType !== undefined) update.employment_type = changes.employmentType
      if (changes.workArrangement !== undefined) update.work_arrangement = changes.workArrangement
      if (changes.workLocation !== undefined) update.work_location = changes.workLocation.trim()
      if (changes.costCenter !== undefined) update.cost_center = changes.costCenter.trim() || null
      if (changes.managerId !== undefined) update.manager_code = changes.managerId || null
      if (changes.emergencyContactName !== undefined) update.emergency_contact_name = changes.emergencyContactName.trim() || null
      if (changes.emergencyContactRelationship !== undefined) update.emergency_contact_relationship = changes.emergencyContactRelationship.trim() || null
      if (changes.emergencyContactPhone !== undefined) update.emergency_contact_phone = changes.emergencyContactPhone.trim() || null

      const { error } = await client.from('profiles').update(update).eq('employee_code', id)
      if (error) throw error
    }

    return fetchSnapshot()
  },

  async submitLeave(input) {
    const { error } = await requireSupabase().rpc('submit_leave_request', {
      requested_type: input.type,
      requested_start: input.startDate,
      requested_end: input.endDate,
      requested_reason: input.reason,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async reviewLeave(id, status) {
    const { error } = await requireSupabase().rpc('review_leave_request', {
      request_id: id,
      decision: status,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async submitRequest(input) {
    const { error } = await requireSupabase().rpc('submit_employee_request', {
      requested_type: input.type,
      requested_subject: input.subject,
      requested_description: input.description,
      requested_date: input.requestedDate || null,
      requested_value: input.requestedValue || null,
      requested_priority: input.priority || 'Normal',
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async reviewRequest(id, status, reason) {
    const { error } = await requireSupabase().rpc('review_employee_request', {
      selected_request_id: id,
      decision: status,
      decision_reason: reason || '',
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async addRequestComment(id, body, internal = false) {
    const { error } = await requireSupabase().rpc('add_request_comment', {
      selected_request_id: id,
      comment_body: body,
      internal_note: internal,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async cancelRequest(id) {
    const { error } = await requireSupabase().rpc('cancel_employee_request', {
      selected_request_id: id,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async markNotificationRead(id) {
    const { error } = await requireSupabase().rpc('mark_notification_read', {
      selected_notification_id: id,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async markAllNotificationsRead() {
    const { error } = await requireSupabase().rpc('mark_all_notifications_read')
    if (error) throw error
    return fetchSnapshot()
  },

  async acknowledgeDocument(id) {
    const { error } = await requireSupabase().rpc('acknowledge_document', {
      selected_document_id: id,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async updateGoalProgress(id, progress) {
    const { error } = await requireSupabase().rpc('update_goal_progress', {
      selected_goal_id: id,
      new_progress: Number(progress),
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async clock() {
    const { error } = await requireSupabase().rpc('clock_attendance')
    if (error) throw error
    return fetchSnapshot()
  },

  async updateAlert(id, status) {
    if (!['Acknowledged', 'Investigating', 'Resolved'].includes(status)) {
      throw new Error('Select a valid alert status.')
    }
    const { error } = await requireSupabase()
      .from('security_alerts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('alert_code', id)
    if (error) throw error
    return fetchSnapshot()
  },

  async addSecurityAlert(input) {
    await securityOperation({ action: 'create-alert', ...input })
    return fetchSnapshot()
  },

  async respondToAlert(id, action, note = '') {
    const { error } = await requireSupabase().rpc('respond_to_security_alert', {
      selected_alert_code: id,
      response_action: action,
      response_note: note,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async updateSecurityInvestigation(input) {
    await securityOperation({ action: 'update-alert', ...input })
    return fetchSnapshot()
  },

  async importZapReport(input) {
    const session = await currentSession()
    if (!session) throw new Error('Security Administrator authentication is required.')
    const response = await fetch('/api/import-zap-report', {
      method: 'POST',
      headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'The ZAP report could not be imported.')
    return fetchSnapshot()
  },

  async endSession(id) {
    const client = requireSupabase()
    const profile = await this.getCurrentUser()
    const session = await currentSession()
    const currentSessionCode = currentBrowserSessionCode(session.user.id)
    if (profile.role === 'employee') {
      const { error: signOutError } = await client.auth.signOut({ scope: 'others' })
      if (signOutError) throw signOutError
      await securityOperation({ action: 'revoke-other-sessions', currentSessionCode })
    } else {
      await securityOperation({ action: 'revoke-session', sessionCode: id, currentSessionCode })
    }
    return fetchSnapshot()
  },

  async changePassword({ currentPassword, newPassword }) {
    const client = requireSupabase()
    const profile = await this.getCurrentUser()
    const policyError = validatePermanentPassword(newPassword, {
      currentPassword,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    })
    if (policyError) throw new Error(policyError)

    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData.user?.email) {
      throw new Error('Your session has expired. Sign in again.')
    }

    const { error: verifyError } = await client.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    })
    if (verifyError) throw new Error('The current password is incorrect.')

    const { error: updateError } = await client.auth.updateUser({ password: newPassword })
    if (updateError) throw updateError

    await client.rpc('record_user_activity', {
      activity_action: 'Changed account password',
      activity_target: 'Own HRMS account',
    })
    return fetchSnapshot()
  },

  async addAnnouncement(input) {
    const { error } = await requireSupabase().from('announcements').insert({
      title: input.title,
      content: input.content,
      priority: input.priority,
      published_on: new Date().toISOString().slice(0, 10),
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async createDocument(input) {
    const profile = await this.getCurrentUser()
    const { error } = await requireSupabase().from('employee_documents').insert({
      employee_code: input.employeeId || null,
      title: input.title.trim(),
      document_type: input.type,
      period: input.period?.trim() || null,
      content: input.content.trim(),
      filename: input.filename.trim(),
      version: input.version?.trim() || '1.0',
      requires_ack: Boolean(input.requiresAck),
      sensitive: Boolean(input.sensitive),
      expires_on: input.expiresOn || null,
      uploaded_by: profile.id,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async saveSchedule(input) {
    const { error } = await requireSupabase().from('work_schedules').upsert(
      {
        employee_code: input.employeeId,
        work_date: input.date,
        shift_start: input.workMode === 'Rest Day' ? '00:00' : input.shiftStart,
        shift_end: input.workMode === 'Rest Day' ? '00:00' : input.shiftEnd,
        location: input.workMode === 'Rest Day' ? 'Not scheduled' : input.location,
        work_mode: input.workMode,
        notes: input.notes || null,
      },
      { onConflict: 'employee_code,work_date' },
    )
    if (error) throw error
    return fetchSnapshot()
  },

  async saveBenefit(input) {
    const { error } = await requireSupabase().from('employee_benefits').upsert(
      {
        employee_code: input.employeeId,
        benefit_type: input.type,
        provider: input.provider || null,
        plan_name: input.planName,
        employee_share: Number(input.employeeShare || 0),
        employer_share: Number(input.employerShare || 0),
        status: input.status || 'Active',
        effective_date: input.effectiveDate,
      },
      { onConflict: 'employee_code,benefit_type,plan_name' },
    )
    if (error) throw error
    return fetchSnapshot()
  },

  async saveGoal(input) {
    const profile = await this.getCurrentUser()
    const payload = {
      employee_code: input.employeeId,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      category: input.category || 'Role',
      progress: Number(input.progress || 0),
      status: input.status || 'Active',
      due_date: input.dueDate || null,
      created_by: profile.id,
    }
    const query = input.id
      ? requireSupabase().from('employee_goals').update(payload).eq('id', input.id)
      : requireSupabase().from('employee_goals').insert(payload)
    const { error } = await query
    if (error) throw error
    return fetchSnapshot()
  },

  async createLifecycleCase(input) {
    const { error } = await requireSupabase().rpc('create_lifecycle_case', {
      target_employee: input.employeeId,
      selected_case_type: input.type,
      selected_target_date: input.targetDate,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async updateLifecycleTask(id, status) {
    const { error } = await requireSupabase().rpc('update_lifecycle_task', {
      selected_task_id: id,
      new_status: status,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async generatePayroll({ period, deductionRate }) {
    const { error } = await requireSupabase().rpc('generate_payroll', {
      payroll_period: period.trim(),
      deduction_rate: Number(deductionRate),
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async transitionPayrollRun(id, status) {
    const { error } = await requireSupabase().rpc('transition_payroll_run', {
      selected_run_id: id,
      next_status: status,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async savePerformance(input) {
    const { error } = await requireSupabase().rpc('save_performance_review', {
      target_employee: input.employeeId,
      review_period: input.period.trim(),
      review_score: Number(input.score),
      review_goal_progress: Number(input.goalProgress),
      review_quality: Number(input.quality),
      review_productivity: Number(input.productivity),
      review_teamwork: Number(input.teamwork),
      review_rating: input.rating,
      review_comments: input.comments || '',
      review_cycle_id: input.cycleId || null,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async publishPerformance(id) {
    const { error } = await requireSupabase().rpc('publish_performance_review', {
      selected_review_id: id,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async createPerformanceCycle(input) {
    const profile = await this.getCurrentUser()
    const { error } = await requireSupabase().from('performance_cycles').insert({
      title: input.title.trim(),
      period: input.period.trim(),
      status: input.status || 'Draft',
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      created_by: profile.id,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async recordActivity({ action, target }) {
    const { error } = await requireSupabase().rpc('record_user_activity', {
      activity_action: action,
      activity_target: target,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async refresh() {
    return fetchSnapshot()
  },

}
