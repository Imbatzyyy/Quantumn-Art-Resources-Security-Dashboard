import type { Session } from '@supabase/supabase-js'
import { requireSupabase } from './supabaseClient.js'
import { emailSignInContext } from './supabaseEmailVerification.js'
import { withEmployeeAvatarUrls } from './supabaseAvatars.js'
import {
  acknowledgementFromRow, alertFromRow, alertResponseFromRow, announcementFromRow,
  attendanceFromRow, auditFromRow, benefitFromRow, documentFromRow, employeeFromRow,
  emptySnapshot, goalFromRow, leaveFromRow, lifecycleCaseFromRow, lifecycleTaskFromRow,
  notificationFromRow, payrollFromRow, payrollRunFromRow, performanceCycleFromRow,
  performanceFromRow, requestCommentFromRow, requestFromRow, scheduleFromRow,
  sessionFromRow, zapFindingFromRow, zapScanFromRow,
  type DatabaseRow,
} from './supabaseMappers.js'
import type { EmployeeRecord, HrmsSnapshot } from '../types/hrms.js'
import type { Tables } from '../types/database.js'

interface QueryResultLike<Row> {
  data: Row[] | null
  error: unknown
}

async function paged<Row extends object>(query: { range: (from: number, to: number) => PromiseLike<QueryResultLike<Row>> }): Promise<QueryResultLike<Row>> {
  const rows: Row[] = []
  for (let offset = 0; offset < 200_000; offset += 500) {
    const page = await query.range(offset, offset + 499)
    if (page.error) return { data: null, error: page.error }
    rows.push(...(page.data || []))
    if ((page.data?.length || 0) < 500) return { data: rows, error: null }
  }
  throw new Error('The workspace exceeds the supported snapshot size. Contact an administrator; partial totals were not displayed.')
}

const isDatabaseRow = (value: unknown): value is DatabaseRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const queryRows = <Row extends object>(result: QueryResultLike<Row>, label: string): Row[] => {
  if (result.error) throw result.error
  if (result.data == null) return []
  if (!Array.isArray(result.data) || !result.data.every(isDatabaseRow)) {
    throw new Error(`Supabase returned an invalid ${label} result.`)
  }
  return result.data
}

export async function currentSession(): Promise<Session | null> {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error) throw error
  return data.session
}

export async function getProfileByAuthId(authUserId: string): Promise<EmployeeRecord & { authUserId?: string; emailVerified: boolean; requiresMfa: boolean }> {
  const { data, error } = await requireSupabase().rpc('get_hrms_identity')

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('This account is authenticated but has no HRMS employee profile.')
    }
    throw error
  }
  if (!isDatabaseRow(data)) throw new Error('Supabase returned an invalid employee profile.')
  if (data.auth_user_id !== authUserId) throw new Error('The authenticated identity does not match.')
  return { ...employeeFromRow(data as Tables<'profiles'>), mustChangePassword: data.must_change_password === true, mustSetPassword: data.must_set_password === true, emailVerified: data.email_verified === true, requiresMfa: data.mfa_required === true }
}

export async function fetchSnapshot(): Promise<HrmsSnapshot> {
  const client = requireSupabase()
  const session = await currentSession()
  if (!session) return emptySnapshot()
  if (session.user.app_metadata?.must_change_password || session.user.app_metadata?.must_set_password) return emptySnapshot()
  const { error: accessError } = await client.rpc('assert_hrms_access')
  if (accessError) {
    if (accessError.code === '42501') {
      // Keep the authorization error if bootstrap also rejects a revoked or
      // expired session; callers must not mistake denial for an offline load.
      const emailContext = await emailSignInContext().catch(() => { throw accessError })
      if (emailContext.setupRequired || !emailContext.verified) return emptySnapshot()
    }
    throw accessError
  }

  const [
    profiles, attendance, leaveRequests, payroll, payrollRuns, performance,
    performanceCycles, announcements, securityAlerts, alertResponses, sessions,
    auditLog, zapScanRuns, zapFindings, employeeRequests, requestComments,
    notifications, documents, documentAcknowledgements, schedules, benefits,
    goals, lifecycleCases, lifecycleTasks,
  ] = await Promise.all([
    paged(client.from('profiles').select('*').order('employee_code')),
    paged(client.from('attendance').select('*').order('work_date', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('leave_requests').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('payroll').select('*').order('id', { ascending: false })),
    paged(client.from('payroll_runs').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('performance_reviews').select('*').order('id', { ascending: false })),
    paged(client.from('performance_cycles').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('announcements').select('*').order('published_on', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('security_alerts').select('*').order('created_at', { ascending: false }).order('alert_code', { ascending: true })),
    paged(client.from('security_alert_responses').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('account_sessions').select('*').order('created_at', { ascending: false }).order('session_code', { ascending: true })),
    paged(client.from('audit_logs').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('zap_scan_runs').select('*').order('completed_at', { ascending: false }).order('scan_code', { ascending: true })),
    paged(client.from('zap_findings').select('*').order('id', { ascending: false })),
    paged(client.from('employee_requests').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('request_comments').select('*').order('created_at', { ascending: true }).order('id', { ascending: true })),
    paged(client.from('notifications').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('employee_documents').select('id,employee_code,document_type,title,filename,version,period,requires_ack,sensitive,expires_on,created_at,updated_at,uploaded_by').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('document_acknowledgements').select('*').order('acknowledged_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('work_schedules').select('*').order('work_date', { ascending: true }).order('id', { ascending: true })),
    paged(client.from('employee_benefits').select('*').order('benefit_type', { ascending: true }).order('id', { ascending: true })),
    paged(client.from('employee_goals').select('*').order('due_date', { ascending: true }).order('id', { ascending: true })),
    paged(client.from('lifecycle_cases').select('*').order('created_at', { ascending: false }).order('id', { ascending: true })),
    paged(client.from('lifecycle_tasks').select('*').order('id', { ascending: true })),
  ])

  const currentCode = currentBrowserSessionCode(session.user.id)
  return {
    employees: await withEmployeeAvatarUrls(queryRows(profiles, 'profiles').map(employeeFromRow), session.user.id),
    attendance: queryRows(attendance, 'attendance').map(attendanceFromRow),
    leaveRequests: queryRows(leaveRequests, 'leave requests').map(leaveFromRow),
    payroll: queryRows(payroll, 'payroll').map(payrollFromRow),
    payrollRuns: queryRows(payrollRuns, 'payroll runs').map(payrollRunFromRow),
    performance: queryRows(performance, 'performance reviews').map(performanceFromRow),
    performanceCycles: queryRows(performanceCycles, 'performance cycles').map(performanceCycleFromRow),
    announcements: queryRows(announcements, 'announcements').map(announcementFromRow),
    securityAlerts: queryRows(securityAlerts, 'security alerts').map(alertFromRow),
    alertResponses: queryRows(alertResponses, 'security alert responses').map(alertResponseFromRow),
    sessions: queryRows(sessions, 'account sessions').map((row) => sessionFromRow(row, currentCode)),
    auditLog: queryRows(auditLog, 'audit logs').map(auditFromRow),
    zapScanRuns: queryRows(zapScanRuns, 'ZAP scan runs').map(zapScanFromRow),
    zapFindings: queryRows(zapFindings, 'ZAP findings').map(zapFindingFromRow),
    employeeRequests: queryRows(employeeRequests, 'employee requests').map(requestFromRow),
    requestComments: queryRows(requestComments, 'request comments').map(requestCommentFromRow),
    notifications: queryRows(notifications, 'notifications').map(notificationFromRow),
    documents: queryRows(documents, 'employee documents').map(documentFromRow),
    documentAcknowledgements: queryRows(documentAcknowledgements, 'document acknowledgements').map(acknowledgementFromRow),
    schedules: queryRows(schedules, 'work schedules').map(scheduleFromRow),
    benefits: queryRows(benefits, 'employee benefits').map(benefitFromRow),
    goals: queryRows(goals, 'employee goals').map(goalFromRow),
    lifecycleCases: queryRows(lifecycleCases, 'lifecycle cases').map(lifecycleCaseFromRow),
    lifecycleTasks: queryRows(lifecycleTasks, 'lifecycle tasks').map(lifecycleTaskFromRow),
  }
}

const sessionKey = (authUserId: string): string => `quantum-hrms-session-${authUserId}`

export function currentBrowserSessionCode(authUserId: string): string {
  if (!authUserId || typeof window === 'undefined') return ''
  const key = sessionKey(authUserId)
  let code = window.sessionStorage.getItem(key)
  if (!code) {
    code = `SES-${window.crypto.randomUUID().replaceAll('-', '').toUpperCase()}`
    window.sessionStorage.setItem(key, code)
  }
  return code
}

export function clearCurrentBrowserSessionCode(authUserId: string): void {
  window.sessionStorage.removeItem(sessionKey(authUserId))
}

export function saveCurrentBrowserSessionCode(authUserId: string, code: string): void {
  window.sessionStorage.setItem(sessionKey(authUserId), code)
}
