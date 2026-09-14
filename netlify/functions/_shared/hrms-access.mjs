import { createClient } from '@supabase/supabase-js'

// Service credentials authenticate the connection, but every RPC below runs with
// the caller's JWT. PostgreSQL checks current status, MFA and session revocation.
export function callerClient(url, key, accessToken) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function assertCallerAccess(url, key, accessToken) {
  const client = callerClient(url, key, accessToken)
  const { error } = await client.rpc('assert_hrms_access')
  if (error) throw new Error('Verify your account setup and authenticator, or sign in again.')
  return client
}

export async function assertSetupAccess(url, key, accessToken) {
  const { error } = await callerClient(url,key,accessToken).rpc('assert_hrms_setup_access')
  if (error) throw new Error('The setup session is no longer authorized.')
}
