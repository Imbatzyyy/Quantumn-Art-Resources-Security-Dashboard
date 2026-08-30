import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { spawn } from 'node:child_process'
import {
  loadLocalQaRuntime,
  localOrigin,
  localProjectRef,
  waitForLocalHealth,
} from './local-qa-runtime.mjs'
import {
  generateQaPassword,
  localQaAccounts,
  seedLocalQaIdentities,
} from './local-qa-identities.mjs'

const execFileAsync = promisify(execFile)

const stopChild = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('exit', resolve))
}

const resetLocalDatabase = () => execFileAsync('npx', ['supabase', 'db', 'reset', '--local'], {
  cwd: globalThis.process.cwd(),
  maxBuffer: 4 * 1024 * 1024,
})

const run = async () => {
  await resetLocalDatabase()
  const { apiUrl, serviceRoleKey, environment: runtimeEnvironment } = await loadLocalQaRuntime()
  const { passwords } = await seedLocalQaIdentities({ apiUrl, serviceRoleKey })
  const suffix = Date.now().toString(36)
  const mutationEnvironment = {
    ...runtimeEnvironment,
    E2E_BASE_URL: localOrigin,
    E2E_DATA_CLASSIFICATION: 'fictional-classroom-only',
    E2E_EXPECTED_SUPABASE_PROJECT_REF: localProjectRef,
    E2E_ADMIN_EMAIL: localQaAccounts[0].email,
    E2E_ADMIN_PASSWORD: passwords.get(localQaAccounts[0].email),
    E2E_EMPLOYEE_EMAIL: localQaAccounts[1].email,
    E2E_EMPLOYEE_PASSWORD: passwords.get(localQaAccounts[1].email),
    E2E_NEW_EMPLOYEE_EMAIL: `qa.employee.${suffix}@quantum.test`,
    E2E_NEW_ADMIN_EMAIL: `qa.security.${suffix}@quantum.test`,
    E2E_TEMP_PASSWORD: generateQaPassword(),
    E2E_PERMANENT_PASSWORD: `Local QA private passphrase ${suffix}! 2026`,
    E2E_ADMIN_INVITE_PASSWORD: `Local QA admin passphrase ${suffix}! 2026`,
  }

  const vite = spawn(
    globalThis.process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4175', '--strictPort'],
    { cwd: globalThis.process.cwd(), env: mutationEnvironment, stdio: 'inherit' },
  )

  try {
    await waitForLocalHealth()
    globalThis.console.log('Isolated mutation QA is ready. Generated passwords and captured emails remain inside this process.')
    const test = spawn(
      globalThis.process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.mutations.config.ts'],
      { cwd: globalThis.process.cwd(), env: mutationEnvironment, stdio: 'inherit' },
    )
    const exitCode = await new Promise((resolve, reject) => {
      test.once('error', reject)
      test.once('exit', (code) => resolve(code ?? 1))
    })
    if (exitCode !== 0) globalThis.process.exitCode = exitCode
  } finally {
    await stopChild(vite)
    await resetLocalDatabase()
  }
}

run().catch((error) => {
  globalThis.console.error(error instanceof Error ? error.message : error)
  globalThis.process.exitCode = 1
})
