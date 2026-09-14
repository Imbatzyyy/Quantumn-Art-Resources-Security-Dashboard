import { createClient } from '@supabase/supabase-js'
import { assertCallerAccess } from './_shared/hrms-access.mjs'
import { parseZapReport, cleanReportText as clean } from './_shared/zap-report.mjs'

const json = (body, status = 200) => globalThis.Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const env = (key) => globalThis.Netlify?.env?.get(key) || globalThis.process?.env?.[key]
export default async function importZapReport(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Authentication required.' }, 401)
  let input
  try { input = await request.json() } catch { return json({ error: 'Invalid JSON request.' }, 400) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'A JSON object is required.' },400)
  let client
  try { client = await assertCallerAccess((env('SUPABASE_URL') || env('VITE_SUPABASE_URL')), (env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')), token) }
  catch { return json({ error: 'Verify your session and authenticator before importing evidence.' }, 403) }
  const { data: caller, error: identityError } = await client.rpc('get_hrms_identity')
  if (identityError || !['admin','security_admin'].includes(caller?.role)) return json({ error: 'Security administrator access required.' }, 403)
  let parsed
  try { parsed = parseZapReport(input, { allowLocal: env('QUANTUM_ENVIRONMENT') === 'local' && /^http:\/\/(localhost|127\.0\.0\.1):/.test((env('SUPABASE_URL') || env('VITE_SUPABASE_URL')) || '') }) }
  catch (error) { return json({ error: error.message }, 400) }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(parsed.raw))
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2,'0')).join('')
  const scanCode = 'ZAP-' + globalThis.crypto.randomUUID().toUpperCase()
  const status = parsed.counts.High ? 'Failed' : parsed.counts.Medium || parsed.counts.Low ? 'Review Needed' : 'Passed'
  const scan = { scan_code: scanCode, scan_type: 'Baseline', environment: ['Production','Deploy Preview','Staging','Local Test'].includes(input.environment) ? input.environment : 'Production',
    target_url: parsed.targetUrl, zap_version: parsed.version, completed_at: parsed.completedAt, status,
    high_count: parsed.counts.High, medium_count: parsed.counts.Medium, low_count: parsed.counts.Low, informational_count: parsed.counts.Informational,
    report_name: clean(input.reportName || 'ZAP report',240), report_sha256: hash,
    authorized_scope: clean(input.authorizedScope || 'Administrator-supplied baseline report',500),
    reviewed_by: caller.employee_code, reviewed_at: new Date().toISOString(),
    notes: 'Imported report evidence; scan execution and authenticated coverage are not independently attested. ' + parsed.timestampBasis + ' ' + clean(input.notes,1000) }
  const admin = createClient((env('SUPABASE_URL') || env('VITE_SUPABASE_URL')), (env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.rpc('store_zap_evidence', { scan, findings: parsed.findings, actor: caller.employee_code })
  if (error) return json({ error: 'The report could not be stored. No partial scan was saved.' }, 400)
  return json({ scanCode: data, status, findings: parsed.findings.length, counts: parsed.counts },201)
}
export const config = { path: '/api/import-zap-report' }
