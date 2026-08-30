import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  loadLocalQaRuntime,
  localOrigin,
  localProjectRef,
  waitForLocalHealth,
} from './local-qa-runtime.mjs'

const accounts = [
  {
    email: 'admin@quantum.test',
    metadata: { first_name: 'Prince', last_name: 'Balane' },
    appMetadata: { role: 'admin', must_set_password: false },
  },
  {
    email: 'employee@quantum.test',
    metadata: { first_name: 'David', last_name: 'Santos' },
    appMetadata: { role: 'employee', must_set_password: false },
  },
]

const generatePassword = () => `Qa!7${randomBytes(18).toString('base64url')}`

const run = async () => {
  const { apiUrl, serviceRoleKey, environment: runtimeEnvironment } = await loadLocalQaRuntime()

  const adminClient = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userPage, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError

  const passwords = new Map()
  for (const account of accounts) {
    const password = generatePassword()
    passwords.set(account.email, password)
    const existing = userPage.users.find((user) => user.email?.toLowerCase() === account.email)
    const attributes = {
      password,
      email_confirm: true,
      user_metadata: account.metadata,
      app_metadata: account.appMetadata,
    }
    const result = existing
      ? await adminClient.auth.admin.updateUserById(existing.id, attributes)
      : await adminClient.auth.admin.createUser({ email: account.email, ...attributes })
    if (result.error) throw result.error
  }

  const { data: linkedProfiles, error: profileError } = await adminClient
    .from('profiles')
    .select('email, auth_user_id, role, status')
    .in('email', accounts.map(({ email }) => email))
  if (profileError) throw profileError
  if (linkedProfiles.length !== accounts.length || linkedProfiles.some((profile) => !profile.auth_user_id)) {
    throw new Error('Local QA Auth users were not linked to both fictional HRMS profiles.')
  }

  const vite = spawn(
    globalThis.process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'],
    { cwd: globalThis.process.cwd(), env: runtimeEnvironment, stdio: 'inherit' },
  )

  try {
    await waitForLocalHealth()
    globalThis.console.log('Local Supabase is ready with two fictional identities. Passwords remain only in this test process.')
    const test = spawn(
      globalThis.process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.authenticated.config.ts'],
      {
        cwd: globalThis.process.cwd(),
        env: {
          ...runtimeEnvironment,
          E2E_BASE_URL: localOrigin,
          E2E_DATA_CLASSIFICATION: 'fictional-classroom-only',
          E2E_EXPECTED_SUPABASE_PROJECT_REF: localProjectRef,
          E2E_ADMIN_EMAIL: accounts[0].email,
          E2E_ADMIN_PASSWORD: passwords.get(accounts[0].email),
          E2E_EMPLOYEE_EMAIL: accounts[1].email,
          E2E_EMPLOYEE_PASSWORD: passwords.get(accounts[1].email),
        },
        stdio: 'inherit',
      },
    )
    const exitCode = await new Promise((resolve, reject) => {
      test.once('error', reject)
      test.once('exit', (code) => resolve(code ?? 1))
    })
    if (exitCode !== 0) globalThis.process.exitCode = exitCode
  } finally {
    vite.kill('SIGTERM')
    await new Promise((resolve) => vite.once('exit', resolve))
  }
}

run().catch((error) => {
  globalThis.console.error(error instanceof Error ? error.message : error)
  globalThis.process.exitCode = 1
})
