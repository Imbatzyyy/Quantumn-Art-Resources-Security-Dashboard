import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import health from './netlify/functions/health.mjs'
import { handler as securityOperations } from './netlify/functions/security-operations.mjs'

const localHealthEndpoint = (): Plugin => ({
  name: 'quantum-local-health-endpoint',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/health', async (_request, response, next) => {
      if (globalThis.process?.env?.QUANTUM_ENVIRONMENT !== 'local') {
        next()
        return
      }

      const healthResponse = await health()
      response.statusCode = healthResponse.status
      healthResponse.headers.forEach((value, name) => response.setHeader(name, value))
      response.end(await healthResponse.text())
    })

    server.middlewares.use('/api/security-operations', async (request, response, next) => {
      if (globalThis.process?.env?.QUANTUM_ENVIRONMENT !== 'local') {
        next()
        return
      }

      try {
        request.setEncoding('utf8')
        let body = ''
        for await (const chunk of request) body += chunk
        const result = await securityOperations({
          httpMethod: request.method ?? 'GET',
          headers: request.headers,
          body,
        })
        response.statusCode = result.statusCode
        Object.entries(result.headers).forEach(([name, value]) => response.setHeader(name, value))
        response.end(result.body)
      } catch {
        response.statusCode = 500
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: 'The local security operation could not be completed.' }))
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), localHealthEndpoint()],
  server: {
    port: 5173,
  },
})
