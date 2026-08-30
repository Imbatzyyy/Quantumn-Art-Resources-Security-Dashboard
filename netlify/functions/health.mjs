const previewContexts = new Set(['deploy-preview', 'branch-deploy'])
const env = (name) => globalThis.Netlify?.env?.get(name) || globalThis.process?.env?.[name]

const projectRefFromUrl = (value) => {
  if (!value) return null

  try {
    const hostname = new globalThis.URL(value).hostname.toLowerCase()
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

const resolveEnvironment = (context) => {
  const configuredEnvironment = env('QUANTUM_ENVIRONMENT')
  if (configuredEnvironment) return configuredEnvironment
  if (previewContexts.has(context)) return 'qa-preview'
  if (context === 'dev') return 'local'
  return 'production'
}

export default async () => {
  const deploymentContext = env('CONTEXT') ?? 'unknown'
  const supabaseProjectRef = env('SUPABASE_PROJECT_REF') || projectRefFromUrl(env('SUPABASE_URL'))

  return new globalThis.Response(
    JSON.stringify({
      ok: true,
      service: 'quantum-hrms',
      environment: resolveEnvironment(deploymentContext),
      deploymentContext,
      supabase: {
        configured: Boolean(supabaseProjectRef),
        projectRef: supabaseProjectRef,
      },
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json',
      },
    },
  )
}

export const config = {
  path: '/api/health',
}
