import type { FullConfig } from '@playwright/test'
import { validateAuthenticatedE2eConfiguration } from '../src/testSupport/authenticatedE2eSafety.js'

interface HealthResponse {
  ok?: boolean
  service?: string
  environment?: string
  deploymentContext?: string
  supabase?: {
    configured?: boolean
    projectRef?: string | null
  }
}

const remotePreviewContexts = new Set(['deploy-preview', 'branch-deploy'])

export default async function verifyIsolatedTarget(_config: FullConfig) {
  const configuration = validateAuthenticatedE2eConfiguration(process.env)
  const healthUrl = new URL('/api/health', configuration.baseURL)
  const response = await fetch(healthUrl, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Authenticated E2E preflight failed: ${healthUrl} returned HTTP ${response.status}.`)
  }

  const health = await response.json() as HealthResponse
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(configuration.target.hostname)
  const allowedEnvironment = isLocal ? 'local' : 'qa-preview'

  if (health.ok !== true || health.service !== 'quantum-hrms') {
    throw new Error('Authenticated E2E preflight failed: the target did not identify itself as Quantum HRMS.')
  }
  if (health.environment !== allowedEnvironment) {
    throw new Error(`Authenticated E2E preflight failed: expected ${allowedEnvironment} but the target reported ${health.environment ?? 'no environment'}.`)
  }
  if (!isLocal && !remotePreviewContexts.has(health.deploymentContext ?? '')) {
    throw new Error('Authenticated E2E preflight failed: the remote target is not a Netlify deploy or branch preview.')
  }
  if (health.supabase?.configured !== true || health.supabase.projectRef !== configuration.expectedSupabaseProjectRef) {
    throw new Error('Authenticated E2E preflight failed: the preview is not connected to the explicitly approved isolated Supabase project.')
  }
}
