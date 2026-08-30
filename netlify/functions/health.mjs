export default async () =>
  new globalThis.Response(
    JSON.stringify({
      ok: true,
      service: 'quantum-hrms',
      timestamp: new Date().toISOString(),
    }),
    { headers: { 'content-type': 'application/json' } },
  )

export const config = {
  path: '/api/health',
}
