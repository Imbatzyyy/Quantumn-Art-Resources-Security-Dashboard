import { describe, expect, it } from 'vitest'
import { validateBrowserBuildEnv } from '../../scripts/validate-browser-build-env.mjs'

const configured = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictional_test_only',
}
const jwt = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`

describe('browser build configuration gate', () => {
  it('rejects an unconfigured build before it can produce a broken release', () => {
    expect(() => validateBrowserBuildEnv({})).toThrow('missing VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY')
  })
  it.each(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])('requires %s to be nonempty', (name) => {
    expect(() => validateBrowserBuildEnv({ ...configured, [name]: '  ' })).toThrow(`missing ${name}`)
  })
  it('accepts public cloud and isolated local configuration', () => {
    expect(() => validateBrowserBuildEnv(configured)).not.toThrow()
    expect(() => validateBrowserBuildEnv({ ...configured, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).not.toThrow()
  })
  it('accepts legacy anon keys', () => {
    expect(() => validateBrowserBuildEnv({ ...configured, VITE_SUPABASE_PUBLISHABLE_KEY: jwt('anon') })).not.toThrow()
  })
  it.each(['sb_secret_fictional_private_key', jwt('service_role'), 'invalid-key'])('rejects unsafe/invalid browser keys without leaking their value', (key) => {
    try {
      validateBrowserBuildEnv({ ...configured, VITE_SUPABASE_PUBLISHABLE_KEY: key })
      expect.fail('Expected the unsafe key to be rejected')
    } catch (error) {
      expect((error as Error).message).toContain('Never expose a Supabase secret/service-role key')
      expect((error as Error).message).not.toContain(key)
    }
  })
  it.each(['not-a-url', 'file:///tmp/database', 'https://name:password@example.supabase.co'])('rejects invalid API URLs', (url) => {
    expect(() => validateBrowserBuildEnv({ ...configured, VITE_SUPABASE_URL: url })).toThrow('VITE_SUPABASE_URL must be')
  })
})
