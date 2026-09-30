import { requireSupabase } from './supabaseClient.js'

export async function adminPasswordReset<T>(input: Record<string, unknown>, authenticated = false): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (authenticated) {
    const { data, error } = await requireSupabase().auth.getSession()
    if (error || !data.session) throw new Error('Your session has expired. Sign in again.')
    headers.authorization = `Bearer ${data.session.access_token}`
  }
  const response = await fetch('/api/admin-reset-password', { method: 'POST', headers, body: JSON.stringify(input) })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'The password reset could not be completed.')
  return result as T
}
