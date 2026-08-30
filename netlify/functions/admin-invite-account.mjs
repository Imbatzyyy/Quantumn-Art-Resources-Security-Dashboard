import { createClient } from '@supabase/supabase-js'

const json = (body, status = 200) => globalThis.Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
})

const environmentValue = (key) =>
  globalThis.Netlify?.env?.get(key) || globalThis.process?.env?.[key]

const clean = (value, maxLength = 180) => String(value ?? '').trim().slice(0, maxLength)
const escapeHtml = (value) => clean(value, 2000)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const roles = {
  admin: { label: 'System Administrator', department: 'Administration' },
  hr_admin: { label: 'HR Administrator', department: 'Human Resources' },
  payroll_admin: { label: 'Payroll Administrator', department: 'Finance' },
  security_admin: { label: 'Security Administrator', department: 'Information Security' },
  auditor: { label: 'Compliance Auditor', department: 'Governance' },
}

const invitationEmail = ({ firstName, roleLabel, setupLink, appUrl }) => ({
  subject: 'You have been invited to administer Quantum HRMS',
  html: `<!doctype html><html><body style="margin:0;background:#eef3f7;font-family:Inter,Arial,sans-serif;color:#10253a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 14px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #dce6ee;border-radius:22px;overflow:hidden;box-shadow:0 22px 60px rgba(10,39,64,.12)"><tr><td style="padding:30px 34px;background:linear-gradient(120deg,#082a46,#126c72);color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#83ead9">Quantum HRMS · Privileged Access</div><h1 style="margin:12px 0 8px;font-size:28px;line-height:1.2">Your administrator invitation</h1><p style="margin:0;color:rgba(255,255,255,.74);line-height:1.6">A System Administrator has provisioned a role-scoped account for you.</p></td></tr><tr><td style="padding:30px 34px"><p style="margin:0 0 16px;font-size:16px">Hello <strong>${escapeHtml(firstName)}</strong>,</p><p style="margin:0 0 22px;color:#536779;line-height:1.65">You were invited as <strong>${escapeHtml(roleLabel)}</strong>. Use the secure button below to verify the invitation and create your private password. This link is personal and time-limited.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f4f8fb;border:1px solid #dce7ee;border-radius:14px"><tr><td style="padding:18px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#748696;font-weight:800">Assigned access role</div><div style="margin-top:6px;font-size:17px;font-weight:800">${escapeHtml(roleLabel)}</div></td></tr></table><table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px"><tr><td style="border-radius:12px;background:#176b73"><a href="${escapeHtml(setupLink)}" style="display:inline-block;padding:15px 24px;color:#fff;text-decoration:none;font-weight:800">Accept invitation &amp; set password</a></td></tr></table><div style="padding:14px 16px;border-left:4px solid #dd9b34;background:#fff8ea;border-radius:8px;color:#69512c;font-size:13px;line-height:1.55"><strong>Keep this invitation private.</strong> Quantum HRMS will never ask you to forward this link or send your password by email or chat.</div><p style="margin:22px 0 0;color:#7d8d9a;font-size:12px;line-height:1.55">If you were not expecting this role, do not open the link. Contact your organization’s System Administrator. Portal: ${escapeHtml(appUrl)}/admin/login</p></td></tr></table></td></tr></table></body></html>`,
  text: `Hello ${firstName},\n\nYou were invited to Quantum HRMS as ${roleLabel}. Use this personal, time-limited link to verify the invitation and create your password:\n\n${setupLink}\n\nDo not forward this link. If you were not expecting this invitation, contact your System Administrator.`,
})

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = environmentValue('SUPABASE_URL') || environmentValue('VITE_SUPABASE_URL')
  const serviceKey = environmentValue('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = environmentValue('RESEND_API_KEY')
  const from = environmentValue('RESEND_FROM_EMAIL')
  const appUrl = (environmentValue('APP_URL') || 'https://quantumnhr.com').replace(/\/$/, '')
  if (!supabaseUrl || !serviceKey || !resendKey || !from) {
    return json({ error: 'Administrator invitations are not fully configured on Netlify.' }, 503)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return json({ error: 'System Administrator authentication is required.' }, 401)

  let input
  try { input = await request.json() } catch { return json({ error: 'The request body must be valid JSON.' }, 400) }

  const account = {
    firstName: clean(input.firstName, 80),
    lastName: clean(input.lastName, 80),
    email: clean(input.email, 254).toLowerCase(),
    phone: clean(input.phone, 30),
    role: clean(input.role, 40),
  }
  if (!account.firstName || !account.lastName || !/^\S+@\S+\.\S+$/.test(account.email) || !roles[account.role]) {
    return json({ error: 'Enter a valid name, work email, and supported administrator role.' }, 400)
  }
  if (account.phone && !/^[+0-9()\-\s]{7,30}$/.test(account.phone)) {
    return json({ error: 'Enter a valid mobile number or leave it blank.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken)
  if (callerError || !callerData.user) return json({ error: 'Your administrator session has expired.' }, 401)
  const { data: caller, error: callerProfileError } = await admin.from('profiles')
    .select('employee_code, first_name, last_name, role, status')
    .eq('auth_user_id', callerData.user.id)
    .single()
  if (callerProfileError || !caller || caller.role !== 'admin' || caller.status !== 'Active') {
    return json({ error: 'Only an active System Administrator can invite privileged accounts.' }, 403)
  }

  const { data: duplicateProfile } = await admin.from('profiles').select('employee_code').ilike('email', account.email).maybeSingle()
  if (duplicateProfile) return json({ error: 'An HRMS profile already uses this email address.' }, 409)

  const role = roles[account.role]
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: account.email,
    options: {
      redirectTo: `${appUrl}/admin/setup-password`,
      data: { first_name: account.firstName, last_name: account.lastName, invited_role: account.role },
    },
  })
  if (linkError || !linkData.user || !linkData.properties?.action_link) {
    const message = linkError?.message?.toLowerCase().includes('already')
      ? 'A Supabase login already uses this email address.'
      : 'The secure administrator invitation could not be generated.'
    return json({ error: message }, 400)
  }

  const authUserId = linkData.user.id
  const employeeCode = `ADM-${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`
  const rollback = async () => {
    await admin.from('profiles').delete().eq('auth_user_id', authUserId)
    await admin.auth.admin.deleteUser(authUserId)
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      ...linkData.user.app_metadata,
      role: account.role,
      must_set_password: true,
      invited_at: new Date().toISOString(),
      invited_by: caller.employee_code,
    },
  })
  if (metadataError) {
    await rollback()
    return json({ error: 'The invitation role could not be secured.' }, 400)
  }

  const { error: profileError } = await admin.from('profiles').insert({
    employee_code: employeeCode,
    auth_user_id: authUserId,
    first_name: account.firstName,
    last_name: account.lastName,
    email: account.email,
    role: account.role,
    department: role.department,
    position: role.label,
    status: 'Active',
    salary: 0,
    phone: account.phone || null,
    hire_date: new Date().toISOString().slice(0, 10),
  })
  if (profileError) {
    await rollback()
    return json({ error: 'The administrator profile could not be created.' }, 400)
  }

  const email = invitationEmail({
    firstName: account.firstName,
    roleLabel: role.label,
    setupLink: linkData.properties.action_link,
    appUrl,
  })
  const emailResponse = await globalThis.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [account.email], subject: email.subject, html: email.html, text: email.text }),
  })
  if (!emailResponse.ok) {
    await rollback()
    return json({ error: 'The invitation email could not be delivered, so the account was rolled back.' }, 502)
  }

  await admin.from('audit_logs').insert({
    actor_employee_code: caller.employee_code,
    actor_label: `${caller.first_name} ${caller.last_name}`,
    action: 'Invited administrator account',
    target: `${employeeCode} · ${role.label} · ${account.email}`,
    display_time: 'Just now',
  })

  return json({ employeeCode, role: account.role, invitationEmailSent: true }, 201)
}

export const config = { path: '/api/admin-invite-account' }
