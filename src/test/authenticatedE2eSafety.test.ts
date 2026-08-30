import { describe, expect, it } from 'vitest'
import { validateAuthenticatedE2eConfiguration } from '../testSupport/authenticatedE2eSafety.js'

const safeEnvironment = {
  E2E_BASE_URL: 'https://deploy-preview-42--quantum-hrms-test.netlify.app',
  E2E_DATA_CLASSIFICATION: 'fictional-classroom-only',
  E2E_EXPECTED_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  E2E_ADMIN_EMAIL: 'admin@quantum.test',
  E2E_ADMIN_PASSWORD: 'FictionalAdmin!42',
  E2E_EMPLOYEE_EMAIL: 'employee@quantum.test',
  E2E_EMPLOYEE_PASSWORD: 'FictionalEmployee!42',
}

describe('authenticated E2E safety boundary', () => {
  it('accepts an isolated Netlify deploy preview with fictional identities', () => {
    const result = validateAuthenticatedE2eConfiguration(safeEnvironment)
    expect(result.baseURL).toBe('https://deploy-preview-42--quantum-hrms-test.netlify.app')
    expect(result.accounts.admin.email).toBe('admin@quantum.test')
    expect(result.expectedSupabaseProjectRef).toBe('abcdefghijklmnopqrst')
  })

  it('accepts localhost for an isolated local stack', () => {
    expect(validateAuthenticatedE2eConfiguration({
      ...safeEnvironment,
      E2E_BASE_URL: 'http://127.0.0.1:4175',
    }).baseURL).toBe('http://127.0.0.1:4175')
  })

  it.each([
    ['the custom production domain', { E2E_BASE_URL: 'https://quantumnhr.com' }, 'never a production hostname'],
    ['the primary Netlify site', { E2E_BASE_URL: 'https://quantumnartresources.netlify.app' }, 'never a production hostname'],
    ['unencrypted remote previews', { E2E_BASE_URL: 'http://deploy-preview-42--quantum-hrms-test.netlify.app' }, 'must use HTTPS'],
    ['an unclassified dataset', { E2E_DATA_CLASSIFICATION: 'production' }, 'must be fictional-classroom-only'],
    ['a malformed project reference', { E2E_EXPECTED_SUPABASE_PROJECT_REF: 'not-a-project' }, '20-character Supabase project reference'],
    ['the production Supabase project', { E2E_EXPECTED_SUPABASE_PROJECT_REF: 'ndzgmrmpsqqpcmoxvyfu' }, 'production Supabase project'],
    ['a non-fictional identity', { E2E_EMPLOYEE_EMAIL: 'person@example.com' }, 'only the fictional @quantum.test'],
    ['one shared account', { E2E_EMPLOYEE_EMAIL: 'admin@quantum.test' }, 'must use different accounts'],
    ['a short password', { E2E_ADMIN_PASSWORD: 'short' }, 'at least 12 characters'],
  ])('rejects %s', (_name, override, message) => {
    expect(() => validateAuthenticatedE2eConfiguration({ ...safeEnvironment, ...override })).toThrow(message)
  })

  it('fails closed when required configuration is absent', () => {
    expect(() => validateAuthenticatedE2eConfiguration({})).toThrow('E2E_BASE_URL is not configured')
  })
})
