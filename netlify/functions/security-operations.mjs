import { createClient } from '@supabase/supabase-js'

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const json = (body, statusCode = 200) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
})

const clean = (value, maxLength = 240) => String(value ?? '').trim().slice(0, maxLength)
const validSessionCode = (value) => /^SES-[A-Z0-9-]{12,80}$/.test(value)
const displayTime = () => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date())

const requireEnvironment = (name) => {
  const value = globalThis.process?.env?.[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const authorization = event.headers.authorization || event.headers.Authorization || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return json({ error: 'Authentication is required.' }, 401)

  let input
  try {
    input = JSON.parse(event.body || '{}')
  } catch {
    return json({ error: 'The request body is invalid.' }, 400)
  }

  const admin = createClient(
    requireEnvironment('SUPABASE_URL'),
    requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )

  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken)
  if (callerError || !callerData.user) return json({ error: 'Your session has expired. Sign in again.' }, 401)

  const { data: caller, error: profileError } = await admin
    .from('profiles')
    .select('employee_code, first_name, last_name, role, status')
    .eq('auth_user_id', callerData.user.id)
    .single()

  if (profileError || !caller || !['Active', 'On Leave'].includes(caller.status)) {
    return json({ error: 'An active HRMS account is required.' }, 403)
  }

  const action = clean(input.action, 50)
  const actorLabel = `${caller.first_name} ${caller.last_name}`.trim()

  if (action === 'record-session') {
    const sessionCode = clean(input.sessionCode, 84).toUpperCase()
    if (!validSessionCode(sessionCode)) return json({ error: 'The session identifier is invalid.' }, 400)

    const { data: existingSession } = await admin.from('account_sessions')
      .select('session_code, created_at')
      .eq('session_code', sessionCode)
      .maybeSingle()
    const assuranceLevel = clean(input.assuranceLevel, 8) === 'aal2' ? 'aal2' : 'aal1'
    const recordedAt = new Date().toISOString()
    const device = clean(input.device, 160) || 'Web browser'
    const location = clean(input.location, 120) || 'Location unavailable'
    const { error } = await admin.from('account_sessions').upsert({
      session_code: sessionCode,
      employee_code: caller.employee_code,
      device,
      location,
      last_active_label: 'Active now',
      is_current: false,
      assurance_level: assuranceLevel,
      trust_status: 'Recognized',
      last_seen_at: recordedAt,
      created_at: existingSession?.created_at || recordedAt,
    }, { onConflict: 'session_code' })
    if (error) return json({ error: 'Session activity could not be recorded.' }, 400)

    if (!existingSession) {
      const alertCode = `ALT-${Date.now().toString(36).toUpperCase()}-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`
      const nowLabel = displayTime()
      await admin.from('security_alerts').insert({
        alert_code: alertCode,
        employee_code: caller.employee_code,
        severity: 'Low',
        event_type: 'New device',
        title: 'New browser session recorded',
        description: `A new ${device} session was recorded from ${location}.`,
        affected_label: `${actorLabel} · ${caller.employee_code}`,
        display_time: nowLabel,
        status: 'New',
        recommended_action: 'Confirm whether you recognize this browser. If not, report it and end other sessions immediately.',
        why_it_matters: 'A browser you do not recognize can indicate that another person accessed your account.',
        confidence: 'High',
      })
      await admin.from('audit_logs').insert({
        actor_employee_code: caller.employee_code,
        actor_label: actorLabel,
        action: 'Recorded new browser session',
        target: `${sessionCode} · ${device}`,
        display_time: nowLabel,
      })
    }
    return json({ recorded: true, sessionCode })
  }

  if (!['admin', 'security_admin'].includes(caller.role)) {
    if (!(caller.role === 'auditor' && action === 'organization-summary') && !['revoke-other-sessions', 'end-current-session'].includes(action)) {
      return json({ error: 'Security administrator access is required.' }, 403)
    }
  }

  if (action === 'organization-summary') {
    const { data: profiles, error: profilesError } = await admin.from('profiles')
      .select('auth_user_id, role, status')
      .in('status', ['Active', 'On Leave'])
    if (profilesError) return json({ error: 'The security coverage summary could not be loaded.' }, 400)
    const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) return json({ error: 'Authentication coverage could not be loaded.' }, 400)
    const users = new Map(usersPage.users.map((item) => [item.id, item]))
    const coverage = profiles.map((profile) => {
      const authUser = users.get(profile.auth_user_id)
      const factors = Array.isArray(authUser?.factors) ? authUser.factors : []
      return { role: profile.role, mfaEnabled: factors.some((factor) => factor.status === 'verified') }
    })
    const privileged = coverage.filter((item) => item.role !== 'employee')
    return json({
      totalAccounts: coverage.length,
      mfaEnabled: coverage.filter((item) => item.mfaEnabled).length,
      mfaPending: coverage.filter((item) => !item.mfaEnabled).length,
      privilegedAccounts: privileged.length,
      privilegedMfaEnabled: privileged.filter((item) => item.mfaEnabled).length,
    })
  }

  if (action === 'create-alert') {
    const severity = clean(input.severity, 20)
    const eventType = clean(input.eventType, 80)
    const title = clean(input.title, 140)
    const description = clean(input.description, 1200)
    const recommendedAction = clean(input.recommendedAction, 800)
    const employeeCode = clean(input.employeeCode, 40)

    if (!['Critical', 'High', 'Medium', 'Low'].includes(severity)) {
      return json({ error: 'Select a valid alert severity.' }, 400)
    }
    if (!eventType || title.length < 4 || description.length < 10 || recommendedAction.length < 10 || !employeeCode) {
      return json({ error: 'Complete the employee, event, description, and recommended-action fields.' }, 400)
    }

    const { data: affected, error: affectedError } = await admin
      .from('profiles')
      .select('employee_code, first_name, last_name, email')
      .eq('employee_code', employeeCode)
      .maybeSingle()
    if (affectedError || !affected) return json({ error: 'Select a valid employee account.' }, 400)

    const random = globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
    const alertCode = `ALT-${Date.now().toString(36).toUpperCase()}-${random}`
    const affectedLabel = `${affected.first_name} ${affected.last_name} · ${affected.employee_code}`
    const nowLabel = displayTime()

    const { error: insertError } = await admin.from('security_alerts').insert({
      alert_code: alertCode,
      employee_code: affected.employee_code,
      severity,
      event_type: eventType,
      title,
      description,
      affected_label: affectedLabel,
      display_time: nowLabel,
      status: 'New',
      recommended_action: recommendedAction,
      why_it_matters: clean(input.whyItMatters, 800) || 'Unexpected activity can indicate unauthorized access to an account or sensitive HR information.',
      confidence: ['High', 'Medium', 'Low'].includes(clean(input.confidence, 20)) ? clean(input.confidence, 20) : 'Medium',
    })
    if (insertError) return json({ error: 'The security alert could not be created.' }, 400)

    await admin.from('audit_logs').insert({
      actor_employee_code: caller.employee_code,
      actor_label: actorLabel,
      action: 'Created security alert',
      target: `${alertCode} · ${affected.employee_code}`,
      display_time: nowLabel,
    })
    return json({ alertCode }, 201)
  }

  if (action === 'update-alert') {
    const alertCode = clean(input.alertCode, 100)
    const nextStatus = clean(input.status, 30)
    const allowedStatuses = ['Investigating', 'Acknowledged', 'Confirmed', 'Contained', 'Resolved', 'False Positive']
    if (!alertCode || !allowedStatuses.includes(nextStatus)) return json({ error: 'Select a valid investigation status.' }, 400)
    const note = clean(input.note, 1200)
    const resolutionReason = clean(input.resolutionReason, 160)
    const completed = ['Resolved', 'False Positive'].includes(nextStatus)
    const { data: alert, error: alertError } = await admin.from('security_alerts')
      .update({
        status: nextStatus,
        assigned_to: caller.employee_code,
        resolution_reason: completed ? (resolutionReason || nextStatus) : null,
        resolution_notes: note || null,
        acknowledged_at: ['Acknowledged', 'Investigating', 'Confirmed', 'Contained'].includes(nextStatus) ? new Date().toISOString() : undefined,
        resolved_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('alert_code', alertCode)
      .select('employee_code')
      .maybeSingle()
    if (alertError || !alert) return json({ error: 'The security alert could not be updated.' }, 400)
    await admin.from('security_alert_responses').insert({
      alert_code: alertCode,
      actor_employee_code: caller.employee_code,
      response_action: nextStatus === 'False Positive' ? 'False positive' : nextStatus === 'Resolved' ? 'Resolved' : nextStatus === 'Contained' ? 'Contained' : 'Investigation started',
      note: note || null,
    })
    await admin.from('audit_logs').insert({
      actor_employee_code: caller.employee_code,
      actor_label: actorLabel,
      action: `Security alert ${nextStatus.toLowerCase()}`,
      target: `${alertCode} · ${alert.employee_code}`,
      display_time: displayTime(),
    })
    return json({ updated: true, alertCode, status: nextStatus })
  }

  if (['revoke-session', 'revoke-other-sessions', 'end-current-session'].includes(action)) {
    const currentSessionCode = clean(input.currentSessionCode, 84).toUpperCase()
    if (!validSessionCode(currentSessionCode)) return json({ error: 'The current session could not be verified.' }, 400)

    let query = admin.from('account_sessions').delete()
    let target = 'Other account sessions'

    if (action === 'revoke-other-sessions') {
      query = query.eq('employee_code', caller.employee_code).neq('session_code', currentSessionCode)
    } else if (action === 'end-current-session') {
      query = query.eq('employee_code', caller.employee_code).eq('session_code', currentSessionCode)
      target = `${caller.employee_code} · Current browser session`
    } else {
      const sessionCode = clean(input.sessionCode, 84).toUpperCase()
      if (!validSessionCode(sessionCode) || sessionCode === currentSessionCode) {
        return json({ error: 'The current browser session cannot be revoked here.' }, 400)
      }
      const { data: targetSession, error: sessionError } = await admin
        .from('account_sessions')
        .select('session_code, employee_code, device')
        .eq('session_code', sessionCode)
        .maybeSingle()
      if (sessionError || !targetSession) return json({ error: 'The session record no longer exists.' }, 404)
      target = `${targetSession.employee_code} · ${targetSession.device}`
      query = query.eq('session_code', sessionCode)
    }

    const { error: deleteError } = await query
    if (deleteError) return json({ error: 'The session record could not be revoked.' }, 400)

    await admin.from('audit_logs').insert({
      actor_employee_code: caller.employee_code,
      actor_label: actorLabel,
      action: action === 'revoke-session' ? 'Revoked session record' : action === 'end-current-session' ? 'Signed out current session' : 'Signed out other sessions',
      target,
      display_time: displayTime(),
    })
    return json({ revoked: true })
  }

  return json({ error: 'Unsupported security operation.' }, 400)
}
