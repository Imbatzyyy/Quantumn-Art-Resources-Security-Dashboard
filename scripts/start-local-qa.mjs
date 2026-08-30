import { spawn } from 'node:child_process'
import { loadLocalQaRuntime, localOrigin, waitForLocalHealth } from './local-qa-runtime.mjs'

const run = async () => {
  const { environment } = await loadLocalQaRuntime()
  const vite = spawn(
    globalThis.process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '4175', '--strictPort'],
    { cwd: globalThis.process.cwd(), env: environment, stdio: 'inherit' },
  )

  const stop = () => vite.kill('SIGTERM')
  globalThis.process.once('SIGINT', stop)
  globalThis.process.once('SIGTERM', stop)
  await waitForLocalHealth()
  globalThis.console.log(`Local QA application: ${localOrigin}`)
  globalThis.console.log('Docker-only ZAP target: http://host.docker.internal:4175')

  const exitCode = await new Promise((resolve, reject) => {
    vite.once('error', reject)
    vite.once('exit', (code) => resolve(code ?? 0))
  })
  globalThis.process.exitCode = exitCode
}

run().catch((error) => {
  globalThis.console.error(error instanceof Error ? error.message : error)
  globalThis.process.exitCode = 1
})
