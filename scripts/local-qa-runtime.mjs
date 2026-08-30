import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const localOrigin = 'http://127.0.0.1:4175'
export const localProjectRef = 'localquantumhrmsqa01'
export const createLocalCaptureToken = () => randomBytes(32).toString('base64url')

const parseEnvironment = (output) => Object.fromEntries(
  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, '')]
    }),
)

const requireLocalUrl = (value) => {
  const url = new globalThis.URL(value)
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`Local QA refused the Supabase target: ${url.origin}`)
  }
  return url.origin
}

export const loadLocalQaRuntime = async ({ captureToken = createLocalCaptureToken() } = {}) => {
  const { stdout } = await execFileAsync('npx', ['supabase', 'status', '--output', 'env'], {
    cwd: globalThis.process.cwd(),
    maxBuffer: 1024 * 1024,
  })
  const local = parseEnvironment(stdout)
  const apiUrl = requireLocalUrl(local.API_URL)
  const serviceRoleKey = local.SERVICE_ROLE_KEY || local.SECRET_KEY
  const publishableKey = local.PUBLISHABLE_KEY || local.ANON_KEY
  if (!serviceRoleKey || !publishableKey) {
    throw new Error('Local QA could not read the local Supabase API keys. Run npm run local:supabase:start first.')
  }

  return {
    apiUrl,
    serviceRoleKey,
    publishableKey,
    environment: {
      ...globalThis.process.env,
      VITE_SUPABASE_URL: apiUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_URL: apiUrl,
      SUPABASE_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      SUPABASE_PROJECT_REF: localProjectRef,
      QUANTUM_ENVIRONMENT: 'local',
      CONTEXT: 'dev',
      APP_URL: localOrigin,
      LOCAL_QA_CAPTURE_TOKEN: captureToken,
      RESEND_API_KEY: 'local-capture-only',
      RESEND_FROM_EMAIL: 'Quantum HRMS Local QA <local@quantum.test>',
    },
  }
}

export const waitForLocalHealth = async () => {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(`${localOrigin}/api/health`, { signal: globalThis.AbortSignal.timeout(2_000) })
      if (response.ok) return
    } catch {
      // Vite may still be compiling. Retry until the bounded deadline.
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 250))
  }
  throw new Error('Local QA web server did not become healthy within 30 seconds.')
}
