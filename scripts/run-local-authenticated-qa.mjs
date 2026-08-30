import { spawn } from 'node:child_process'
import {
  loadLocalQaRuntime,
  localOrigin,
  localProjectRef,
  waitForLocalHealth,
} from './local-qa-runtime.mjs'
import { localQaAccounts as accounts, seedLocalQaIdentities } from './local-qa-identities.mjs'

const stopChild = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('exit', resolve))
}

const run = async () => {
  const { apiUrl, serviceRoleKey, environment: runtimeEnvironment } = await loadLocalQaRuntime()

  const { passwords } = await seedLocalQaIdentities({ apiUrl, serviceRoleKey })

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
    await stopChild(vite)
  }
}

run().catch((error) => {
  globalThis.console.error(error instanceof Error ? error.message : error)
  globalThis.process.exitCode = 1
})
