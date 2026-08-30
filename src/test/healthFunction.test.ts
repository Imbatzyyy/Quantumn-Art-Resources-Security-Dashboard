import { afterEach, describe, expect, it, vi } from 'vitest'
import health from '../../netlify/functions/health.mjs'

interface HealthBody {
  environment: string
  deploymentContext: string
  supabase: {
    configured: boolean
    projectRef: string | null
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('deployment health metadata', () => {
  it('identifies an isolated deploy preview and its public Supabase project reference', async () => {
    vi.stubEnv('CONTEXT', 'deploy-preview')
    vi.stubEnv('SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co')
    vi.stubEnv('QUANTUM_ENVIRONMENT', 'qa-preview')

    const response = await health()
    const body = await response.json() as HealthBody

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({
      environment: 'qa-preview',
      deploymentContext: 'deploy-preview',
      supabase: {
        configured: true,
        projectRef: 'abcdefghijklmnopqrst',
      },
    })
  })

  it('fails to advertise a backend when the server URL is absent or malformed', async () => {
    vi.stubEnv('CONTEXT', 'production')
    vi.stubEnv('SUPABASE_URL', 'not-a-url')
    vi.stubEnv('QUANTUM_ENVIRONMENT', '')

    const response = await health()
    const body = await response.json() as HealthBody

    expect(body.environment).toBe('production')
    expect(body.supabase).toEqual({ configured: false, projectRef: null })
  })
})
