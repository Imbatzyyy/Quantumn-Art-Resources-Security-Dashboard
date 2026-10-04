import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import { capturedLocalCode, resetLocalEmailLimits, verifyLocalFixtureSession } from '../scripts/local-email-verification.mjs'
import { createHmac } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'

function totpCode(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret.toUpperCase().replace(/=+$/, '')].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('')
  const key = Buffer.from(bits.match(/.{8}/g)!.map(b => parseInt(b, 2)))
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const digest = createHmac('sha1', key).update(counter).digest()
  const offset = digest[digest.length - 1] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}

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
  resetLocalEmailLimits(supabaseUrl)
  await page.goto(`/${portal}/login`)
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', {
    name: portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal',
  }).click()
  await page.waitForURL(url => !url.pathname.endsWith('/login'))
  if (page.url().endsWith('/verify-email')) {
    await expect(page.getByLabel('Email verification code')).toBeEnabled()
    const code = await capturedLocalCode(baseURL, email, captureToken)
    expect(code).toMatch(/^\d{6}$/)
    await page.getByLabel('Email verification code').fill(code!)
    await page.getByRole('button', { name: 'Verify & continue' }).click()
  }
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
    for (const session of [adminSession.data.session, employeeSession.data.session]) {
      await verifyLocalFixtureSession({ apiUrl: supabaseUrl, serviceRoleKey }, service, session)
    }

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
    expect(credentials?.html).toContain('https://quantumnhr.com/email-assets/quantumn-art-resources-blue.png')
    expect(credentials?.text).toContain(`Work email: ${newEmployeeEmail}`)
    expect(credentials?.text).toContain(`Temporary password: ${temporaryPassword}`)

    const { data: profile, error: profileError } = await service.from('profiles')
      .select('employee_code, role, auth_user_id, department, position')
      .eq('email', newEmployeeEmail)
      .single()
    expect(profileError).toBeNull()
    expect(profile).toMatchObject({ role: 'employee', department: 'Technology', position: 'QA Security Analyst' })

    const pendingClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const pending = await pendingClient.auth.signInWithPassword({ email: newEmployeeEmail, password: temporaryPassword })
    for (const acknowledgment of [undefined, { termsAccepted: true, privacyAcknowledged: true, termsVersion: 'old', privacyVersion: 'old' }]) {
      const rejected = await invoke('/api/complete-initial-password', pending.data.session!.access_token, { currentPassword: temporaryPassword, newPassword: permanentPassword, acknowledgment })
      expect(rejected.status).toBe(400)
      expect((await rejected.json()).error).toContain('Terms and Conditions')
    }
    await pendingClient.auth.signOut({ scope: 'local' })

    await signInPortal(page, 'employee', newEmployeeEmail, temporaryPassword)
    const setup = page.getByRole('dialog', { name: 'Secure your employee account' })
    await expect(setup).toBeVisible()
    await expect(setup.getByLabel('New password', { exact: true })).toHaveCount(0)
    await setup.getByLabel('I have read and agree to the Terms and Conditions.').check()
    await setup.getByLabel('I have read and acknowledge the Privacy Notice.').check()
    await setup.getByRole('button', { name: 'Continue to password' }).click()
    await setup.getByLabel('Temporary password').fill(temporaryPassword)
    await setup.getByLabel('New password', { exact: true }).fill(permanentPassword)
    await setup.getByLabel('Confirm new password').fill(permanentPassword)
    await setup.getByRole('button', { name: 'Save password & enter workspace' }).click()
    await expect(setup).toBeHidden({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /Good day,/ })).toBeVisible()

    const { data: authUser, error: authError } = await service.auth.admin.getUserById(profile!.auth_user_id!)
    expect(authError).toBeNull()
    expect(authUser.user?.app_metadata.must_change_password).toBe(false)
    expect(authUser.user?.app_metadata.setup_acknowledgment).toMatchObject({ terms_version: '2026-09-30.2', privacy_version: '2026-09-30.2', terms_accepted: true, privacy_acknowledged: true })
    expect(Date.parse(authUser.user?.app_metadata.setup_acknowledgment.acknowledged_at)).toBeGreaterThan(0)
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
    expect(invitation?.html).toContain('https://quantumnhr.com/email-assets/quantumn-art-resources-blue.png')
    const setupLink = invitation?.text.match(/https?:\/\/\S+/)?.[0]
    expect(setupLink).toBeTruthy()

    await page.goto(setupLink!)
    await expect(page.getByRole('heading', { name: 'Create your private password' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Security Administrator', { exact: true })).toBeVisible()
    await page.getByLabel('New password', { exact: true }).fill(adminInvitePassword)
    await page.getByLabel('Confirm new password').fill(adminInvitePassword)
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

  test('System Admin sends a branded reset, recipient must verify MFA, and link is single-use', async ({ page }) => {
    test.setTimeout(60_000)
    const { data: target } = await service.from('profiles').select('employee_code,auth_user_id').eq('email', newAdminEmail).single()
    const targetClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const targetLogin = await targetClient.auth.signInWithPassword({ email: newAdminEmail, password: adminInvitePassword })
    await verifyLocalFixtureSession({ apiUrl: supabaseUrl, serviceRoleKey }, service, targetLogin.data.session)
    const { data: factor, error: enrollError } = await targetClient.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Reset QA authenticator' })
    expect(enrollError).toBeNull()
    expect((await targetClient.auth.mfa.challengeAndVerify({ factorId: factor!.id, code: totpCode(factor!.totp.secret) })).error).toBeNull()
    const targetSession = (await targetClient.auth.getSession()).data.session!
    const forbidden = await invoke('/api/admin-reset-password', targetSession.access_token, { action: 'send', employeeCode: target!.employee_code, confirmed: true })
    expect(forbidden.status).toBe(403)
    await signInPortal(page, 'admin', adminEmail, adminPassword)
    await page.getByRole('navigation', { name: 'Portal navigation' }).getByRole('button', { name: 'Admin Accounts & Roles', exact: true }).click()
    await page.getByRole('button', { name: 'Reset password for Sierra Reviewer' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reset administrator password' })
    await expect(dialog.getByRole('button', { name: 'Send reset email' })).toBeDisabled()
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'Send reset email' }).click()
    await expect(page.getByRole('heading', { name: 'Check the administrator’s inbox' })).toBeVisible()
    const emails = await capturedEmails()
    const reset = emails.findLast(email => email.to.includes(newAdminEmail) && email.subject.includes('Reset your administrator'))!
    expect(reset.html).toContain('https://quantumnhr.com/email-assets/quantumn-art-resources-blue.png')
    expect(reset.text).toContain('30 minutes')
    const resetLink = reset.text.match(/https?:\/\/\S+\/admin\/reset-password#reset_token=[A-Za-z0-9_-]+/)![0]
    const cooldown = await invoke('/api/admin-reset-password', adminAccessToken, { action: 'send', employeeCode: target!.employee_code, confirmed: true })
    expect(cooldown.status).toBe(429)
    await page.setViewportSize({ width: 320, height: 850 })
    await page.goto(resetLink)
    await expect(page.getByRole('button', { name: 'Continue securely' })).toBeEnabled()
    expect(new URL(page.url()).hash).toBe('')
    await page.getByRole('button', { name: 'Continue securely' }).click()
    await expect(page.getByLabel('Authenticator code')).toBeVisible()
    const state = await page.evaluate(() => ({ grant: JSON.parse(sessionStorage.getItem('quantum-admin-password-reset')!), session: JSON.parse(Object.entries(sessionStorage).find(([key]) => /^sb-.*-auth-token$/.test(key))![1]) }))
    const denied = await invoke('/api/admin-reset-password', state.session.access_token, { action: 'complete', requestId: state.grant.requestId, newPassword: 'Protected local reset passphrase 2026!' })
    expect(denied.status).toBe(403)
    await page.reload()
    await expect(page.getByLabel('Authenticator code')).toBeVisible()
    for (const theme of ['light', 'dark']) {
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(mode => { document.documentElement.dataset.theme = mode; localStorage.setItem('quantum-hrms-theme', mode) }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
        await page.screenshot({ path: `test-results/admin-password-reset-${theme}-${width}.png`, fullPage: true })
      }
    }
    await page.getByLabel('Authenticator code').fill(totpCode(factor!.totp.secret))
    await page.getByLabel('New password', { exact: true }).fill('Protected local reset passphrase 2026!')
    await page.getByLabel('Confirm new password').fill('Protected local reset passphrase 2026!')
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(page.getByRole('heading', { name: 'Your password is updated' })).toBeVisible({ timeout: 20_000 })
    const replay = await invoke('/api/admin-reset-password', '', { action: 'exchange', resetToken: new URLSearchParams(new URL(resetLink).hash.slice(1)).get('reset_token') })
    expect(replay.status).toBe(400)
    expect((await targetClient.rpc('assert_hrms_access')).error).not.toBeNull()
    const { data: after } = await service.auth.admin.getUserById(target!.auth_user_id)
    expect(after.user?.app_metadata.role).toBe('security_admin')
    await service.auth.admin.mfa.deleteFactor({ userId: target!.auth_user_id, id: factor!.id })
    await targetClient.auth.signOut({ scope: 'local' })
    const relogin = await targetClient.auth.signInWithPassword({ email: newAdminEmail, password: 'Protected local reset passphrase 2026!' })
    expect(relogin.error).toBeNull()
    await targetClient.auth.signOut({ scope: 'local' })
  })

  test('synchronizes an employee request and an HR decision in real time', async ({ page }) => {
    await signInPortal(page, 'employee', employeeEmail, employeePassword)
    await page.getByRole('navigation', { name: 'Portal navigation' })
      .getByRole('button', { name: 'Request Center', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Request Center' })).toBeVisible()

    const subject = `Realtime QA request ${Date.now().toString(36)}`
    const { data: requestId, error: submitError } = await employeeClient.rpc('submit_employee_request', {
      request_key: crypto.randomUUID(),
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

  test('confirms and persists an employee-authorized profile edit', async ({ page }) => {
    const { data: before, error: beforeError } = await service.from('profiles')
      .select('phone, department, position').eq('email', employeeEmail).single()
    expect(beforeError).toBeNull()
    const nextPhone = before?.phone === '+63 917 555 0177' ? '+63 917 555 0178' : '+63 917 555 0177'

    await signInPortal(page, 'employee', employeeEmail, employeePassword)
    await page.getByRole('navigation', { name: 'Portal navigation' })
      .getByRole('button', { name: 'My Profile' }).click()
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()
    await expect(page.getByLabel('Phone number')).toBeDisabled()
    await expect(page.locator('dl > div').filter({ has: page.getByText('Department', { exact: true }) }).locator('dd')).toHaveText(before!.department)
    await expect(page.locator('dl > div').filter({ has: page.getByText('Position', { exact: true }) }).locator('dd')).toHaveText(before!.position)
    await expect(page.getByLabel('Department')).toHaveCount(0)
    await expect(page.getByLabel('Position')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit profile' }).click()
    await page.getByLabel('Phone number').fill(nextPhone)
    await page.getByRole('button', { name: 'Save changes' }).click()
    const confirmation = page.getByRole('dialog', { name: 'Confirm profile changes' })
    await expect(confirmation).toBeVisible()
    await expect(confirmation.getByText(nextPhone)).toBeVisible()

    const { data: notSavedYet } = await service.from('profiles').select('phone').eq('email', employeeEmail).single()
    expect(notSavedYet?.phone).toBe(before?.phone)
    await confirmation.getByRole('button', { name: 'Confirm & save' }).click()

    await expect(confirmation).toBeHidden({ timeout: 20_000 })
    await expect(page.getByText('Employee profile updated.')).toBeVisible()
    await expect(page.getByLabel('Phone number')).toBeDisabled()
    await expect.poll(async () => {
      const { data } = await service.from('profiles').select('phone').eq('email', employeeEmail).single()
      return data?.phone
    }).toBe(nextPhone)

    const { data: after } = await service.from('profiles')
      .select('department, position').eq('email', employeeEmail).single()
    expect(after).toMatchObject({ department: before?.department, position: before?.position })
  })

  for (const outputType of ['image/webp', 'image/png']) {
  test(`crops, positions, and privately stores ${outputType} profile pictures`, async ({ page }) => {
    if (outputType === 'image/png') {
      // Reproduce browsers that return PNG for a requested WebP canvas encoding.
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.toBlob
        HTMLCanvasElement.prototype.toBlob = function (callback, _type, quality) {
          return original.call(this, callback, 'image/png', quality)
        }
      })
    }
    await signInPortal(page, 'employee', employeeEmail, employeePassword)
    await page.getByRole('navigation', { name: 'Portal navigation' })
      .getByRole('button', { name: 'My Profile' }).click()
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()

    await page.getByLabel('Choose profile picture').setInputFiles('assets/images/default-avatar.png')
    const editor = page.getByRole('dialog', { name: 'Crop your profile picture' })
    await expect(editor).toBeVisible()
    await editor.getByLabel('Photo zoom').fill('1.25')
    await editor.getByLabel('Horizontal photo position').fill('12')
    const frame = editor.getByRole('group', { name: 'Reposition profile photo' })
    const bounds = (await frame.boundingBox())!
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width / 2 + 15, bounds.y + bounds.height / 2 + 10, { steps: 5 })
    await page.mouse.up()
    await expect(editor.getByLabel('Horizontal photo position')).not.toHaveValue('12')
    const chosenPng = await editor.getByLabel('Profile photo crop preview').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL('image/png').split(',')[1])
    await editor.getByRole('button', { name: 'Save profile picture' }).click()

    await expect(editor).toBeHidden({ timeout: 20_000 })
    await expect(page.getByText('Profile photo updated securely.')).toBeVisible()
    const portrait = page.getByRole('button', { name: 'Update photo', exact: true }).locator('img')
    await expect(portrait).toBeVisible()
    await expect(portrait).toHaveAttribute('src', /profile-avatars\/.*token=/)
    await expect.poll(() => portrait.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(512)

    const { data: profile, error: profileError } = await service.from('profiles')
      .select('auth_user_id, avatar_path').eq('email', employeeEmail).single()
    expect(profileError).toBeNull()
    expect(profile?.avatar_path).toBe(`${profile?.auth_user_id}/avatar.${outputType === 'image/png' ? 'png' : 'webp'}`)

    const ownPhoto = await employeeClient.storage.from('profile-avatars').download(profile!.avatar_path!)
    expect(ownPhoto.error).toBeNull()
    expect(ownPhoto.data?.type).toBe(outputType)
    if (outputType === 'image/png') {
      expect(Buffer.from(await ownPhoto.data!.arrayBuffer()).toString('base64')).toBe(chosenPng)
    }

    const crossAccountRead = await adminClient.storage.from('profile-avatars').download(profile!.avatar_path!)
    // Employee Directory/360 explicitly allows authorized HR to read the current
    // photo, but never to overwrite it. Peer-employee denial is covered in pgTAP.
    expect(crossAccountRead.error).toBeNull()
    expect(crossAccountRead.data?.size).toBeGreaterThan(0)
    const invalidRegistration = await employeeClient.rpc('update_own_avatar_path', { new_avatar_path: 'someone-else/avatar.png' })
    expect(invalidRegistration.error).not.toBeNull()
    const crossAccountWrite = await adminClient.storage.from('profile-avatars').upload(profile!.avatar_path!, ownPhoto.data!, { upsert: true, contentType: outputType })
    expect(crossAccountWrite.error).not.toBeNull()
  })
  }

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
      '@generated': new Date().toISOString(),
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
    expect(result).toMatchObject({ findings: 1, status: 'Review Needed' })

    const { data: alert } = await service.from('security_alerts')
      .select('status, resolution_reason, resolution_notes').eq('alert_code', alertCode).single()
    expect(alert).toMatchObject({
      status: 'Resolved', resolution_reason: 'Authorized local mutation test completed.',
      resolution_notes: 'Validated as controlled fictional QA evidence.',
    })
    const { data: scan } = await service.from('zap_scan_runs')
      .select('environment, target_url, low_count, report_sha256').eq('scan_code', result.scanCode).single()
    expect(scan?.environment).toBe('Local Test')
    expect(new URL(scan!.target_url).origin).toBe('http://host.docker.internal:4175')
    expect(scan?.low_count).toBe(1)
    expect(scan?.report_sha256).toMatch(/^[a-f0-9]{64}$/)
  })
})
