import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import databaseHealth, { config } from '../../netlify/functions/database-health.mjs'

const origin = 'https://ndzgmrmpsqqpcmoxvyfu.supabase.co'
const key = 'fictional-server-key-for-unit-tests'
const fetchMock = vi.fn()
const databaseResponse = (status = 200) => new Response(null, { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', origin)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', key)
  vi.stubGlobal('Netlify', undefined)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('scheduled HRMS database activity safeguard', () => {
  it('runs four times daily without exposing a public custom route', () => {
    expect(config).toEqual({ schedule: '17 */6 * * *' })
  })

  it.each([200, 206])('executes a real HEAD read on an existing indexed column, with no rows or counts (%s)', async status => {
    const response = databaseResponse(status)
    const readBody = vi.spyOn(response, 'text')
    fetchMock.mockResolvedValue(response)
    const result = await databaseHealth()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${origin}/rest/v1/profiles?select=employee_code&limit=1`, {
      method: 'HEAD', headers: { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal),
    })
    expect(readBody).not.toHaveBeenCalled()
    expect(result?.status).toBe(204)
    expect(await result?.text()).toBe('')
    expect(console.info).toHaveBeenCalledWith('Database health check succeeded (read-only, no response body, attempt 1).')
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(key)
  })

  it('uses Netlify runtime credentials without requiring browser or local environment variables', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.stubGlobal('Netlify', { env: { get: (name: string) => ({ SUPABASE_URL: origin, SUPABASE_SERVICE_ROLE_KEY: key })[name] } })
    fetchMock.mockResolvedValue(databaseResponse())
    expect((await databaseHealth())?.status).toBe(204)
  })

  it.each(['', 'not a URL', 'http://ndzgmrmpsqqpcmoxvyfu.supabase.co', 'https://another-project.supabase.co', `${origin}/other`, `${origin}?token=x`, `${origin}#x`, 'https://user:password@ndzgmrmpsqqpcmoxvyfu.supabase.co'])('fails closed for an absent, wrong-project, or unsafe origin: %s', async url => {
    vi.stubEnv('SUPABASE_URL', url)
    await expect(databaseHealth()).rejects.toThrow('invalid HRMS project configuration')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed without a server credential', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(databaseHealth()).rejects.toThrow('missing server credential')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([301, 400, 401, 403, 404, 429])('does not retry configuration, permission, or rate errors (%s)', async status => {
    fetchMock.mockResolvedValue(databaseResponse(status))
    await expect(databaseHealth()).rejects.toThrow(`HTTP ${status}`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(console.info).not.toHaveBeenCalled()
  })

  it('rejects an HTML success page instead of advertising a healthy database', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { 'content-type': 'text/html' } }))
    await expect(databaseHealth()).rejects.toThrow('unexpected database response')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('recovers from one transient server error without a response-body download', async () => {
    vi.useFakeTimers()
    const response = databaseResponse(503)
    const readBody = vi.spyOn(response, 'text')
    fetchMock.mockResolvedValueOnce(response).mockResolvedValueOnce(databaseResponse())
    const pending = databaseHealth()
    await vi.runAllTimersAsync()
    expect((await pending)?.status).toBe(204)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readBody).not.toHaveBeenCalled()
  })

  it('caps repeated server errors at two attempts and marks the invocation failed', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(databaseResponse(503))
    const failed = expect(databaseHealth()).rejects.toThrow('HTTP 503')
    await vi.runAllTimersAsync()
    await failed
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith('Database health check failed (HTTP 503).')
  })

  it('bounds both requests with an 8-second timeout and sanitizes network failures', async () => {
    vi.useFakeTimers()
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    fetchMock.mockRejectedValue(new Error(`Provider error contains ${key}`))
    const failed = expect(databaseHealth()).rejects.toThrow('network error or timeout')
    await vi.runAllTimersAsync()
    await failed
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(timeout).toHaveBeenNthCalledWith(1, 8_000)
    expect(timeout).toHaveBeenNthCalledWith(2, 8_000)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(key)
  })
})
