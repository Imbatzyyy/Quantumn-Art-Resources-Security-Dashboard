import { requireSupabase } from './supabaseClient.js'
import { validatePermanentPassword } from '../utils/passwordPolicy.js'
import {
  currentBrowserSessionCode,
  currentSession,
  fetchSnapshot,
} from './supabaseReads.js'
import { securityOperation } from './supabaseSecurityApi.js'
import {
  authenticate,
  beginMfaEnrollment,
  disableMfa,
  getCurrentUser,
  getMfaStatus,
  getOrganizationSecuritySummary,
  recordCurrentSession,
  signOut,
  verifyMfaEnrollment,
  verifyMfaLogin,
} from './supabaseAuth.js'
import type { HrmsDataProvider } from '../types/hrms.js'
import type { Database, TablesUpdate } from '../types/database.js'
import { databaseId } from './supabaseIdentifiers.js'

type PublicTable = keyof Database['public']['Tables']

const realtimeTables = [
  'profiles', 'attendance', 'leave_requests', 'payroll', 'payroll_runs',
  'performance_reviews', 'performance_cycles', 'announcements',
  'security_alerts', 'security_alert_responses', 'account_sessions', 'audit_logs',
  'zap_scan_runs', 'zap_findings', 'employee_requests',
  'request_comments', 'notifications', 'employee_documents',
  'document_acknowledgements', 'work_schedules', 'employee_benefits',
  'employee_goals', 'lifecycle_cases', 'lifecycle_tasks',
] as const satisfies readonly PublicTable[]

const requireCurrentUser = async () => {
  const profile = await getCurrentUser()
  if (!profile) throw new Error('Your session has expired. Sign in again.')
  return profile
}

export const supabaseProvider: HrmsDataProvider = {
  getSnapshot: fetchSnapshot,

  subscribeToChanges(onChange) {
    const client = requireSupabase()
    let debounceTimer: number | undefined
    let channel = client.channel(`hrms-live-${Date.now()}`)
    const queueRefresh = () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(onChange, 250)
    }

    realtimeTables.forEach((table) => {
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

  getCurrentUser,
  authenticate,
  signOut,
  verifyMfaLogin,
  recordCurrentSession,
  getMfaStatus,
  getOrganizationSecuritySummary,
  beginMfaEnrollment,
  verifyMfaEnrollment,
  disableMfa,

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
    await signOut()
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
    if (!session.user.email) throw new Error('The invited account has no sign-in email.')
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
    const profile = await requireCurrentUser()

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
      const newPhone = changes.phone?.trim()
      if (!newPhone) throw new Error('Enter a valid phone number before saving.')
      const { error } = await client.rpc('update_own_profile', {
        new_phone: newPhone,
      })
      if (error) throw error
    } else {
      const update: TablesUpdate<'profiles'> = {}
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
      request_id: databaseId(id, 'Leave request'),
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
      requested_date: input.requestedDate || undefined,
      requested_value: input.requestedValue || undefined,
      requested_priority: input.priority || 'Normal',
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async reviewRequest(id, status, reason) {
    const { error } = await requireSupabase().rpc('review_employee_request', {
      selected_request_id: databaseId(id, 'Employee request'),
      decision: status,
      decision_reason: reason || '',
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async addRequestComment(id, body, internal = false) {
    const { error } = await requireSupabase().rpc('add_request_comment', {
      selected_request_id: databaseId(id, 'Employee request'),
      comment_body: body,
      internal_note: internal,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async cancelRequest(id) {
    const { error } = await requireSupabase().rpc('cancel_employee_request', {
      selected_request_id: databaseId(id, 'Employee request'),
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async markNotificationRead(id) {
    const { error } = await requireSupabase().rpc('mark_notification_read', {
      selected_notification_id: databaseId(id, 'Notification'),
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
      selected_document_id: databaseId(id, 'Document'),
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async updateGoalProgress(id, progress) {
    const { error } = await requireSupabase().rpc('update_goal_progress', {
      selected_goal_id: databaseId(id, 'Employee goal'),
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
    const profile = await requireCurrentUser()
    const session = await currentSession()
    if (!session) throw new Error('Your session has expired. Sign in again.')
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
    const profile = await requireCurrentUser()
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
    const profile = await requireCurrentUser()
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
    const profile = await requireCurrentUser()
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
      ? requireSupabase().from('employee_goals').update(payload).eq('id', databaseId(input.id, 'Employee goal'))
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
      selected_task_id: databaseId(id, 'Lifecycle task'),
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
    const rating = input.rating?.trim()
    if (!rating) throw new Error('A calculated performance rating is required.')
    const { error } = await requireSupabase().rpc('save_performance_review', {
      target_employee: input.employeeId,
      review_period: input.period.trim(),
      review_score: Number(input.score),
      review_goal_progress: Number(input.goalProgress),
      review_quality: Number(input.quality),
      review_productivity: Number(input.productivity),
      review_teamwork: Number(input.teamwork),
      review_rating: rating,
      review_comments: input.comments || '',
      review_cycle_id: input.cycleId ? databaseId(input.cycleId, 'Performance cycle') : undefined,
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async publishPerformance(id) {
    const { error } = await requireSupabase().rpc('publish_performance_review', {
      selected_review_id: databaseId(id, 'Performance review'),
    })
    if (error) throw error
    return fetchSnapshot()
  },

  async createPerformanceCycle(input) {
    const profile = await requireCurrentUser()
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
