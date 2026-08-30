import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { generateQaPassword } from './local-qa-identities.mjs'
import { loadLocalQaRuntime } from './local-qa-runtime.mjs'

const execFileAsync = promisify(execFile)
const credentialPath = new globalThis.URL('../tmp/local-demo-credentials.json', import.meta.url)

const resetLocalDatabase = () => execFileAsync('npx', ['supabase', 'db', 'reset', '--local'], {
  cwd: globalThis.process.cwd(),
  maxBuffer: 4 * 1024 * 1024,
})

const run = async () => {
  await resetLocalDatabase()
  const { apiUrl, serviceRoleKey } = await loadLocalQaRuntime()
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data: profiles, error: profileError } = await admin.from('profiles')
    .select('employee_code, first_name, last_name, email, role, status')
    .in('status', ['Active', 'On Leave'])
    .order('employee_code')
  if (profileError) throw profileError
  if (!profiles.length) throw new Error('The local demonstration profiles were not created by the migrations.')

  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError
  const credentials = []

  for (const profile of profiles) {
    const password = generateQaPassword()
    const existing = existingUsers.users.find((user) => user.email?.toLowerCase() === profile.email.toLowerCase())
    const attributes = {
      email: profile.email,
      password,
      email_confirm: true,
      user_metadata: { first_name: profile.first_name, last_name: profile.last_name },
      app_metadata: {
        role: profile.role,
        must_change_password: false,
        must_set_password: false,
        local_demo_identity: true,
      },
    }
    const result = existing
      ? await admin.auth.admin.updateUserById(existing.id, attributes)
      : await admin.auth.admin.createUser(attributes)
    if (result.error || !result.data.user) throw result.error || new Error(`Could not create ${profile.employee_code}.`)
    credentials.push({
      employeeCode: profile.employee_code,
      name: `${profile.first_name} ${profile.last_name}`,
      portal: profile.role === 'employee' ? 'employee' : 'admin',
      role: profile.role,
      email: profile.email,
      password,
    })
  }

  const { data: linked, error: linkedError } = await admin.from('profiles')
    .select('employee_code, auth_user_id')
    .in('employee_code', profiles.map((profile) => profile.employee_code))
  if (linkedError) throw linkedError
  if (linked.length !== profiles.length || linked.some((profile) => !profile.auth_user_id)) {
    throw new Error('One or more local demonstration identities were not linked to their HRMS profile.')
  }

  await mkdir(new globalThis.URL('../tmp/', import.meta.url), { recursive: true })
  await writeFile(credentialPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    environment: 'local-only',
    appUrl: 'http://127.0.0.1:4175',
    credentials,
  }, null, 2)}\n`, { mode: 0o600 })
  await chmod(credentialPath, 0o600)

  globalThis.console.log(`Prepared ${credentials.length} fictional local demonstration identities.`)
  globalThis.console.log('Credentials were written to the ignored, owner-readable file tmp/local-demo-credentials.json.')
  globalThis.console.log('Run npm run local:app, then use only those credentials against http://127.0.0.1:4175.')
}

run().catch((error) => {
  globalThis.console.error(error instanceof Error ? error.message : error)
  globalThis.process.exitCode = 1
})
