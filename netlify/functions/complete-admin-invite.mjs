import { createClient } from '@supabase/supabase-js'
import { validatePermanentPassword } from '../../src/utils/passwordPolicy.js'

const json = (body, status = 200) => globalThis.Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
})

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const env = (key) => globalThis.Netlify?.env?.get(key) || globalThis.process?.env?.[key]
  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Administrator setup is unavailable.' }, 503)

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return json({ error: 'Open the personal invitation link from your email.' }, 401)

  let input
  try { input = await request.json() } catch { return json({ error: 'The request body must be valid JSON.' }, 400) }
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : ''

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken)
  if (callerError || !callerData.user) return json({ error: 'This invitation link is invalid or has expired.' }, 401)

  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('employee_code, first_name, last_name, email, role, status')
    .eq('auth_user_id', callerData.user.id)
    .single()
  const allowedRoles = ['admin', 'hr_admin', 'payroll_admin', 'security_admin', 'auditor']
  if (profileError || !profile || !allowedRoles.includes(profile.role) || profile.status !== 'Active') {
    return json({ error: 'This invitation is not connected to an active administrator profile.' }, 403)
  }
  if (callerData.user.app_metadata?.must_set_password !== true) {
    return json({ error: 'This administrator invitation has already been completed.' }, 409)
  }

  const passwordError = validatePermanentPassword(newPassword, {
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
  })
  if (passwordError) return json({ error: passwordError }, 400)

  const changedAt = new Date().toISOString()
  const { error: updateError } = await admin.auth.admin.updateUserById(callerData.user.id, {
    password: newPassword,
    app_metadata: {
      ...callerData.user.app_metadata,
      role: profile.role,
      must_set_password: false,
      invitation_accepted_at: changedAt,
      password_changed_at: changedAt,
    },
  })
  if (updateError) return json({ error: 'Your private password could not be saved.' }, 400)

  await admin.from('audit_logs').insert({
    actor_employee_code: profile.employee_code,
    actor_label: `${profile.first_name} ${profile.last_name}`,
    action: 'Accepted administrator invitation and set password',
    target: `${profile.employee_code} · ${profile.role}`,
    display_time: 'Just now',
  })
  return json({ passwordCreated: true, role: profile.role, changedAt })
}

export const config = { path: '/api/complete-admin-invite' }
