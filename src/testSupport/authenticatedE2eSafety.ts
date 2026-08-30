export interface AuthenticatedE2eConfiguration {
  baseURL: string
  target: URL
  accounts: {
    admin: { email: string; password: string }
    employee: { email: string; password: string }
  }
}

type Environment = Record<string, string | undefined>

const required = (environment: Environment, name: string): string => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`Authenticated E2E is disabled: ${name} is not configured.`)
  return value
}

export function validateAuthenticatedE2eConfiguration(environment: Environment): AuthenticatedE2eConfiguration {
  const baseURL = required(environment, 'E2E_BASE_URL')
  const adminEmail = required(environment, 'E2E_ADMIN_EMAIL').toLowerCase()
  const employeeEmail = required(environment, 'E2E_EMPLOYEE_EMAIL').toLowerCase()
  const adminPassword = required(environment, 'E2E_ADMIN_PASSWORD')
  const employeePassword = required(environment, 'E2E_EMPLOYEE_PASSWORD')
  const classification = required(environment, 'E2E_DATA_CLASSIFICATION')
  const target = new URL(baseURL)
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(target.hostname)
  const isDeployPreview = /^(deploy-preview-\d+|[a-z0-9-]+)--[a-z0-9-]+\.netlify\.app$/i.test(target.hostname)

  if (!isLocal && target.protocol !== 'https:') {
    throw new Error('Authenticated E2E rejected the target: remote previews must use HTTPS.')
  }
  if (!isLocal && !isDeployPreview) {
    throw new Error('Authenticated E2E rejected the target: use localhost or an isolated Netlify deploy/branch preview, never a production hostname.')
  }
  if (classification !== 'fictional-classroom-only') {
    throw new Error('Authenticated E2E rejected the dataset: E2E_DATA_CLASSIFICATION must be fictional-classroom-only.')
  }
  if (![adminEmail, employeeEmail].every((email) => email.endsWith('@quantum.test'))) {
    throw new Error('Authenticated E2E rejected the identities: only the fictional @quantum.test classroom accounts are allowed.')
  }
  if (adminEmail === employeeEmail) {
    throw new Error('Authenticated E2E rejected the identities: Admin and Employee must use different accounts.')
  }
  if (adminPassword.length < 12 || employeePassword.length < 12) {
    throw new Error('Authenticated E2E rejected the credentials: each classroom-only password must contain at least 12 characters.')
  }

  return {
    baseURL: target.origin,
    target,
    accounts: {
      admin: { email: adminEmail, password: adminPassword },
      employee: { email: employeeEmail, password: employeePassword },
    },
  }
}
