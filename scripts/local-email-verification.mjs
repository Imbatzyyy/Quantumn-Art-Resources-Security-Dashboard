import { execFileSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { createHmac, randomUUID } from 'node:crypto'

const assertLocal = (url) => {
  if (!url || !['127.0.0.1', 'localhost'].includes(new globalThis.URL(url).hostname)) throw new Error('Email QA requires the local fictional database and local email capture; it never reads a production inbox.')
}

// Fixture setup only. Real code delivery and rate limits have separate tests.
export function resetLocalEmailLimits(apiUrl) {
  assertLocal(apiUrl)
  execFileSync('docker', ['exec', 'supabase_db_quantum-hrms-local-qa', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', 'truncate private.email_signin_limits;'], { stdio: 'ignore' })
}

export async function verifyLocalFixtureSession(runtime, service, session) {
  assertLocal(runtime.apiUrl)
  resetLocalEmailLimits(runtime.apiUrl)
  const sid = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString()).session_id
  const challenge = randomUUID()
  const code_hash = createHmac('sha256', runtime.serviceRoleKey).update(`${sid}:${challenge}:123456`).digest('hex')
  for (const operation of ['reserve', 'sent', 'verify']) {
    const { data, error } = await service.rpc('manage_signin_email', { operation, sid, uid: session.user.id, challenge, code_hash })
    if (error || data?.error) throw new Error(`Local fixture verification failed: ${error?.message || data.error}`)
  }
}

export async function capturedLocalCode(baseURL, email, captureToken) {
  assertLocal(baseURL)
  if (!captureToken) throw new Error('A local email capture token is required.')
  const response = await globalThis.fetch(`${baseURL}/api/local-email-captures`, { headers: { authorization: `Bearer ${captureToken}` } })
  if (!response.ok) throw new Error('Local email capture unavailable.')
  const { emails } = await response.json()
  return emails.filter(item => item.to.includes(email) && item.subject.includes('sign-in verification code')).at(-1)?.text.match(/Verification code: (\d{6})/)?.[1]
}
