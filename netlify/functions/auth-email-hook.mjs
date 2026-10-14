import { createHash } from 'node:crypto'
import { Webhook } from 'standardwebhooks'
import { createClient } from '@supabase/supabase-js'
import { authEmailTemplates } from './_shared/email-templates.mjs'
const env = name => globalThis.Netlify?.env?.get(name) || globalThis.process?.env?.[name]
const json = (value, status = 200) => globalThis.Response.json(value, { status, headers: { 'cache-control': 'no-store' } })
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))

export function authHookMessages(payload, { supabaseUrl, appUrl, role }) {
  const { user, email_data: mail } = payload
  if (!user?.email || !mail?.email_action_type) throw new Error('Invalid email event')
  // Administrator resets are issued only by the audited administrator flow.
  // generateLink (used by that flow after capability validation) sends no email.
  if (mail.email_action_type === 'recovery' && role !== 'employee') return []
  const id = ({ signup: 'confirmation', magiclink: 'magic_link' })[mail.email_action_type] || mail.email_action_type
  const template = authEmailTemplates.find(item => item.id === id)
  if (!template) throw new Error('Unsupported email event')
  const portal = role === 'employee' ? 'employee' : 'admin'
  const redirect = new globalThis.URL(id === 'recovery' ? '/employee/reset-password' : id === 'invite' ? `/${portal}/setup-password` : `/${portal}/login`, appUrl)
  // Preserve only a known local route on our own origin; never echo arbitrary
  // redirect destinations into a credential-bearing message.
  if (mail.redirect_to && !['recovery','invite'].includes(id)) {
    const supplied = new globalThis.URL(mail.redirect_to, appUrl)
    if (supplied.origin === new globalThis.URL(appUrl).origin && /^\/(admin|employee)\/(login|reset-password|setup-password)$/.test(supplied.pathname)) redirect.pathname = supplied.pathname
  }
  const make = (to, token = mail.token, hash = mail.token_hash) => {
    if (typeof to !== 'string' || !to.includes('@') || /[\r\n]/.test(to)) throw new Error('Invalid recipient')
    const url = new globalThis.URL('/auth/v1/verify', supabaseUrl)
    url.searchParams.set('token', hash || ''); url.searchParams.set('type', mail.email_action_type); url.searchParams.set('redirect_to', redirect.href)
    if (!template.notification && id !== 'reauthentication' && !hash) throw new Error('Missing verification hash')
    const values = { Email: to, NewEmail: user.new_email || '', OldEmail: mail.old_email || '', OldPhone: mail.old_phone || '', Phone: user.phone || '', Provider: mail.provider || '', FactorType: mail.factor_type || '', Token: token || '', ConfirmationURL: url.href }
    const html = template.html.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, key) => {
      if (!(key in values)) throw new Error('Unknown template variable')
      return escape(values[key])
    })
    if (html.includes('{{')) throw new Error('Unrendered template')
    return { to, subject: template.subject, html }
  }
  if (id === 'email_change') {
    // Supabase's hash names are counterintuitive: hash_new belongs to the OLD
    // address, paired with token. hash belongs to new_email with token_new.
    return mail.token_hash_new
      ? [make(user.email, mail.token, mail.token_hash_new), make(user.new_email, mail.token_new, mail.token_hash)]
      : [make(user.new_email, mail.token_new || mail.token, mail.token_hash)]
  }
  if (id === 'email_changed_notification' && mail.old_email && mail.old_email !== user.email) return [make(mail.old_email), make(user.email)]
  return [make(user.email)]
}

export default async function authEmailHook(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = env('AUTH_EMAIL_HOOK_SECRET')
  if (!secret) return json({ error: 'Email hook is not configured' }, 503)
  if (Number(request.headers.get('content-length') || 0) > 131072) return json({ error: 'Payload too large' }, 413)
  let payload
  try {
    const raw = await request.text()
    if (raw.length > 131072) return json({ error: 'Payload too large' }, 413)
    payload = new Webhook(secret.replace(/^v1,/, '')).verify(raw, Object.fromEntries(request.headers))
  } catch { return json({ error: 'Invalid webhook signature' }, 401) }
  try {
    const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
    const serviceKey = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')
    const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: profile, error } = await client.from('profiles').select('role').eq('auth_user_id', payload.user.id).maybeSingle()
    if (error) throw error
    const messages = authHookMessages(payload, { supabaseUrl, appUrl: env('APP_URL') || 'https://quantumnhr.com', role: profile?.role })
    await Promise.all(messages.map(async message => {
      const deliveryKey = createHash('sha256').update(`${request.headers.get('webhook-id')}:${message.to}`).digest('hex')
      const response = await globalThis.fetch('https://api.resend.com/emails', { method: 'POST', signal: globalThis.AbortSignal.timeout(3500), headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json', 'idempotency-key': `auth-hook-${deliveryKey}` }, body: JSON.stringify({ from: env('RESEND_FROM_EMAIL'), ...message }) })
      if (!response.ok) throw new Error('Delivery not accepted')
    }))
    return json({})
  } catch { return json({ error: { http_code: 503, message: 'Account email delivery is temporarily unavailable. Please try again.' } }, 503) }
}
export const config = { path: '/api/auth-email-hook' }
