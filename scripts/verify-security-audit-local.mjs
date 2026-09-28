import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { createClient } from '@supabase/supabase-js'
import { loadLocalQaRuntime } from './local-qa-runtime.mjs'
import { seedLocalQaIdentities, localQaAccounts } from './local-qa-identities.mjs'
import { verifyLocalFixtureSession } from './local-email-verification.mjs'

// Refuses remote URLs. No tokens, passwords or TOTP secrets are printed or saved.
const runtime = await loadLocalQaRuntime()
const { adminClient: service, passwords } = await seedLocalQaIdentities(runtime)
const newClient = () => createClient(runtime.apiUrl, runtime.publishableKey, { auth: { persistSession:false, autoRefreshToken:false } })
const login = async (account) => {
  const client=newClient()
  const result=await client.auth.signInWithPassword({ email:account.email,password:passwords.get(account.email) })
  assert.equal(result.error,null)
  await verifyLocalFixtureSession(runtime, service, result.data.session)
  return client
}
const ok = async (promise) => { const r=await promise; assert.equal(r.error,null, r.error?.message); return r.data }
const denied = async (promise) => assert.ok((await promise).error, 'Expected the operation to be rejected')
const tests=[]
const verify = async (name, run) => { await run(); tests.push(name); globalThis.console.log(`PASS ${name}`) }
const admin=await login(localQaAccounts[0]), employee=await login(localQaAccounts[1])
const identity=await ok(employee.rpc('get_hrms_identity'))
const adminIdentity=await ok(admin.rpc('get_hrms_identity'))

await verify('Server-derived session identity and heartbeat do not create duplicate rows', async () => {
  const a=await ok(employee.rpc('record_hrms_session',{ device_label:'Local QA browser',location_label:'Browser-reported test region' }))
  const b=await ok(employee.rpc('record_hrms_session',{ device_label:'Changed label',location_label:'Changed region' }))
  assert.equal(a,b)
  const rows=await ok(service.from('account_sessions').select('auth_session_id,assurance_level').eq('session_code',a))
  assert.equal(rows.length,1); assert.ok(rows[0].auth_session_id); assert.equal(rows[0].assurance_level,'aal1')
  await denied(employee.from('account_sessions').update({employee_code:adminIdentity.employee_code}).eq('session_code',a))
})
await verify('Aggregate overview is complete and restricted to security roles', async () => {
  const data=await ok(admin.rpc('security_overview',{window_days:7}))
  assert.equal(data.trend.length,7); assert.ok(data.accounts.total>=2)
  await denied(employee.rpc('security_overview',{window_days:7}))
  await denied(admin.rpc('security_overview',{window_days:365}))
})
await verify('Revocation blocks HRMS RPC, REST reads and a refreshed token', async () => {
  const other=await login(localQaAccounts[1])
  const code=await ok(other.rpc('record_hrms_session',{device_label:'Other QA browser',location_label:'Not verified'}))
  assert.equal(await ok(admin.rpc('revoke_hrms_sessions',{operation:'revoke-session',target_code:code})),1)
  await denied(other.rpc('assert_hrms_access'))
  assert.deepEqual(await ok(other.from('profiles').select('employee_code')),[])
  await other.auth.refreshSession()
  await denied(other.rpc('record_hrms_session',{device_label:'Retry',location_label:'Retry'}))
  await other.auth.signOut({scope:'local'})
})
await verify('Inactive accounts cannot clock in or update goals with an existing JWT', async () => {
  await ok(service.from('profiles').update({status:'Inactive'}).eq('employee_code',identity.employee_code))
  try {
    await denied(employee.rpc('clock_attendance',{clock_action:'in'}))
    await denied(employee.rpc('update_goal_progress',{selected_goal_id:1,new_progress:80}))
    assert.deepEqual(await ok(employee.from('profiles').select('employee_code')),[])
  } finally { await ok(service.from('profiles').update({status:'Active'}).eq('employee_code',identity.employee_code)) }
})
await verify('Setup-only identities do not expose employment details or permit operations', async () => {
  await ok(service.auth.admin.updateUserById(identity.auth_user_id,{app_metadata:{must_change_password:true}}))
  try {
    await denied(employee.rpc('assert_hrms_access'))
    const limited=await ok(employee.rpc('get_hrms_identity'))
    assert.equal(limited.must_change_password,true); assert.equal(limited.salary,undefined)
  } finally { await ok(service.auth.admin.updateUserById(identity.auth_user_id,{app_metadata:{must_change_password:false}})) }
})
await verify('Concurrent overlapping leave submissions yield exactly one request', async () => {
  const day=new Date(Date.now()+50*86_400_000).toISOString().slice(0,10)
  const input={requested_type:'Vacation',requested_start:day,requested_end:day,requested_reason:'Local security concurrency check'}
  const results=await Promise.all([employee.rpc('submit_leave_request',input),employee.rpc('submit_leave_request',input)])
  assert.equal(results.filter(r=>!r.error).length,1)
  await ok(service.from('leave_requests').delete().eq('reason',input.requested_reason))
})
await verify('Duplicate explicit clock-in cannot clock the employee out', async () => {
  await ok(employee.rpc('clock_attendance',{clock_action:'in'}))
  await ok(employee.rpc('clock_attendance',{clock_action:'in'}))
  const rows=await ok(employee.from('attendance').select('clock_out').eq('employee_code',identity.employee_code).order('work_date',{ascending:false}).limit(1))
  assert.equal(rows[0].clock_out,null)
})
await verify('Sensitive documents cannot be published to everyone', async () => {
  await denied(admin.from('employee_documents').insert({title:'Forbidden broadcast',document_type:'Policy',filename:'private.txt',content:'Do not broadcast',sensitive:true,employee_code:null}))
})
await verify('Request retries share one record and one notification transaction', async () => {
  const input={request_key:randomUUID(),requested_type:'General HR',requested_subject:'Local idempotency test',requested_description:'A fictional request submitted concurrently.'}
  const results=await Promise.all([employee.rpc('submit_employee_request',input),employee.rpc('submit_employee_request',input)])
  results.forEach(r=>assert.equal(r.error,null,r.error?.message)); assert.equal(results[0].data,results[1].data)
  const rows=await ok(service.from('employee_requests').select('id').eq('submission_key',input.request_key))
  assert.equal(rows.length,1)
})
await verify('Payroll removes ineligible draft recipients and remains immutable through concurrent locking', async () => {
  const period=`Local QA ${Date.now()}`
  await ok(admin.rpc('generate_payroll',{payroll_period:period,deduction_rate:8.25}))
  const run=await ok(service.from('payroll_runs').select('id').eq('period',period).single())
  await ok(service.from('profiles').update({status:'Inactive'}).eq('employee_code',identity.employee_code))
  try {
    await ok(admin.rpc('generate_payroll',{payroll_period:period,deduction_rate:8.25}))
    assert.deepEqual(await ok(service.from('payroll').select('id').eq('payroll_run_id',run.id).eq('employee_code',identity.employee_code)),[])
  } finally { await ok(service.from('profiles').update({status:'Active'}).eq('employee_code',identity.employee_code)) }
  for(const status of ['Validation','Approved','Released','Paid']) await ok(admin.rpc('transition_payroll_run',{selected_run_id:run.id,next_status:status}))
  const results=await Promise.all([admin.rpc('transition_payroll_run',{selected_run_id:run.id,next_status:'Locked'}),admin.rpc('generate_payroll',{payroll_period:period,deduction_rate:0})])
  assert.equal(results[0].error,null); assert.ok(results[1].error)
  const after=await ok(service.from('payroll_runs').select('status').eq('id',run.id).single()); assert.equal(after.status,'Locked')
})
await verify('Reopened lifecycle tasks reopen their completed case', async () => {
  const id=await ok(admin.rpc('create_lifecycle_case',{target_employee:identity.employee_code,selected_case_type:'Onboarding',selected_target_date:'2026-12-31'}))
  const tasks=await ok(service.from('lifecycle_tasks').select('id').eq('case_id',id))
  for(const task of tasks) await ok(admin.rpc('update_lifecycle_task',{selected_task_id:task.id,new_status:'Complete'}))
  assert.equal((await ok(service.from('lifecycle_cases').select('status').eq('id',id).single())).status,'Completed')
  await ok(admin.rpc('update_lifecycle_task',{selected_task_id:tasks[0].id,new_status:'Pending'}))
  assert.equal((await ok(service.from('lifecycle_cases').select('status').eq('id',id).single())).status,'Active')
})
await verify('Published performance history cannot be overwritten with another draft', async () => {
  const input={target_employee:identity.employee_code,review_period:`Local audit ${Date.now()}`,review_score:80,review_goal_progress:80,review_quality:80,review_productivity:80,review_teamwork:80,review_rating:'Meets Expectations',review_comments:'Fictional review for regression verification.'}
  const id=await ok(admin.rpc('save_performance_review',input))
  await ok(admin.rpc('publish_performance_review',{selected_review_id:id}))
  await denied(admin.rpc('save_performance_review',{...input,review_score:10}))
  assert.equal((await ok(service.from('performance_reviews').select('score,status').eq('id',id).single())).score,80)
})
await verify('Document downloads read fresh authorized text and deny expired content', async () => {
  const doc=await ok(admin.from('employee_documents').insert({employee_code:identity.employee_code,title:'Local QA document',document_type:'Policy',filename:'qa.txt',content:'First version',requires_ack:true}).select('id').single())
  assert.equal(await ok(employee.rpc('read_employee_document',{selected_document_id:doc.id})),'First version')
  await ok(admin.from('employee_documents').update({content:'Revised version'}).eq('id',doc.id))
  assert.equal(await ok(employee.rpc('read_employee_document',{selected_document_id:doc.id})),'Revised version')
  await ok(admin.from('employee_documents').update({expires_on:'2020-01-01'}).eq('id',doc.id))
  await denied(employee.rpc('read_employee_document',{selected_document_id:doc.id}))
  await denied(employee.rpc('acknowledge_document',{selected_document_id:doc.id}))
  assert.deepEqual(await ok(employee.from('employee_documents').select('content').eq('id',doc.id)),[])
})
await verify('Closed alert responses cannot silently reopen a resolved case', async () => {
  const created=await ok(admin.rpc('manage_security_alert',{operation:'create-alert',details:{employeeCode:identity.employee_code,severity:'Low',title:'Local audit alert',description:'Local transaction and closed-state test.',recommendedAction:'Review the local test evidence.',eventType:'Unusual access'}}))
  await ok(admin.rpc('manage_security_alert',{operation:'update-alert',details:{alertCode:created.alertCode,status:'Resolved',resolutionReason:'Local test complete',note:'Verified safely'}}))
  await denied(employee.rpc('respond_to_security_alert',{selected_alert_code:created.alertCode,response_action:'This was not me'}))
  const row=await ok(service.from('security_alerts').select('status,resolved_at').eq('alert_code',created.alertCode).single())
  assert.equal(row.status,'Resolved'); assert.ok(row.resolved_at)
})

function totp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=''
  for(const c of secret.toUpperCase().replace(/=+$/,'')) bits+=alphabet.indexOf(c).toString(2).padStart(5,'0')
  const key=Buffer.from((bits.match(/.{8}/g)||[]).map(byte=>parseInt(byte,2)))
  const time=Buffer.alloc(8); time.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
  const digest=createHmac('sha1',key).update(time).digest(); const offset=digest[19]&15
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')
}
await verify('Specialist roles retain only their authorized security and HR operations', async () => {
  try {
    for (const role of ['security_admin','auditor','hr_admin','payroll_admin']) {
      await ok(service.from('profiles').update({role}).eq('employee_code',adminIdentity.employee_code))
      if (['security_admin','auditor'].includes(role)) await ok(admin.rpc('security_overview',{window_days:7}))
      else await denied(admin.rpc('security_overview',{window_days:7}))
      if (role==='security_admin') {
        const choices=await ok(admin.rpc('security_account_options'))
        assert.ok(choices.some(row=>row.employee_code===identity.employee_code))
        assert.equal(choices[0].salary,undefined)
      } else await denied(admin.rpc('security_account_options'))
      if (role==='hr_admin') await denied(admin.from('profiles').update({department:'Unauthorized change'}).eq('employee_code',adminIdentity.employee_code))
      if (role==='auditor') await denied(admin.rpc('manage_security_alert',{operation:'create-alert',details:{}}))
    }
  } finally { await ok(service.from('profiles').update({role:'admin'}).eq('employee_code',adminIdentity.employee_code)) }
})
await verify('An enrolled factor requires AAL2 at the database, not just the login UI', async () => {
  const enrolled=await ok(admin.auth.mfa.enroll({factorType:'totp',friendlyName:'Local audit factor'}))
  try {
    await ok(admin.auth.mfa.challengeAndVerify({factorId:enrolled.id,code:totp(enrolled.totp.secret)}))
    const firstFactorOnly=await login(localQaAccounts[0])
    await denied(firstFactorOnly.rpc('security_overview',{window_days:7}))
    const bootstrap=await ok(firstFactorOnly.rpc('get_hrms_identity'))
    assert.equal(bootstrap.salary,undefined)
    await ok(firstFactorOnly.auth.mfa.challengeAndVerify({factorId:enrolled.id,code:totp(enrolled.totp.secret)}))
    await ok(firstFactorOnly.rpc('security_overview',{window_days:7}))
    await firstFactorOnly.auth.signOut({scope:'local'})
    const verifier=newClient()
    await denied(verifier.auth.signInWithPassword({email:localQaAccounts[0].email,password:'Wrong local test passphrase only'}))
    await ok(verifier.auth.signInWithPassword({email:localQaAccounts[0].email,password:passwords.get(localQaAccounts[0].email)}))
    await verifier.auth.signOut({scope:'local'})
    assert.equal((await ok(admin.auth.mfa.getAuthenticatorAssuranceLevel())).currentLevel,'aal2')
  } finally { await ok(admin.auth.mfa.unenroll({factorId:enrolled.id})) }
})
await verify('Password recovery works with MFA and preserves the enrolled factor', async () => {
  const enrolled=await ok(employee.auth.mfa.enroll({factorType:'totp',friendlyName:'Local recovery factor'}))
  try {
    await ok(employee.auth.mfa.challengeAndVerify({factorId:enrolled.id,code:totp(enrolled.totp.secret)}))
    const link=await ok(service.auth.admin.generateLink({type:'recovery',email:localQaAccounts[1].email}))
    const recovery=newClient()
    await ok(recovery.auth.verifyOtp({type:'recovery',token_hash:link.properties.hashed_token}))
    const next='Local recovery passphrase '+randomUUID()
    await denied(recovery.auth.updateUser({password:next}))
    await ok(recovery.auth.mfa.challengeAndVerify({factorId:enrolled.id,code:totp(enrolled.totp.secret)}))
    await ok(recovery.auth.updateUser({password:next}))
    assert.equal((await ok(recovery.auth.mfa.listFactors())).totp.length,1)
    await recovery.auth.signOut({scope:'local'})
  } finally {
    await ok(service.auth.admin.mfa.deleteFactor({userId:identity.auth_user_id,id:enrolled.id}))
    await ok(service.auth.admin.updateUserById(identity.auth_user_id,{password:passwords.get(localQaAccounts[1].email)}))
  }
})
await admin.auth.signOut({scope:'local'}); await employee.auth.signOut({scope:'local'})
globalThis.console.log(`${tests.length} real local security checks passed. No production records were accessed.`)
