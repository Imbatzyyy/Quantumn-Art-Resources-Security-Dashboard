import { createClient } from '@supabase/supabase-js'

const json = (body, status = 200) =>
  globalThis.Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  })

const clean = (value) => (typeof value === 'string' ? value.trim() : '')
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const credentialsEmail = ({ employee, employeeCode, loginUrl }) => {
  const name = employee.preferredName || employee.firstName
  const safeName = escapeHtml(name)
  const safeCode = escapeHtml(employeeCode)
  const safeEmail = escapeHtml(employee.email)
  const safePassword = escapeHtml(employee.password)
  const safeLoginUrl = escapeHtml(loginUrl)

  return {
    subject: 'Your Quantum HRMS employee account is ready',
    text: [
      `Hello ${name},`,
      '',
      'Your Quantum HRMS employee account has been created.',
      `Employee ID: ${employeeCode}`,
      `Work email: ${employee.email}`,
      `Temporary password: ${employee.password}`,
      `Employee portal: ${loginUrl}`,
      '',
      'You must replace this temporary password when you sign in for the first time.',
      'Choose a unique passphrase of at least 15 characters. Do not reuse this temporary password or a password from another account.',
      '',
      'Keep these credentials private. Quantum HRMS will never ask you to send your password by email or chat.',
    ].join('\n'),
    html: `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Inter,Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;padding:32px 14px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #dfe6ef;border-radius:22px;overflow:hidden"><tr><td style="padding:30px;background:linear-gradient(135deg,#082842,#12607a);color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#80e0d4">Quantum HRMS</div><h1 style="margin:10px 0 6px;font-size:27px;line-height:1.2">Welcome to your employee portal</h1><p style="margin:0;color:#c7d8e6;line-height:1.6">Your private HR workspace is ready.</p></td></tr><tr><td style="padding:30px"><p style="margin:0 0 18px;line-height:1.7">Hello <strong>${safeName}</strong>,</p><p style="margin:0 0 22px;line-height:1.7;color:#536176">Use the temporary credentials below for your first sign-in. You will be required to create a private password before entering the workspace.</p><div style="padding:20px;border:1px solid #dce5f0;border-radius:16px;background:#f7f9fc"><div style="margin-bottom:13px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#7b8798">Employee ID</div><div style="margin-top:4px;font-weight:800">${safeCode}</div></div><div style="margin-bottom:13px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#7b8798">Work email</div><div style="margin-top:4px;font-weight:800">${safeEmail}</div></div><div><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#7b8798">Temporary password</div><div style="margin-top:7px;padding:11px 13px;border-radius:10px;background:#101d2c;color:#fff;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:15px;letter-spacing:.04em">${safePassword}</div></div></div><p style="margin:24px 0"><a href="${safeLoginUrl}" style="display:inline-block;padding:13px 19px;border-radius:11px;background:#2267d8;color:#fff;text-decoration:none;font-weight:800">Open employee portal</a></p><div style="padding:16px 18px;border-left:4px solid #19a58d;border-radius:10px;background:#edf9f6;color:#28544e;line-height:1.6"><strong>Required on first sign-in</strong><br>Create a unique passphrase with at least 15 characters. Do not reuse this temporary password or a password from another account.</div><p style="margin:22px 0 0;color:#6e7c90;font-size:13px;line-height:1.65">Keep these credentials private. Quantum HRMS will never ask you to send your password by email or chat.</p></td></tr></table></td></tr></table></body></html>`,
  }
}

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  const environmentValue = (key) =>
    globalThis.Netlify?.env?.get(key) || globalThis.process?.env?.[key]
  const supabaseUrl = environmentValue('SUPABASE_URL') || environmentValue('VITE_SUPABASE_URL')
  const secretKey = environmentValue('SUPABASE_SECRET_KEY') || environmentValue('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = environmentValue('RESEND_API_KEY')
  const resendFrom = environmentValue('RESEND_FROM_EMAIL') || 'Quantum HRMS <access@quantumnhr.com>'
  const appUrl = (environmentValue('APP_URL') || 'https://quantumnhr.com').replace(/\/$/, '')
  if (!supabaseUrl || !secretKey) {
    return json({ error: 'Employee account provisioning is not configured on Netlify.' }, 503)
  }
  if (!resendApiKey) {
    return json({ error: 'Employee credential email delivery is not configured on Netlify.' }, 503)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return json({ error: 'Administrator authentication is required.' }, 401)

  let input
  try {
    input = await request.json()
  } catch {
    return json({ error: 'The request body must be valid JSON.' }, 400)
  }

  const employee = {
    firstName: clean(input.firstName),
    middleName: clean(input.middleName),
    lastName: clean(input.lastName),
    preferredName: clean(input.preferredName),
    email: clean(input.email).toLowerCase(),
    department: clean(input.department),
    position: clean(input.position),
    phone: clean(input.phone),
    password: typeof input.temporaryPassword === 'string' ? input.temporaryPassword : '',
    salary: Number(input.salary),
    hireDate: clean(input.hireDate),
    employmentType: clean(input.employmentType),
    workArrangement: clean(input.workArrangement),
    workLocation: clean(input.workLocation),
    costCenter: clean(input.costCenter),
    managerId: clean(input.managerId),
    emergencyContactName: clean(input.emergencyContactName),
    emergencyContactRelationship: clean(input.emergencyContactRelationship),
    emergencyContactPhone: clean(input.emergencyContactPhone),
  }

  const validEmploymentTypes = ['Full-time', 'Part-time', 'Contract', 'Intern']
  const validWorkArrangements = ['On-site', 'Hybrid', 'Remote']
  const validPhone = (value) => /^\+?[0-9 ()-]{7,30}$/.test(value)

  if (
    !employee.firstName ||
    !employee.lastName ||
    !employee.department ||
    !employee.position ||
    !employee.phone ||
    !employee.workLocation ||
    !/^\S+@\S+\.\S+$/.test(employee.email) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(employee.hireDate) ||
    !validEmploymentTypes.includes(employee.employmentType) ||
    !validWorkArrangements.includes(employee.workArrangement) ||
    !validPhone(employee.phone) ||
    !Number.isFinite(employee.salary) ||
    employee.salary <= 0
  ) {
    return json({ error: 'Complete every employee field with valid information.' }, 400)
  }

  if (
    employee.firstName.length > 80 ||
    employee.middleName.length > 80 ||
    employee.lastName.length > 80 ||
    employee.preferredName.length > 80 ||
    employee.department.length > 100 ||
    employee.position.length > 120 ||
    employee.workLocation.length > 120 ||
    employee.costCenter.length > 60 ||
    employee.emergencyContactName.length > 120 ||
    employee.emergencyContactRelationship.length > 60 ||
    (employee.emergencyContactPhone && !validPhone(employee.emergencyContactPhone))
  ) {
    return json({ error: 'One or more employee fields exceed the allowed format or length.' }, 400)
  }

  if (
    employee.password.length < 12 ||
    !/[a-z]/.test(employee.password) ||
    !/[A-Z]/.test(employee.password) ||
    !/\d/.test(employee.password) ||
    !/[^A-Za-z0-9]/.test(employee.password)
  ) {
    return json({ error: 'The temporary password must be at least 12 characters and include uppercase, lowercase, number, and symbol.' }, 400)
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken)
  if (callerError || !callerData.user) {
    return json({ error: 'Your administrator session has expired. Sign in again.' }, 401)
  }

  const { data: caller, error: profileError } = await admin
    .from('profiles')
    .select('employee_code, first_name, last_name, role, status')
    .eq('auth_user_id', callerData.user.id)
    .single()

  if (
    profileError ||
    !caller ||
    !['admin', 'hr_admin'].includes(caller.role) ||
    caller.status !== 'Active'
  ) {
    return json({ error: 'Only an active HR administrator can create employee accounts.' }, 403)
  }

  const { data: duplicate } = await admin
    .from('profiles')
    .select('employee_code')
    .ilike('email', employee.email)
    .maybeSingle()

  if (duplicate) return json({ error: 'An employee already uses this email address.' }, 409)

  if (employee.managerId) {
    const { data: manager, error: managerError } = await admin
      .from('profiles')
      .select('employee_code')
      .eq('employee_code', employee.managerId)
      .in('role', ['admin', 'hr_admin'])
      .in('status', ['Active', 'On Leave'])
      .maybeSingle()

    if (managerError || !manager) {
      return json({ error: 'Select an active administrator as the reporting manager.' }, 400)
    }
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: employee.email,
    password: employee.password,
    email_confirm: true,
    user_metadata: {
      first_name: employee.firstName,
      last_name: employee.lastName,
    },
    app_metadata: {
      role: 'employee',
      must_change_password: true,
      credentials_issued_at: new Date().toISOString(),
    },
  })

  if (authError || !authData.user) {
    const message = authError?.message?.toLowerCase().includes('already')
      ? 'A login account already uses this email address.'
      : 'The employee login account could not be created.'
    return json({ error: message }, authError?.status || 400)
  }

  const { data: profile, error: insertError } = await admin
    .from('profiles')
    .insert({
      auth_user_id: authData.user.id,
      first_name: employee.firstName,
      middle_name: employee.middleName || null,
      last_name: employee.lastName,
      preferred_name: employee.preferredName || null,
      email: employee.email,
      role: 'employee',
      department: employee.department,
      position: employee.position,
      status: 'Active',
      salary: employee.salary,
      phone: employee.phone,
      hire_date: employee.hireDate,
      employment_type: employee.employmentType,
      work_arrangement: employee.workArrangement,
      work_location: employee.workLocation,
      cost_center: employee.costCenter || null,
      manager_code: employee.managerId || null,
      emergency_contact_name: employee.emergencyContactName || null,
      emergency_contact_relationship: employee.emergencyContactRelationship || null,
      emergency_contact_phone: employee.emergencyContactPhone || null,
    })
    .select('employee_code')
    .single()

  if (insertError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return json({ error: 'The employee record could not be created. No login account was kept.' }, 400)
  }

  const email = credentialsEmail({
    employee,
    employeeCode: profile.employee_code,
    loginUrl: `${appUrl}/employee/login`,
  })
  let emailResponse
  try {
    emailResponse = await globalThis.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [employee.email],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    })
  } catch {
    emailResponse = null
  }

  if (!emailResponse?.ok) {
    await admin.from('profiles').delete().eq('employee_code', profile.employee_code)
    await admin.auth.admin.deleteUser(authData.user.id)
    return json({ error: 'The credentials email could not be delivered, so no employee account was kept. Verify the Resend sender and try again.' }, 502)
  }

  await admin.from('audit_logs').insert({
    actor_employee_code: caller.employee_code,
    actor_label: `${caller.first_name} ${caller.last_name}`,
    action: 'Created employee login and sent temporary credentials',
    target: `${profile.employee_code} · ${employee.email}`,
    display_time: 'Just now',
  })

  return json({ employeeCode: profile.employee_code, credentialsEmailSent: true }, 201)
}

export const config = {
  path: '/api/admin-create-employee',
}
