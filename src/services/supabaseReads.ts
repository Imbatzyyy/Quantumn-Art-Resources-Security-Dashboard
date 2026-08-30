import type { Session } from '@supabase/supabase-js'
import { requireSupabase } from './supabaseClient.js'
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

interface QueryResultLike {
  data: unknown
  error: unknown
}

const isDatabaseRow = (value: unknown): value is DatabaseRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const queryRows = (result: QueryResultLike, label: string): DatabaseRow[] => {
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

export async function getProfileByAuthId(authUserId: string): Promise<EmployeeRecord & { authUserId?: string }> {
  const { data, error } = await requireSupabase()
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
  if (!isDatabaseRow(data)) throw new Error('Supabase returned an invalid employee profile.')
  return employeeFromRow(data)
}

export async function fetchSnapshot(): Promise<HrmsSnapshot> {
  const client = requireSupabase()
  const session = await currentSession()
  if (!session) return emptySnapshot()

  const [
    profiles, attendance, leaveRequests, payroll, payrollRuns, performance,
    performanceCycles, announcements, securityAlerts, alertResponses, sessions,
    auditLog, zapScanRuns, zapFindings, employeeRequests, requestComments,
    notifications, documents, documentAcknowledgements, schedules, benefits,
    goals, lifecycleCases, lifecycleTasks,
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

  const currentCode = currentBrowserSessionCode(session.user.id)
  return {
    employees: queryRows(profiles, 'profiles').map(employeeFromRow),
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
  let code = window.localStorage.getItem(key)
  if (!code) {
    code = `SES-${window.crypto.randomUUID().replaceAll('-', '').toUpperCase()}`
    window.localStorage.setItem(key, code)
  }
  return code
}

export function clearCurrentBrowserSessionCode(authUserId: string): void {
  window.localStorage.removeItem(sessionKey(authUserId))
}
