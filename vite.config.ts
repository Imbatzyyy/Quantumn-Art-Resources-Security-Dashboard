import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import health from './netlify/functions/health.mjs'
import adminCreateEmployee from './netlify/functions/admin-create-employee.mjs'
import adminInviteAccount from './netlify/functions/admin-invite-account.mjs'
import completeInitialPassword from './netlify/functions/complete-initial-password.mjs'
import completeAdminInvite from './netlify/functions/complete-admin-invite.mjs'
import { handler as importZapReport } from './netlify/functions/import-zap-report.mjs'
import { handler as securityOperations } from './netlify/functions/security-operations.mjs'

interface CapturedEmail {
  id: string
  capturedAt: string
  from: string
  to: string[]
  subject: string
  text: string
  html: string
}

type WebHandler = (request: Request) => Promise<Response>
type EventHandler = (event: {
  httpMethod: string
  headers: Record<string, string | string[] | undefined>
  body: string
}) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>

const isLocalQa = () => globalThis.process?.env?.QUANTUM_ENVIRONMENT === 'local'

const readBody = async (request: IncomingMessage) => {
  request.setEncoding('utf8')
  let body = ''
  for await (const chunk of request) body += chunk
  return body
}

const webRequest = async (request: IncomingMessage & { originalUrl?: string }) => {
  const body = await readBody(request)
  const headers = new Headers()
  Object.entries(request.headers as Record<string, string | string[] | undefined>).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item))
    else if (value !== undefined) headers.set(name, value)
  })
  return new Request(`http://127.0.0.1${request.originalUrl || request.url || '/'}`, {
    method: request.method || 'GET',
    headers,
    body: ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : body,
  })
}

const sendWebResponse = async (source: Response, response: ServerResponse) => {
  response.statusCode = source.status
  source.headers.forEach((value, name) => response.setHeader(name, value))
  response.end(await source.text())
}

const sendEventResponse = (
  source: { statusCode: number; headers: Record<string, string>; body: string },
  response: ServerResponse,
) => {
  response.statusCode = source.statusCode
  Object.entries(source.headers).forEach(([name, value]) => response.setHeader(name, value))
  response.end(source.body)
}

const localApiEndpoints = (): Plugin => {
  const emails: CapturedEmail[] = []
  let emailTransport = Promise.resolve()

  const withCapturedEmail = async <T>(operation: () => Promise<T>) => {
    const previous = emailTransport
    let release: () => void = () => undefined
    emailTransport = new Promise<void>((resolve) => { release = resolve })
    await previous

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const target = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
      if (target !== 'https://api.resend.com/emails') return originalFetch(input, init)

      let payload: Partial<CapturedEmail> = {}
      try { payload = JSON.parse(String(init?.body || '{}')) } catch { /* Handler validation owns malformed payloads. */ }
      emails.push({
        id: `local-email-${emails.length + 1}`,
        capturedAt: new Date().toISOString(),
        from: String(payload.from || ''),
        to: Array.isArray(payload.to) ? payload.to.map(String) : [],
        subject: String(payload.subject || ''),
        text: String(payload.text || ''),
        html: String(payload.html || ''),
      })
      return Response.json({ id: `local-capture-${emails.length}` }, { status: 200 })
    }

    try {
      return await operation()
    } finally {
      globalThis.fetch = originalFetch
      release()
    }
  }

  return {
    name: 'quantum-local-api-endpoints',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/health', async (_request, response, next) => {
        if (!isLocalQa()) return next()
        await sendWebResponse(await health(), response)
      })

      const webEndpoints: Array<[string, WebHandler, boolean]> = [
        ['/api/admin-create-employee', adminCreateEmployee, true],
        ['/api/admin-invite-account', adminInviteAccount, true],
        ['/api/complete-initial-password', completeInitialPassword, false],
        ['/api/complete-admin-invite', completeAdminInvite, false],
      ]
      webEndpoints.forEach(([path, handler, capturesEmail]) => {
        server.middlewares.use(path, async (request, response, next) => {
          if (!isLocalQa()) return next()
          try {
            const invoke = async () => handler(await webRequest(request))
            await sendWebResponse(capturesEmail ? await withCapturedEmail(invoke) : await invoke(), response)
          } catch {
            response.statusCode = 500
            response.setHeader('content-type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: 'The local protected operation could not be completed.' }))
          }
        })
      })

      const eventEndpoints: Array<[string, EventHandler]> = [
        ['/api/security-operations', securityOperations],
        ['/api/import-zap-report', importZapReport],
      ]
      eventEndpoints.forEach(([path, handler]) => {
        server.middlewares.use(path, async (request, response, next) => {
          if (!isLocalQa()) return next()
          try {
            const body = await readBody(request)
            const result = await handler({
              httpMethod: request.method ?? 'GET',
              headers: request.headers,
              body,
            })
            sendEventResponse(result, response)
          } catch {
            response.statusCode = 500
            response.setHeader('content-type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: 'The local protected operation could not be completed.' }))
          }
        })
      })

      server.middlewares.use('/api/local-email-captures', async (request, response, next) => {
        if (!isLocalQa()) return next()
        response.setHeader('cache-control', 'no-store')
        response.setHeader('content-type', 'application/json; charset=utf-8')
        const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
        const expected = globalThis.process?.env?.LOCAL_QA_CAPTURE_TOKEN
        if (!expected || token !== expected) {
          response.statusCode = 403
          response.end(JSON.stringify({ error: 'Local QA capture access denied.' }))
          return
        }
        if (request.method === 'DELETE') {
          emails.splice(0)
          response.statusCode = 204
          response.end()
          return
        }
        if (request.method !== 'GET') {
          response.statusCode = 405
          response.end(JSON.stringify({ error: 'Method not allowed.' }))
          return
        }
        response.statusCode = 200
        response.end(JSON.stringify({ emails }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiEndpoints()],
  server: { port: 5173 },
})
