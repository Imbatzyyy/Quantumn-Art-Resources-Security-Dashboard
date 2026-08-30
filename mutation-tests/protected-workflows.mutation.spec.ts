import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Mutation QA requires ${name}.`)
  return value
}

const baseURL = required('E2E_BASE_URL')
const supabaseUrl = required('SUPABASE_URL')
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY')
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
const captureToken = required('LOCAL_QA_CAPTURE_TOKEN')
const adminEmail = required('E2E_ADMIN_EMAIL')
const adminPassword = required('E2E_ADMIN_PASSWORD')
const employeeEmail = required('E2E_EMPLOYEE_EMAIL')
const employeePassword = required('E2E_EMPLOYEE_PASSWORD')
const newEmployeeEmail = required('E2E_NEW_EMPLOYEE_EMAIL')
const newAdminEmail = required('E2E_NEW_ADMIN_EMAIL')
const temporaryPassword = required('E2E_TEMP_PASSWORD')
const permanentPassword = required('E2E_PERMANENT_PASSWORD')
const adminInvitePassword = required('E2E_ADMIN_INVITE_PASSWORD')

interface EmailCapture {
  to: string[]
  subject: string
  text: string
  html: string
}

let service: SupabaseClient
let adminClient: SupabaseClient
let employeeClient: SupabaseClient
let adminAccessToken = ''
let employeeAccessToken = ''

const signInPortal = async (page: Page, portal: 'admin' | 'employee', email: string, password: string) => {
  await page.goto(`/${portal}/login`)
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', {
    name: portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal',
  }).click()
  await expect(page).toHaveURL(new RegExp(`/${portal}/?$`), { timeout: 20_000 })
}

const invoke = async (path: string, accessToken: string, body: unknown) => globalThis.fetch(`${baseURL}${path}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const capturedEmails = async () => {
  const response = await globalThis.fetch(`${baseURL}/api/local-email-captures`, {
    headers: { authorization: `Bearer ${captureToken}` },
  })
  expect(response.status).toBe(200)
  return (await response.json() as { emails: EmailCapture[] }).emails
}

test.describe.serial('isolated protected mutation workflows', () => {
  test.beforeAll(async () => {
    service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    adminClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    employeeClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const adminSession = await adminClient.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
    const employeeSession = await employeeClient.auth.signInWithPassword({ email: employeeEmail, password: employeePassword })
    if (adminSession.error || !adminSession.data.session) throw adminSession.error || new Error('Admin QA sign-in failed.')
    if (employeeSession.error || !employeeSession.data.session) throw employeeSession.error || new Error('Employee QA sign-in failed.')
    adminAccessToken = adminSession.data.session.access_token
    employeeAccessToken = employeeSession.data.session.access_token

    const unauthorizedCapture = await globalThis.fetch(`${baseURL}/api/local-email-captures`)
    expect(unauthorizedCapture.status).toBe(403)
  })

  test('provisions an employee, captures credentials, and enforces first-login password replacement', async ({ page }) => {
    const employee = {
      firstName: 'Avery', middleName: 'Local', lastName: 'Mutation', preferredName: 'Avery',
      email: newEmployeeEmail, phone: '+63 917 555 0188', department: 'Technology',
      position: 'QA Security Analyst', employmentType: 'Full-time', workArrangement: 'Hybrid',
      workLocation: 'Local QA Lab', costCenter: 'QA-LOCAL', managerId: 'EMP002', salary: 48000,
      hireDate: '2026-08-30', emergencyContactName: 'Taylor Mutation',
      emergencyContactRelationship: 'Sibling', emergencyContactPhone: '+63 917 555 0199',
      temporaryPassword,
    }

    const denied = await invoke('/api/admin-create-employee', employeeAccessToken, employee)
    expect(denied.status).toBe(403)

    const created = await invoke('/api/admin-create-employee', adminAccessToken, employee)
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ credentialsEmailSent: true })

    const emails = await capturedEmails()
    const credentials = emails.find((email) => email.to.includes(newEmployeeEmail))
    expect(credentials?.subject).toContain('employee account is ready')
    expect(credentials?.text).toContain(`Work email: ${newEmployeeEmail}`)
    expect(credentials?.text).toContain(`Temporary password: ${temporaryPassword}`)

    const { data: profile, error: profileError } = await service.from('profiles')
      .select('employee_code, role, auth_user_id, department, position')
      .eq('email', newEmployeeEmail)
      .single()
    expect(profileError).toBeNull()
    expect(profile).toMatchObject({ role: 'employee', department: 'Technology', position: 'QA Security Analyst' })

    await signInPortal(page, 'employee', newEmployeeEmail, temporaryPassword)
    const setup = page.getByRole('dialog', { name: 'Secure your employee account' })
    await expect(setup).toBeVisible()
    await setup.getByLabel('Temporary password').fill(temporaryPassword)
    await setup.getByLabel('New private password').fill(permanentPassword)
    await setup.getByLabel('Confirm new password').fill(permanentPassword)
    await setup.getByRole('button', { name: 'Save password & enter workspace' }).click()
    await expect(setup).toBeHidden({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /Good day,/ })).toBeVisible()

    const { data: authUser, error: authError } = await service.auth.admin.getUserById(profile!.auth_user_id!)
    expect(authError).toBeNull()
    expect(authUser.user?.app_metadata.must_change_password).toBe(false)
  })

  test('invites a least-privilege administrator and completes the personal setup link', async ({ page }) => {
    const invited = await invoke('/api/admin-invite-account', adminAccessToken, {
      firstName: 'Sierra', lastName: 'Reviewer', email: newAdminEmail,
      phone: '+63 917 555 0200', role: 'security_admin', confirmed: true,
    })
    expect(invited.status).toBe(201)
    expect(await invited.json()).toMatchObject({ role: 'security_admin', invitationEmailSent: true })

    const emails = await capturedEmails()
    const invitation = emails.find((email) => email.to.includes(newAdminEmail))
    expect(invitation?.subject).toContain('invited to administer')
    const setupLink = invitation?.text.match(/https?:\/\/\S+/)?.[0]
    expect(setupLink).toBeTruthy()

    await page.goto(setupLink!)
    await expect(page.getByRole('heading', { name: 'Create your private password' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Security Administrator', { exact: true })).toBeVisible()
    await page.getByLabel('New private password').fill(adminInvitePassword)
    await page.getByLabel('Confirm password').fill(adminInvitePassword)
    await page.getByRole('button', { name: 'Create password & activate account' }).click()
    await expect(page.getByRole('heading', { name: 'Your administrator account is ready' })).toBeVisible({ timeout: 20_000 })

    const { data: profile, error: profileError } = await service.from('profiles')
      .select('auth_user_id, role, status')
      .eq('email', newAdminEmail)
      .single()
    expect(profileError).toBeNull()
    expect(profile).toMatchObject({ role: 'security_admin', status: 'Active' })
    const { data: authUser } = await service.auth.admin.getUserById(profile!.auth_user_id!)
    expect(authUser.user?.app_metadata.must_set_password).toBe(false)
  })

  test('synchronizes an employee request and an HR decision in real time', async ({ page }) => {
    await signInPortal(page, 'employee', employeeEmail, employeePassword)
    await page.getByRole('navigation', { name: 'Portal navigation' })
      .getByRole('button', { name: 'Request Center', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Request Center' })).toBeVisible()

    const subject = `Realtime QA request ${Date.now().toString(36)}`
    const { data: requestId, error: submitError } = await employeeClient.rpc('submit_employee_request', {
      requested_type: 'General HR', requested_subject: subject,
      requested_description: 'Fictional local-only request used to verify synchronized HR decisions.',
      requested_date: '2026-08-30', requested_value: 'Local QA evidence', requested_priority: 'Normal',
    })
    expect(submitError).toBeNull()

    const requestRow = page.getByText(subject).locator('xpath=ancestor::tr')
    await expect(requestRow).toBeVisible({ timeout: 20_000 })
    await expect(requestRow.getByText('Submitted', { exact: true })).toBeVisible()

    const { error: reviewError } = await adminClient.rpc('review_employee_request', {
      selected_request_id: requestId!, decision: 'Approved',
      decision_reason: 'Approved in isolated mutation QA.',
    })
    expect(reviewError).toBeNull()
    await expect(requestRow.getByText('Approved', { exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test('crops and stores an employee-owned profile picture behind Storage RLS', async ({ page }) => {
    await signInPortal(page, 'employee', employeeEmail, employeePassword)
    await page.getByRole('navigation', { name: 'Portal navigation' })
      .getByRole('button', { name: 'My Profile' }).click()
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()

    await page.getByLabel('Choose profile picture').setInputFiles('assets/images/default-avatar.png')
    const editor = page.getByRole('dialog', { name: 'Crop your profile picture' })
    await expect(editor).toBeVisible()
    await editor.getByLabel('Photo zoom').fill('1.25')
    await editor.getByLabel('Horizontal photo position').fill('12')
    await editor.getByRole('button', { name: 'Save profile picture' }).click()

    await expect(editor).toBeHidden({ timeout: 20_000 })
    await expect(page.getByText('Profile photo updated securely.')).toBeVisible()
    const portrait = page.getByRole('button', { name: 'Change profile picture' }).locator('img')
    await expect(portrait).toBeVisible()
    await expect(portrait).toHaveAttribute('src', /profile-avatars\/.*token=/)

    const { data: profile, error: profileError } = await service.from('profiles')
      .select('auth_user_id, avatar_path').eq('email', employeeEmail).single()
    expect(profileError).toBeNull()
    expect(profile?.avatar_path).toBe(`${profile?.auth_user_id}/avatar.webp`)

    const ownPhoto = await employeeClient.storage.from('profile-avatars').download(profile!.avatar_path!)
    expect(ownPhoto.error).toBeNull()
    expect(ownPhoto.data?.type).toBe('image/webp')

    const crossAccountRead = await adminClient.storage.from('profile-avatars').download(profile!.avatar_path!)
    expect(crossAccountRead.error).not.toBeNull()
  })

  test('creates and investigates a scoped alert, then imports authorized local ZAP evidence', async ({ page }) => {
    await signInPortal(page, 'employee', employeeEmail, employeePassword)
    await page.getByRole('navigation', { name: 'Portal navigation' })
      .getByRole('button', { name: /Account Security/ }).click()
    await expect(page.getByRole('heading', { name: 'Account Security' })).toBeVisible()

    const alertTitle = `Local QA unfamiliar sign-in ${Date.now().toString(36)}`
    const created = await invoke('/api/security-operations', adminAccessToken, {
      action: 'create-alert', employeeCode: 'EMP001', severity: 'High', confidence: 'High',
      eventType: 'Unusual access', title: alertTitle,
      description: 'A fictional unfamiliar browser was observed during isolated security QA.',
      whyItMatters: 'An unrecognized session could expose private HR information.',
      recommendedAction: 'Review the session and report it if the browser is not recognized.',
    })
    expect(created.status).toBe(201)
    const { alertCode } = await created.json() as { alertCode: string }
    await expect(page.getByText(alertTitle, { exact: true })).toBeVisible({ timeout: 20_000 })

    const investigated = await invoke('/api/security-operations', adminAccessToken, {
      action: 'update-alert', alertCode, status: 'Resolved',
      note: 'Validated as controlled fictional QA evidence.',
      resolutionReason: 'Authorized local mutation test completed.',
    })
    expect(investigated.status).toBe(200)

    const zapReport = {
      '@version': '2.17.0',
      site: [{
        '@name': 'http://host.docker.internal:4175',
        alerts: [{
          pluginid: '10021', alert: 'Local QA response-header review', riskcode: '1', confidence: '2',
          desc: 'Fictional low-risk evidence generated for the isolated classroom workflow.',
          solution: 'Review the local response header configuration.',
          instances: [{ uri: 'http://host.docker.internal:4175/admin/login', evidence: 'local-only' }],
        }],
      }],
    }
    const deniedImport = await invoke('/api/import-zap-report', employeeAccessToken, {
      report: JSON.stringify(zapReport), targetUrl: 'http://host.docker.internal:4175',
      environment: 'Local Test', scanType: 'Baseline', reportName: 'local-denied.json',
    })
    expect(deniedImport.status).toBe(403)

    const imported = await invoke('/api/import-zap-report', adminAccessToken, {
      report: JSON.stringify(zapReport), targetUrl: 'http://host.docker.internal:4175',
      environment: 'Local Test', scanType: 'Baseline', reportName: 'local-authorized.json',
      authorizedScope: 'Isolated local Quantum HRMS interface using fictional records only.',
    })
    expect(imported.status).toBe(201)
    const result = await imported.json() as { scanCode: string; findings: number; status: string }
    expect(result).toMatchObject({ findings: 1, status: 'Passed' })

    const { data: alert } = await service.from('security_alerts')
      .select('status, resolution_reason, resolution_notes').eq('alert_code', alertCode).single()
    expect(alert).toMatchObject({
      status: 'Resolved', resolution_reason: 'Authorized local mutation test completed.',
      resolution_notes: 'Validated as controlled fictional QA evidence.',
    })
    const { data: scan } = await service.from('zap_scan_runs')
      .select('environment, target_url, low_count, report_sha256').eq('scan_code', result.scanCode).single()
    expect(scan?.environment).toBe('Local Test')
    expect(scan?.target_url).toBe('http://host.docker.internal:4175')
    expect(scan?.low_count).toBe(1)
    expect(scan?.report_sha256).toMatch(/^[a-f0-9]{64}$/)
  })
})
