import { currentSession } from './supabaseReads.js'

type SecurityOperationInput = Record<string, string | number | boolean | null | undefined>

const responseError = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return undefined
  return typeof payload.error === 'string' ? payload.error : undefined
}

export async function securityOperation<T = unknown>(input: SecurityOperationInput): Promise<T> {
  const session = await currentSession()
  if (!session) throw new Error('Your session has expired. Sign in again.')
  const response = await fetch('/api/security-operations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const result: unknown = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(responseError(result) || 'The security operation could not be completed.')
  return result as T
}
