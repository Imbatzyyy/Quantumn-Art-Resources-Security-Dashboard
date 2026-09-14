import { assertCallerAccess } from './_shared/hrms-access.mjs'

const json = (body, status = 200) => globalThis.Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const env = (name) => globalThis.Netlify?.env?.get(name) || globalThis.process?.env?.[name]

export default async function securityOperations(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Authentication required.' }, 401)
  let input
  try { input = await request.json() } catch { return json({ error: 'Invalid request.' }, 400) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'A JSON object is required.' },400)
  let client
  try { client = await assertCallerAccess((env('SUPABASE_URL') || env('VITE_SUPABASE_URL')), (env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')), token) }
  catch { return json({ error: 'Your session requires verification. Please sign in again.' }, 403) }

  let result
  if (input.action === 'record-session') {
    result = await client.rpc('record_hrms_session', { device_label: String(input.device || 'Web browser'), location_label: String(input.location || 'Not verified') })
    if (!result.error) return json({ recorded: true, sessionCode: result.data })
  } else if (['revoke-session', 'revoke-other-sessions', 'end-current-session'].includes(input.action)) {
    result = await client.rpc('revoke_hrms_sessions', { operation: input.action, target_code: input.sessionCode || null })
    if (!result.error) return json({ revoked: true, count: result.data })
  } else if (input.action === 'organization-summary' || input.action === 'security-overview') {
    result = await client.rpc('security_overview', { window_days: input.windowDays || 30 })
    if (!result.error) {
      if (input.action === 'security-overview') return json(result.data)
      const a = result.data.accounts
      return json({ totalAccounts: a.total, mfaEnabled: a.mfaEnabled, mfaPending: a.total - a.mfaEnabled, privilegedAccounts: a.privileged, privilegedMfaEnabled: a.privilegedMfaEnabled })
    }
  } else if (['create-alert', 'update-alert'].includes(input.action)) {
    result = await client.rpc('manage_security_alert', { operation: input.action, details: input })
    if (!result.error) return json(result.data, input.action === 'create-alert' ? 201 : 200)
  } else return json({ error: 'Unsupported security operation.' }, 400)
  return json({ error: result?.error?.message || 'The protected operation could not be completed.' }, 400)
}

export const config = { path: '/api/security-operations' }
