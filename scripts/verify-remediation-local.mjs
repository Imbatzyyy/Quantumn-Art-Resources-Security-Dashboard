import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { createClient } from '@supabase/supabase-js'
import { loadLocalQaRuntime } from './local-qa-runtime.mjs'
import { seedLocalQaIdentities, localQaAccounts } from './local-qa-identities.mjs'
import { verifyLocalFixtureSession } from './local-email-verification.mjs'
import recoverMfa from '../netlify/functions/mfa-recovery.mjs'

const runtime = await loadLocalQaRuntime() // rejects every remote target
const { adminClient: service, passwords } = await seedLocalQaIdentities(runtime)
const ok = async promise => { const r = await promise; assert.equal(r.error, null, r.error?.message); return r.data }
const denied = async promise => assert.ok((await promise).error, 'Expected access to be denied')
const login = async (account, verify = true) => {
  const client = createClient(runtime.apiUrl, runtime.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { session } = await ok(client.auth.signInWithPassword({ email: account.email, password: passwords.get(account.email) }))
  if (verify) await verifyLocalFixtureSession(runtime, service, session)
  return client
}
const sql = query => execFileSync('docker', ['exec', '-i', 'supabase_db_quantum-hrms-local-qa', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sid = async client => {
  const { session } = await ok(client.auth.getSession())
  return JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url')).session_id
}
function totp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=''
  for(const c of secret.toUpperCase().replace(/=+$/,'')) bits+=alphabet.indexOf(c).toString(2).padStart(5,'0')
  const key=Buffer.from((bits.match(/.{8}/g)||[]).map(byte=>parseInt(byte,2)))
  const time=Buffer.alloc(8); time.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
  const digest=createHmac('sha1',key).update(time).digest(); const offset=digest[19]&15
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')
}
let count = 0
const verify = async (name, fn) => { await fn(); count++; globalThis.console.log(`PASS ${name}`) }
const admin = await login(localQaAccounts[0]), employee = await login(localQaAccounts[1])
const adminIdentity = await ok(admin.rpc('get_hrms_identity'))
const employeeIdentity = await ok(employee.rpc('get_hrms_identity'))
const tag = `Remediation QA ${randomUUID()}`
try {
  await verify('Unverified sessions cannot update profile, avatar, activity or export', async () => {
    const unverified = await login(localQaAccounts[1], false)
    await denied(unverified.rpc('update_own_profile', { new_phone: '+639123456789' }))
    await denied(unverified.rpc('update_own_avatar_path', { new_avatar_path: null }))
    await denied(unverified.rpc('record_user_activity', { activity_action: 'Fake action', activity_target: 'Fake target' }))
    await denied(unverified.rpc('prepare_hr_report', { report_id: 'workforce' }))
  })
  await verify('Phone input is validated inside the database', async () => {
    await denied(employee.rpc('update_own_profile', { new_phone: 'call me sometime' }))
    await denied(employee.rpc('update_own_profile', { new_phone: '123' }))
    await denied(employee.rpc('update_own_profile', { new_phone: null }))
  })
  await verify('Idle expiry cannot be renewed by background traffic or a refreshed JWT', async () => {
    const idle = await login(localQaAccounts[1]); await ok(idle.rpc('touch_hrms_session'))
    const id = await sid(idle)
    sql(`update private.hrms_session_activity set last_activity_at=now()-interval '31 minutes' where session_id='${id}';`)
    await denied(idle.rpc('assert_hrms_access')); await denied(idle.rpc('touch_hrms_session'))
    await idle.auth.refreshSession(); await denied(idle.rpc('assert_hrms_access'))
    assert.deepEqual(await ok(idle.from('profiles').select('employee_code')), [])
  })
  await verify('Absolute expiry wins even when recent activity is present', async () => {
    const old = await login(localQaAccounts[1]); await ok(old.rpc('touch_hrms_session'))
    sql(`update auth.sessions set created_at=now()-interval '13 hours' where id='${await sid(old)}';`)
    await denied(old.rpc('assert_hrms_access'))
  })
  await verify('Employees can revoke an individual own session but not another account', async () => {
    const other = await login(localQaAccounts[1])
    const code = await ok(other.rpc('record_hrms_session', { device_label: 'Other QA browser', location_label: 'QA' }))
    await ok(employee.rpc('revoke_hrms_sessions', { operation: 'revoke-session', target_code: code }))
    await denied(other.rpc('assert_hrms_access'))
    const adminCode = await ok(admin.rpc('record_hrms_session', { device_label: 'Admin QA browser', location_label: 'QA' }))
    await denied(employee.rpc('revoke_hrms_sessions', { operation: 'revoke-session', target_code: adminCode }))
  })
  await verify('Leave separates types and calendar years, reserves pending days, and releases cancellations', async () => {
    const input = { requested_type: 'Vacation', requested_start: '2198-12-31', requested_end: '2199-01-02', requested_reason: tag }
    const id = await ok(employee.rpc('submit_leave_request', input))
    const balance = async year => (await ok(employee.rpc('my_leave_balances', { balance_year: year }))).find(b => b.type === 'Vacation')
    assert.equal((await balance(2198)).pending, 1); assert.equal((await balance(2199)).pending, 2)
    await denied(employee.rpc('submit_leave_request', { ...input, requested_start: '2199-02-01', requested_end: '2199-02-13' }))
    await ok(employee.rpc('cancel_leave_request', { request_id: id })); assert.equal((await balance(2199)).pending, 0)
    await denied(admin.rpc('review_leave_request', { request_id: id, decision: null }))
    await denied(employee.rpc('submit_leave_request', { ...input, requested_reason: null }))
  })
  await verify('Report rows and immutable export evidence are prepared together; employee exports are rejected', async () => {
    const report = await ok(admin.rpc('prepare_hr_report', { report_id: 'workforce' }))
    assert.ok(Array.isArray(report.rows)); assert.ok(report.auditId)
    assert.ok(report.rows.every(r => r.role === 'employee' && r.salary === undefined && r.auth_user_id === undefined))
    const event = await ok(service.from('audit_logs').select('event_source,action').eq('id', report.auditId).single())
    assert.equal(event.event_source, 'export'); assert.equal(event.action, 'Prepared authorized report export')
    await denied(employee.rpc('prepare_hr_report', { report_id: 'audit' }))
    await denied(admin.rpc('prepare_hr_report', { report_id: null }))
    await denied(admin.rpc('prepare_hr_report', { report_id: 'unknown' }))
    for (const id of ['attendance','requests','payroll','audit']) await ok(admin.rpc('prepare_hr_report', { report_id: id }))
  })
  await verify('Concurrent leave submissions cannot spend the same remaining allowance', async () => {
    const results = await Promise.all(['2188-01-01', '2188-02-01'].map(start => employee.rpc('submit_leave_request', {
      requested_type: 'Vacation', requested_start: start, requested_end: `${start.slice(0, 8)}08`, requested_reason: tag,
    })))
    assert.equal(results.filter(result => !result.error).length, 1)
    assert.equal(results.filter(result => result.error).length, 1)
    const balance = (await ok(employee.rpc('my_leave_balances', { balance_year: 2188 }))).find(row => row.type === 'Vacation')
    assert.equal(balance.pending, 8)
  })
  await verify('Identical announcements retain independent notification ownership', async () => {
    const input = { title: tag, content: 'Two separate notices with identical text.', priority: 'Normal', published_on: '2026-10-14' }
    const first = await ok(admin.from('announcements').insert(input).select('id').single())
    const second = await ok(admin.from('announcements').insert(input).select('id').single())
    try {
      await ok(admin.from('announcements').update({ content: 'Only the first notice changed.' }).eq('id', first.id))
      assert.deepEqual(await ok(employee.from('notifications').select('message').eq('announcement_id', second.id)), [{ message: input.content }])
      await ok(admin.from('announcements').delete().eq('id', first.id))
      assert.equal((await ok(employee.from('notifications').select('id').eq('announcement_id', second.id))).length, 1)
      assert.equal((await ok(employee.from('notifications').select('id').eq('announcement_id', first.id))).length, 0)
    } finally { await service.from('announcements').delete().in('id', [first.id, second.id]) }
  })
  await verify('Private downloads reject drafts, wrong owners and expired documents, and audit released exports', async () => {
    const payroll = await ok(service.from('payroll').insert({ employee_code: employeeIdentity.employee_code, period: tag, gross: 1000, status: 'Draft' }).select('id').single())
    const document = await ok(service.from('employee_documents').insert({ employee_code: employeeIdentity.employee_code, title: tag, document_type: 'Policy', filename: 'qa.txt', content: 'Fictional protected text.' }).select('id').single())
    try {
      await denied(employee.rpc('prepare_own_payslip', { selected_payroll_id: payroll.id }))
      for (const status of ['Released', 'Paid', 'Locked']) {
        await ok(service.from('payroll').update({ status }).eq('id', payroll.id))
        assert.equal((await ok(employee.rpc('prepare_own_payslip', { selected_payroll_id: payroll.id }))).status, status)
      }
      await denied(admin.rpc('prepare_own_payslip', { selected_payroll_id: payroll.id }))
      assert.equal(await ok(employee.rpc('read_employee_document', { selected_document_id: document.id })), 'Fictional protected text.')
      await ok(service.from('employee_documents').update({ employee_code: adminIdentity.employee_code }).eq('id', document.id))
      await denied(employee.rpc('read_employee_document', { selected_document_id: document.id }))
      await ok(service.from('employee_documents').update({ employee_code: employeeIdentity.employee_code, expires_on: '2000-01-01' }).eq('id', document.id))
      await denied(employee.rpc('read_employee_document', { selected_document_id: document.id }))
      assert.equal((await ok(service.from('audit_logs').select('id').eq('event_source', 'export').eq('action', 'Prepared own payslip export').eq('target', tag))).length, 3)
    } finally {
      await service.from('payroll').delete().eq('id', payroll.id)
      await service.from('employee_documents').delete().eq('id', document.id)
    }
  })
  await verify('Auth evidence is personal; dashboard control counts come from the database', async () => {
    const history = await ok(employee.rpc('my_security_history'))
    assert.ok(history.some(e => e.event_source === 'auth' && e.action === 'login'))
    const overview = await ok(admin.rpc('security_overview', { window_days: 7 }))
    assert.equal(overview.authEvents.trend.length, 7)
    assert.equal(overview.controls.rlsTables, overview.controls.publicTables)
    assert.equal(overview.authEvents.failedPasswordAttemptsAvailable, false)
  })
  await verify('Privileged MFA fails closed, supports enrollment, and recovers without bypassing re-enrollment', async () => {
    await ok(service.rpc('set_privileged_mfa_required', { required: true }))
    await denied(admin.rpc('assert_hrms_access'))
    await denied(employee.rpc('set_privileged_mfa_required', { required: false }))
    const handoff = { selected_portal: 'admin', device_label: 'QA', location_label: 'QA' }
    const gate = await ok(admin.rpc('finish_hrms_signin', handoff)); assert.equal(gate.enrollmentRequired, true)
    const factor = await ok(admin.auth.mfa.enroll({ factorType: 'totp', friendlyName: tag }))
    await denied(admin.rpc('create_mfa_recovery_codes'))
    await ok(admin.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) }))
    await ok(admin.rpc('assert_hrms_access'))
    const codes = await ok(admin.rpc('create_mfa_recovery_codes')); assert.equal(new Set(codes).size, 8)
    const recovering = await login(localQaAccounts[0])
    const otherAdmin = await login(localQaAccounts[0])
    await denied(recovering.rpc('consume_mfa_recovery', { recovery_code: '0'.repeat(32) }))
    const savedEnv = { ...globalThis.process.env }
    Object.assign(globalThis.process.env, runtime.environment)
    try {
      const { session } = await ok(recovering.auth.getSession())
      const response = await recoverMfa(new globalThis.Request('http://localhost/api/mfa-recovery', { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ code: codes[0] }) }))
      assert.equal(response.status, 200, await response.text())
    } finally {
      for (const key of Object.keys(globalThis.process.env)) if (!(key in savedEnv)) delete globalThis.process.env[key]
      Object.assign(globalThis.process.env, savedEnv)
    }
    await denied(otherAdmin.rpc('assert_hrms_access')); await denied(recovering.rpc('assert_hrms_access'))
    await denied(recovering.rpc('consume_mfa_recovery', { recovery_code: codes[0] }))
    assert.equal((await ok(recovering.rpc('finish_hrms_signin', handoff))).enrollmentRequired, true)
    const replacement = await ok(recovering.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Recovered QA factor' }))
    await ok(recovering.auth.mfa.challengeAndVerify({ factorId: replacement.id, code: totp(replacement.totp.secret) }))
    await ok(recovering.rpc('create_mfa_recovery_codes'))
    assert.ok((await ok(recovering.rpc('finish_hrms_signin', handoff))).profile)
    await ok(recovering.auth.mfa.unenroll({ factorId: replacement.id }))
  })
} finally {
  await service.rpc('set_privileged_mfa_required', { required: false })
  const factors = await service.auth.admin.mfa.listFactors({ userId: adminIdentity.auth_user_id })
  for (const factor of factors.data?.factors || []) await service.auth.admin.mfa.deleteFactor({ userId: adminIdentity.auth_user_id, id: factor.id })
  await service.from('leave_requests').delete().eq('reason', tag)
  sql(`delete from private.mfa_recovery_codes where user_id='${adminIdentity.auth_user_id}'; delete from private.mfa_recovery_pending where user_id='${adminIdentity.auth_user_id}';`)
}
globalThis.console.log(`${count} remediation scenarios passed against local Supabase. No production accounts were changed.`)
