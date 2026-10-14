import { createClient } from '@supabase/supabase-js'
const env = name => globalThis.Netlify?.env?.get(name) || globalThis.process?.env?.[name]
const json = (body, status = 200) => globalThis.Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export default async function recoverMfa(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Authentication required.' }, 401)
  let input
  try { input = await request.json() } catch { return json({ error: 'Invalid request.' }, 400) }
  if (typeof input?.code !== 'string' || !/^[a-fA-F0-9-]{32,40}$/.test(input.code)) return json({ error: 'Enter a valid recovery code.' }, 400)
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'Account recovery is unavailable.' }, 503)
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const caller = createClient(url, key, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data, error } = await caller.rpc('consume_mfa_recovery', { recovery_code: input.code })
  if (error || data?.authorized !== true || typeof data.userId !== 'string') return json({ error: 'Invalid or already-used recovery code. Verify your email before trying again.' }, 403)
  const admin = createClient(url, key, options)
  const factors = await admin.auth.admin.mfa.listFactors({ userId: data.userId })
  if (factors.error) return json({ error: 'The code was consumed but recovery could not finish. Use another saved code or contact your System Administrator.' }, 503)
  for (const factor of factors.data.factors) {
    const removed = await admin.auth.admin.mfa.deleteFactor({ userId: data.userId, id: factor.id })
    if (removed.error) return json({ error: 'Recovery could not finish. Use another saved recovery code.' }, 503)
  }
  return json({ recovered: true, enrollmentRequired: true })
}
export const config = { path: '/api/mfa-recovery' }
