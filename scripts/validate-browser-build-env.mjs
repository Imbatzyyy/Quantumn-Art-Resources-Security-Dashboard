import { Buffer } from 'node:buffer'
import { URL } from 'node:url'

/** Validate build-time browser configuration without logging credentials. */
export function validateBrowserBuildEnv(environment) {
  const url = environment.VITE_SUPABASE_URL?.trim()
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !key && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean)
  if (missing.length) {
    throw new Error(`Cannot build a working HRMS frontend: missing ${missing.join(', ')}. Build with the intended Netlify environment (production: netlify deploy --prod --context production), or configure an ignored local .env file. Do not deploy an unconfigured local dist folder.`)
  }

  let parsedUrl
  try { parsedUrl = new URL(url) } catch { /* Report only the variable name below. */ }
  if (!parsedUrl || !['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('VITE_SUPABASE_URL must be an HTTP(S) Supabase API URL without embedded credentials.')
  }

  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return

  // Legacy anon JWTs are also browser-safe. Secret/service-role keys never are.
  try {
    const parts = key.split('.')
    if (parts.length === 3 && parts.every(Boolean)) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
      if (payload.role === 'anon') return
    }
  } catch { /* Malformed and privileged keys fail closed. */ }
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon key. Never expose a Supabase secret/service-role key to the browser.')
}
