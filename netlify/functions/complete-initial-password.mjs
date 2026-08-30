import { createClient } from '@supabase/supabase-js'
import { validatePermanentPassword } from '../../src/utils/passwordPolicy.js'

const json = (body, status = 200) =>
  globalThis.Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  })

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const environmentValue = (key) =>
    globalThis.Netlify?.env?.get(key) || globalThis.process?.env?.[key]
  const supabaseUrl = environmentValue('SUPABASE_URL') || environmentValue('VITE_SUPABASE_URL')
  const secretKey = environmentValue('SUPABASE_SECRET_KEY') || environmentValue('SUPABASE_SERVICE_ROLE_KEY')
  const publishableKey = environmentValue('SUPABASE_PUBLISHABLE_KEY') || environmentValue('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (!supabaseUrl || !secretKey || !publishableKey) {
    return json({ error: 'Initial password setup is not configured on Netlify.' }, 503)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return json({ error: 'Employee authentication is required.' }, 401)

  let input
  try {
    input = await request.json()
  } catch {
    return json({ error: 'The request body must be valid JSON.' }, 400)
  }
  const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : ''
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : ''

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken)
  if (callerError || !callerData.user?.email) {
    return json({ error: 'Your employee session has expired. Sign in again.' }, 401)
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('employee_code, first_name, last_name, email, role, status')
    .eq('auth_user_id', callerData.user.id)
    .single()
  if (
    profileError ||
    !profile ||
    profile.role !== 'employee' ||
    !['Active', 'On Leave'].includes(profile.status)
  ) {
    return json({ error: 'Only an active employee account can complete this setup.' }, 403)
  }
  if (callerData.user.app_metadata?.must_change_password !== true) {
    return json({ error: 'This account has already completed its initial password setup.' }, 409)
  }

  const passwordError = validatePermanentPassword(newPassword, {
    currentPassword,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
  })
  if (passwordError) return json({ error: passwordError }, 400)
  if (!currentPassword) return json({ error: 'Enter the temporary password from your credentials email.' }, 400)

  const verifier = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: callerData.user.email,
    password: currentPassword,
  })
  if (verifyError) return json({ error: 'The temporary password is incorrect.' }, 400)
  await verifier.auth.signOut()

  const changedAt = new Date().toISOString()
  const { error: updateError } = await admin.auth.admin.updateUserById(callerData.user.id, {
    password: newPassword,
    app_metadata: {
      ...callerData.user.app_metadata,
      must_change_password: false,
      password_changed_at: changedAt,
    },
  })
  if (updateError) {
    return json({ error: 'The new password could not be saved. Please try again.' }, 400)
  }

  await admin.from('audit_logs').insert({
    actor_employee_code: profile.employee_code,
    actor_label: `${profile.first_name} ${profile.last_name}`,
    action: 'Completed required first-login password setup',
    target: 'Own HRMS account',
    display_time: 'Just now',
  })

  return json({ passwordChanged: true, changedAt })
}

export const config = {
  path: '/api/complete-initial-password',
}
