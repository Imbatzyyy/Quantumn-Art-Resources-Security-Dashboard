const projectOrigin = 'https://ndzgmrmpsqqpcmoxvyfu.supabase.co'
const env = name => globalThis.Netlify?.env?.get(name) || globalThis.process?.env?.[name]
const fail = reason => {
  // Do not log credentials, provider response bodies, URLs, or employee records.
  const message = `Database health check failed (${reason}).`
  globalThis.console.error(message)
  throw new Error(message)
}

export default async function databaseHealth() {
  let origin
  try {
    const url = new globalThis.URL(env('SUPABASE_URL'))
    if (url.origin !== projectOrigin || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error()
    origin = url.origin
  } catch { return fail('invalid HRMS project configuration') }

  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!key?.trim()) return fail('missing server credential')

  // HEAD executes a real, bounded PostgREST read but transfers no employee rows.
  // Do not request an exact count or poll Auth/Realtime: neither is needed here.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let response
    try {
      response = await globalThis.fetch(`${origin}/rest/v1/profiles?select=employee_code&limit=1`, {
        method: 'HEAD',
        headers: { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json' },
        cache: 'no-store',
        redirect: 'error',
        signal: globalThis.AbortSignal.timeout(8_000),
      })
    } catch {
      if (attempt === 2) return fail('network error or timeout')
    }
    if (response?.status === 200 || response?.status === 206) {
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail('unexpected database response')
      globalThis.console.info(`Database health check succeeded (read-only, no response body, attempt ${attempt}).`)
      return new globalThis.Response(null, { status: 204 })
    }
    if (response && (response.status < 500 || attempt === 2)) return fail(`HTTP ${response.status}`)
    // One bounded retry for transient network/5xx failures; under Netlify's 30s limit.
    await new Promise(resolve => globalThis.setTimeout(resolve, 500))
  }
}

// UTC: 00:17, 06:17, 12:17, 18:17. Manila: 08:17, 14:17, 20:17, 02:17.
// Netlify runs this only for the published deploy and blocks direct public calls.
export const config = { schedule: '17 */6 * * *' }
