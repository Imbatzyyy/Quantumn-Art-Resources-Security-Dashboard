import { createHmac, randomInt, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { callerClient } from './_shared/hrms-access.mjs'
import { signinCodeEmail } from './_shared/email-templates.mjs'

const json = (body, status = 200) => globalThis.Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const env = (name) => globalThis.Netlify?.env?.get(name) || globalThis.process?.env?.[name]
const mask = (email) => { const [local, domain] = email.split('@'); return `${local.slice(0, 1)}•••@${domain}` }
export default async function signinEmail(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return json({ error: 'Sign in with your email and password first.' }, 401)
  let input
  try { input = await request.json() } catch { return json({ error: 'Invalid request.' }, 400) }
  if (!input || typeof input !== 'object' || !['status','send','resend','verify'].includes(input.action) || !['admin','employee'].includes(input.portal)) return json({ error: 'Invalid verification request.' }, 400)
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'Sign-in verification is temporarily unavailable.' }, 503)
  try {
    const { data: context, error } = await callerClient(url, key, token).rpc('signin_email_context')
    if (error || !context || context.portal !== input.portal || !context.passwordAuthenticated) return json({ error: 'Your sign-in session has expired. Sign in with your password again.' }, 401)
    if (context.setupRequired) return json({ error: 'Finish your account setup before using email sign-in verification.' }, 409)
    const publicContext = { maskedEmail: mask(context.email), verified: context.verified, challengeId: context.challengeId, expiresAt: context.expiresAt, resendAt: context.resendAt }
    if (input.action === 'status' || context.verified) return json(publicContext)
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const digest = (id, code) => createHmac('sha256', key).update(`${context.sessionId}:${id}:${code}`).digest('hex')
    const rpc = async (operation, args = {}) => {
      const { data, error: operationError } = await admin.rpc('manage_signin_email', { operation, sid: context.sessionId, uid: context.userId, ...args })
      if (operationError) throw new Error('Verification service unavailable')
      return data
    }
    const resultResponse = (result) => {
      if (!result.error) return json({ ...publicContext, ...result })
      const messages = { cooldown: 'Please wait before requesting another code.', rate_limit: 'Too many attempts. Please wait before trying again.', expired: 'This code expired, was replaced, or reached its attempt limit. Request a new code.', incorrect: 'That code is incorrect. Check your latest verification email.' }
      return json({ error: messages[result.error] || 'Sign in again to restart verification.', retryAt: result.retryAt, attemptsRemaining: result.attemptsRemaining }, ['cooldown','rate_limit'].includes(result.error) ? 429 : 400)
    }
    if (input.action === 'verify') {
      if (!/^\d{6}$/.test(input.code || '') || !/^[0-9a-f-]{36}$/i.test(input.challengeId || '')) return json({ error: 'Enter the six-digit code from your email.' }, 400)
      return resultResponse(await rpc('verify', { challenge: input.challengeId, code_hash: digest(input.challengeId, input.code) }))
    }
    const resendKey = env('RESEND_API_KEY'), from = env('RESEND_FROM_EMAIL')
    if (!resendKey || !from) return json({ error: 'Email delivery is temporarily unavailable. Contact your administrator.' }, 503)
    const challenge = randomUUID(), code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const reservation = await rpc('reserve', { challenge, code_hash: digest(challenge, code), force_resend: input.action === 'resend' })
    if (!reservation.send) return resultResponse(reservation)
    const email = signinCodeEmail({ firstName: context.firstName, portal: context.portal, code })
    let accepted = false
    try {
      const response = await globalThis.fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json', 'Idempotency-Key': `signin-${challenge}` },
        body: JSON.stringify({ from, to: [context.email], ...email }), signal: globalThis.AbortSignal.timeout(15_000),
      })
      const receipt = await response.json().catch(() => null)
      accepted = response.ok && typeof receipt?.id === 'string' && receipt.id.length > 0
    } catch { /* Never log a code, token, provider payload or recipient. */ }
    const confirmed = await rpc(accepted ? 'sent' : 'failed', { challenge })
    if (!accepted || !confirmed.sent) return json({ error: 'We could not confirm sending your code. Wait a minute, then request a new code.', retryAt: reservation.resendAt }, 502)
    return json({ ...publicContext, sent: true, challengeId: challenge, expiresAt: reservation.expiresAt, resendAt: reservation.resendAt })
  } catch {
    return json({ error: 'Verification is temporarily unavailable. Please try again shortly.' }, 503)
  }
}
export const config = { path: '/api/signin-email' }
