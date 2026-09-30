import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { assertCallerAccess, assertSetupAccess } from './_shared/hrms-access.mjs'
import { adminPasswordResetEmail } from './_shared/email-templates.mjs'
import { validatePermanentPassword } from '../../src/utils/passwordPolicy.js'

const json = (body, status = 200) => globalThis.Response.json(body, { status, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })
const env = name => globalThis.Netlify?.env?.get(name) || globalThis.process?.env?.[name]
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const invalid = 'This reset link is invalid, expired, or already used. Ask a System Administrator for a new link.'
const sessionId = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).session_id

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'Administrator recovery is not configured.' }, 503)
  let input
  try { input = await request.json() } catch { return json({ error: 'A JSON object is required.' }, 400) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'A JSON object is required.' }, 400)
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } })
  const manage = async (operation, args) => {
    const { data, error } = await admin.rpc('manage_admin_password_reset', { operation, ...args })
    if (error || !data) throw new Error('Reset operation unavailable.')
    return data
  }
  try {
    if (input.action === 'send') {
      if (!token) return json({ error: 'System Administrator authentication is required.' }, 401)
      try { await assertCallerAccess(url, key, token) } catch { return json({ error: 'Verify your administrator sign-in before sending a reset.' }, 403) }
      const { data: caller, error: callerError } = await admin.auth.getUser(token)
      if (callerError || !caller.user) return json({ error: 'Sign in again.' }, 401)
      if (typeof input.employeeCode !== 'string' || input.employeeCode.length > 60 || input.confirmed !== true) return json({ error: 'Confirm the administrator receiving this reset.' }, 400)
      if (!env('RESEND_API_KEY') || !env('RESEND_FROM_EMAIL')) return json({ error: 'Email delivery is not configured.' }, 503)
      const id = randomUUID()
      const reserved = await manage('reserve', { request_id: id, actor_id: caller.user.id, target_code: input.employeeCode })
      if (reserved.error === 'forbidden') return json({ error: 'Only an active System Administrator can send password resets.' }, 403)
      if (reserved.error === 'ineligible') return json({ error: 'Select an active administrator who has completed invitation setup. Pending invitations require their setup link.' }, 409)
      if (reserved.error === 'rate_limit') return json({ error: 'Please wait before sending again. Limits: one per minute, three per account per hour, and ten per sender per hour.' }, 429)
      if (reserved.error) return json({ error: 'The reset could not be prepared.' }, 400)
      try {
        const appUrl = new globalThis.URL(env('APP_URL') || 'https://quantumnhr.com')
        if (appUrl.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(appUrl.hostname)) throw new Error('Unsafe origin.')
        const recoveryToken = randomBytes(32).toString('base64url')
        // Fragment tokens are not included in HTTP requests, access logs or referrers.
        const link = `${appUrl.origin}/admin/reset-password#reset_token=${encodeURIComponent(recoveryToken)}`
        const email = adminPasswordResetEmail({ firstName: reserved.firstName, resetLink: link })
        const response = await globalThis.fetch('https://api.resend.com/emails', {
          method: 'POST', signal: globalThis.AbortSignal.timeout(12_000),
          headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json', 'idempotency-key': `admin-reset-${id}` },
          body: JSON.stringify({ from: env('RESEND_FROM_EMAIL'), to: [reserved.email], ...email }),
        })
        if (!response.ok) throw new Error('Email rejected.')
        const marked = await manage('sent', { request_id: id, token_hash: createHash('sha256').update(recoveryToken).digest('hex') })
        if (!marked.ok) throw new Error('Could not activate link.')
        return json({ sent: true, expiresAt: reserved.expiresAt }, 201)
      } catch {
        await manage('failed', { request_id: id })
        return json({ error: 'The reset email could not be completed. Your account and password have not been changed. Try again in a minute.' }, 502)
      }
    }
    if (input.action === 'exchange') {
      if (typeof input.resetToken !== 'string' || !/^[a-zA-Z0-9_-]{32,256}$/.test(input.resetToken)) return json({ error: invalid }, 400)
      const claimed = await manage('exchange', { token_hash: createHash('sha256').update(input.resetToken).digest('hex') })
      if (!claimed.ok) return json({ error: invalid }, 400)
      // The email carries only our 30-minute capability. Mint the underlying
      // Supabase OTP on demand so it cannot bypass that deadline or be replayed.
      const { data: generated, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email: claimed.email })
      if (linkError || generated.user?.id !== claimed.userId || !generated.properties?.hashed_token) {
        await manage('failed', { request_id: claimed.id })
        return json({ error: invalid }, 400)
      }
      const verifier = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } })
      const { data, error } = await verifier.auth.verifyOtp({ type: 'recovery', token_hash: generated.properties.hashed_token })
      if (error || !data.session || data.user?.id !== claimed.userId) {
        await manage('failed', { request_id: claimed.id })
        return json({ error: invalid }, 400)
      }
      const bound = await manage('bind', { request_id: claimed.id, sid: sessionId(data.session.access_token) })
      if (!bound.ok) { await admin.auth.admin.signOut(data.session.access_token, 'local'); return json({ error: invalid }, 400) }
      return json({ requestId: claimed.id, expiresAt: claimed.expiresAt, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } })
    }
    if (input.action === 'complete') {
      if (!token) return json({ error: 'Open the secure reset link first.' }, 401)
      if (!uuid.test(input.requestId || '')) return json({ error: invalid }, 400)
      try { await assertSetupAccess(url, key, token) } catch { return json({ error: 'Verify your enrolled authenticator or open a new reset link.' }, 403) }
      const { data: caller, error: callerError } = await admin.auth.getUser(token)
      if (callerError || !caller.user) return json({ error: invalid }, 401)
      const { data: profile } = await admin.from('profiles').select('first_name,last_name').eq('auth_user_id', caller.user.id).single()
      const passwordError = validatePermanentPassword(typeof input.newPassword === 'string' ? input.newPassword : '', { email: caller.user.email, firstName: profile?.first_name, lastName: profile?.last_name })
      if (passwordError) return json({ error: passwordError }, 400)
      const sid = sessionId(token) // Signature was verified by getUser and assertSetupAccess.
      const consumed = await manage('consume', { request_id: input.requestId, sid })
      if (!consumed.ok || consumed.userId !== caller.user.id) return json({ error: invalid }, 400)
      const { error: updateError } = await admin.auth.admin.updateUserById(caller.user.id, {
        password: input.newPassword,
        app_metadata: { ...caller.user.app_metadata, password_changed_at: new Date().toISOString() },
      })
      if (updateError) { await manage('failed', { request_id: input.requestId }); return json({ error: 'The password could not be saved. Request a new link; an old or reused password may be rejected.' }, 400) }
      let completed
      try { completed = await manage('complete', { request_id: input.requestId, sid }) }
      catch { completed = { ok: false } }
      finally { await admin.auth.admin.signOut(token, 'global') }
      if (!completed.ok) return json({ error: 'Your password changed. Sign in again; contact your administrator to review session revocation.' }, 409)
      return json({ passwordChanged: true })
    }
    return json({ error: 'Unsupported operation.' }, 400)
  } catch { return json({ error: 'The secure reset service is unavailable. Please try again shortly.' }, 503) }
}

export const config = { path: '/api/admin-reset-password' }
