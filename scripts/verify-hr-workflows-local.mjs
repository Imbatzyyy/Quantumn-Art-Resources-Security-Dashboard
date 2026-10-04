import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { loadLocalQaRuntime } from './local-qa-runtime.mjs'
import { seedLocalQaIdentities, localQaAccounts } from './local-qa-identities.mjs'
import { verifyLocalFixtureSession } from './local-email-verification.mjs'

// Exercises the 2026-10 HR workflow additions through the same supabase-js
// calls the browser makes. Local stack only; no secrets are printed or saved.
const runtime = await loadLocalQaRuntime()
const { adminClient: service, passwords } = await seedLocalQaIdentities(runtime)
const newClient = () => createClient(runtime.apiUrl, runtime.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
const login = async (account, password = passwords.get(account.email)) => {
  const client = newClient()
  const result = await client.auth.signInWithPassword({ email: account.email, password })
  assert.equal(result.error, null, result.error?.message)
  await verifyLocalFixtureSession(runtime, service, result.data.session)
  return client
}
const ok = async (promise) => { const r = await promise; assert.equal(r.error, null, r.error?.message); return r.data }
const denied = async (promise) => assert.ok((await promise).error, 'Expected the operation to be rejected')
const passed = []
const verify = async (name, run) => { await run(); passed.push(name); globalThis.console.log(`PASS ${name}`) }
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

const admin = await login(localQaAccounts[0])
const employee = await login(localQaAccounts[1])
const identity = await ok(employee.rpc('get_hrms_identity'))
const adminIdentity = await ok(admin.rpc('get_hrms_identity'))
const tag = `QA ${Date.now()}`

await verify('HR rejects leave with a reason the employee can read', async () => {
  const id = await ok(employee.rpc('submit_leave_request', { requested_type: 'Vacation', requested_start: day(60), requested_end: day(61), requested_reason: `${tag} reject` }))
  await ok(admin.rpc('review_leave_request', { request_id: id, decision: 'Rejected', decision_note: 'Coverage is too thin that week.' }))
  const row = await ok(employee.from('leave_requests').select('status,decision_note').eq('id', id).single())
  assert.deepEqual(row, { status: 'Rejected', decision_note: 'Coverage is too thin that week.' })
  const inbox = await ok(employee.from('notifications').select('message').ilike('message', '%Coverage is too thin%'))
  assert.ok(inbox.length >= 1)
})

await verify('Employees cancel their own pending or future approved leave', async () => {
  const pending = await ok(employee.rpc('submit_leave_request', { requested_type: 'Sick', requested_start: day(70), requested_end: day(70), requested_reason: `${tag} cancel pending` }))
  await denied(admin.rpc('cancel_leave_request', { request_id: pending }))
  await ok(employee.rpc('cancel_leave_request', { request_id: pending }))
  const approved = await ok(employee.rpc('submit_leave_request', { requested_type: 'Vacation', requested_start: day(80), requested_end: day(80), requested_reason: `${tag} cancel approved` }))
  await ok(admin.rpc('review_leave_request', { request_id: approved, decision: 'Approved' }))
  await ok(employee.rpc('cancel_leave_request', { request_id: approved }))
  const rows = await ok(employee.from('leave_requests').select('status').in('id', [pending, approved]))
  assert.deepEqual(rows.map((row) => row.status), ['Cancelled', 'Cancelled'])
  await denied(employee.from('leave_requests').update({ status: 'Approved' }).eq('id', approved))
})

await verify('Leave allowances are readable by employees and editable only by HR', async () => {
  const before = await ok(employee.from('leave_policies').select('leave_type,annual_days').order('leave_type'))
  assert.equal(before.length, 4)
  await denied(employee.rpc('save_leave_policy', { selected_type: 'Vacation', allowance: 99 }))
  const original = before.find((row) => row.leave_type === 'Emergency').annual_days
  await ok(admin.rpc('save_leave_policy', { selected_type: 'Emergency', allowance: 5 }))
  assert.equal(Number((await ok(employee.from('leave_policies').select('annual_days').eq('leave_type', 'Emergency').single())).annual_days), 5)
  await ok(admin.rpc('save_leave_policy', { selected_type: 'Emergency', allowance: original }))
})

await verify('Statutory payroll itemizes SSS, PhilHealth, Pag-IBIG and withholding tax', async () => {
  const period = `${tag} statutory`
  const salary = Number((await ok(service.from('profiles').select('salary').eq('employee_code', identity.employee_code).single())).salary)
  await ok(service.from('profiles').update({ salary: 35000 }).eq('employee_code', identity.employee_code))
  try {
    await ok(admin.rpc('generate_payroll', { payroll_period: period, deduction_rate: 0, calculation_method: 'Philippine statutory' }))
    const row = await ok(service.from('payroll').select('sss_contribution,philhealth_contribution,pagibig_contribution,withholding_tax,deductions,net').eq('period', period).eq('employee_code', identity.employee_code).single())
    assert.deepEqual(Object.values(row).map(Number), [1750, 875, 200, 1701.3, 4526.3, 30473.7])
    assert.equal((await ok(service.from('payroll_runs').select('calculation_method').eq('period', period).single())).calculation_method, 'Philippine statutory')
  } finally {
    await ok(service.from('profiles').update({ salary }).eq('employee_code', identity.employee_code))
    const run = await ok(service.from('payroll_runs').select('id').eq('period', period).maybeSingle())
    if (run) { await ok(service.from('payroll').delete().eq('payroll_run_id', run.id)); await ok(service.from('payroll_runs').delete().eq('id', run.id)) }
  }
})

await verify('Document files upload privately and download only for their audience', async () => {
  const path = `${randomUUID()}/qa-contract.pdf`
  const pdf = new globalThis.Blob(['%PDF-1.4\n% Fictional QA file\n'], { type: 'application/pdf' })
  await denied(employee.storage.from('hr-documents').upload(`${randomUUID()}/self.pdf`, pdf, { contentType: 'application/pdf' }))
  await denied(admin.storage.from('hr-documents').upload(`${randomUUID()}/tool.exe`, new globalThis.Blob(['MZ'], { type: 'application/x-msdownload' }), { contentType: 'application/x-msdownload' }))
  await ok(admin.storage.from('hr-documents').upload(path, pdf, { contentType: 'application/pdf', upsert: false }))
  const doc = await ok(admin.from('employee_documents').insert({ employee_code: identity.employee_code, title: `${tag} contract`, document_type: 'Contract', filename: 'qa-contract.pdf', content: 'Fictional contract summary.', sensitive: true, file_path: path, file_size: 1, mime_type: 'text/html', uploaded_by: adminIdentity.employee_code }).select('id,file_size,mime_type').single())
  assert.equal(doc.mime_type, 'application/pdf'); assert.ok(doc.file_size > 1)
  const signed = await ok(employee.storage.from('hr-documents').createSignedUrl(path, 60, { download: 'qa-contract.pdf' }))
  const response = await globalThis.fetch(signed.signedUrl)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition') ?? '', /attachment/)
  assert.ok((await response.text()).startsWith('%PDF'))
  // Attached files cannot be removed; unattached uploads can be cleaned up.
  await employee.storage.from('hr-documents').remove([path])
  await admin.storage.from('hr-documents').remove([path])
  assert.ok((await service.storage.from('hr-documents').list(path.split('/')[0])).data?.length === 1)
  const orphan = `${randomUUID()}/orphan.pdf`
  await ok(admin.storage.from('hr-documents').upload(orphan, pdf, { contentType: 'application/pdf' }))
  await ok(admin.storage.from('hr-documents').remove([orphan]))
  assert.equal((await service.storage.from('hr-documents').list(orphan.split('/')[0])).data?.length ?? 0, 0)
  await ok(service.from('employee_documents').delete().eq('id', doc.id))
  await ok(service.storage.from('hr-documents').remove([path]))
})

await verify('HR corrects and withdraws announcements, and inbox copies follow', async () => {
  const created = await ok(admin.from('announcements').insert({ title: `${tag} notice`, content: 'Office closed Friday.', priority: 'Normal', published_on: day(0) }).select('id').single())
  await ok(employee.from('announcements').update({ title: 'Changed by employee' }).eq('id', created.id))
  assert.equal((await ok(service.from('announcements').select('title').eq('id', created.id).single())).title, `${tag} notice`)
  await ok(admin.from('announcements').update({ title: `${tag} notice (corrected)`, content: 'Office closed Monday.' }).eq('id', created.id))
  const copies = await ok(employee.from('notifications').select('title,message').eq('title', `${tag} notice (corrected)`))
  assert.deepEqual(copies, [{ title: `${tag} notice (corrected)`, message: 'Office closed Monday.' }])
  await ok(admin.from('announcements').delete().eq('id', created.id))
  assert.deepEqual(await ok(employee.from('notifications').select('id').ilike('title', `${tag} notice%`)), [])
})

await verify('System Administrators change roles and deactivate other administrators', async () => {
  const email = `qa-role-${Date.now()}@quantum.test`
  const password = `Qa-${randomUUID()}-Aa1!`
  const created = await ok(service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'hr_admin', must_set_password: false } }))
  const code = `ADM-QA${Date.now().toString().slice(-6)}`
  await ok(service.from('profiles').insert({ employee_code: code, auth_user_id: created.user.id, first_name: 'Role', last_name: 'QA', email, role: 'hr_admin', department: 'QA', position: 'QA' }))
  try {
    const target = await login({ email }, password)
    await ok(target.rpc('assert_hrms_access'))
    await denied(target.rpc('manage_admin_account', { operation: 'change-role', target_code: adminIdentity.employee_code, new_role: 'auditor' }))
    await denied(admin.rpc('manage_admin_account', { operation: 'change-role', target_code: adminIdentity.employee_code, new_role: 'auditor' }))
    await ok(admin.rpc('manage_admin_account', { operation: 'change-role', target_code: code, new_role: 'auditor' }))
    await denied(target.rpc('assert_hrms_access'))
    assert.equal((await ok(service.from('profiles').select('role').eq('employee_code', code).single())).role, 'auditor')
    await ok(admin.rpc('manage_admin_account', { operation: 'deactivate', target_code: code }))
    const relogin = newClient()
    await relogin.auth.signInWithPassword({ email, password })
    await denied(relogin.rpc('assert_hrms_access'))
    await ok(admin.rpc('manage_admin_account', { operation: 'reactivate', target_code: code }))
    assert.equal((await ok(service.from('profiles').select('status').eq('employee_code', code).single())).status, 'Active')
  } finally {
    await service.from('account_sessions').delete().eq('employee_code', code)
    await service.from('audit_logs').delete().eq('actor_employee_code', code)
    await service.from('profiles').update({ auth_user_id: null, status: 'Inactive' }).eq('employee_code', code)
    await service.auth.admin.deleteUser(created.user.id)
    // Audit history keeps the fictional profile if a reference remains.
    await service.from('profiles').delete().eq('employee_code', code)
  }
})

// Remove the fictional leave rows this run created.
await ok(service.from('leave_requests').delete().like('reason', `${tag}%`))
globalThis.console.log(`\n${passed.length} HR workflow scenarios passed.`)
