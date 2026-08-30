import { createClient } from '@supabase/supabase-js'

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
const json = (body, statusCode = 200) => ({ statusCode, headers, body: JSON.stringify(body) })
const clean = (value, max = 2000) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const env = (key) => globalThis.process?.env?.[key]

const riskName = (alert) => {
  const code = Number(alert.riskcode ?? alert.riskCode)
  if (code === 3) return 'High'
  if (code === 2) return 'Medium'
  if (code === 1) return 'Low'
  const label = clean(alert.riskdesc || alert.risk, 40).toLowerCase()
  if (label.startsWith('high')) return 'High'
  if (label.startsWith('medium')) return 'Medium'
  if (label.startsWith('low')) return 'Low'
  return 'Informational'
}

const allowedTarget = (value) => {
  try {
    const url = new globalThis.URL(value)
    return url.protocol === 'https:' && (
      url.hostname === 'quantumnhr.com'
      || url.hostname === 'www.quantumnhr.com'
      || url.hostname.endsWith('--quantumnartresources.netlify.app')
    )
  } catch {
    return false
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const authorization = event.headers.authorization || event.headers.Authorization || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!accessToken) return json({ error: 'Security Administrator authentication is required.' }, 401)

  let input
  try { input = JSON.parse(event.body || '{}') } catch { return json({ error: 'The ZAP report request is invalid.' }, 400) }
  const rawReport = typeof input.report === 'string' ? input.report : JSON.stringify(input.report || {})
  if (rawReport.length < 20 || rawReport.length > 5_000_000) return json({ error: 'Select a valid ZAP JSON report smaller than 5 MB.' }, 400)

  let report
  try { report = JSON.parse(rawReport) } catch { return json({ error: 'The selected file is not valid ZAP JSON.' }, 400) }
  const sites = Array.isArray(report.site) ? report.site : Array.isArray(report.sites) ? report.sites : []
  const alerts = sites.flatMap((site) => Array.isArray(site.alerts) ? site.alerts : [])
  const targetUrl = clean(input.targetUrl || sites[0]?.['@name'] || sites[0]?.name, 500)
  if (!allowedTarget(targetUrl)) return json({ error: 'The report target is outside the authorized Quantum HRMS scope.' }, 400)

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
  if (authError || !authData.user) return json({ error: 'Your session has expired.' }, 401)
  const { data: caller } = await admin.from('profiles')
    .select('employee_code, first_name, last_name, role, status')
    .eq('auth_user_id', authData.user.id)
    .single()
  if (!caller || !['admin', 'security_admin'].includes(caller.role) || caller.status !== 'Active') {
    return json({ error: 'Only a System or Security Administrator can import ZAP evidence.' }, 403)
  }

  const counts = { High: 0, Medium: 0, Low: 0, Informational: 0 }
  alerts.forEach((alert) => { counts[riskName(alert)] += 1 })
  const scanCode = `ZAP-${Date.now().toString(36).toUpperCase()}-${globalThis.crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(rawReport))
  const reportSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const status = counts.High > 0 ? 'Failed' : counts.Medium > 0 ? 'Review Needed' : 'Passed'
  const scanType = ['Baseline', 'Full', 'API', 'Authenticated'].includes(input.scanType) ? input.scanType : 'Baseline'
  const environment = ['Production', 'Deploy Preview', 'Staging', 'Local Test'].includes(input.environment) ? input.environment : 'Production'

  const { error: runError } = await admin.from('zap_scan_runs').insert({
    scan_code: scanCode,
    scan_type: scanType,
    environment,
    target_url: targetUrl,
    zap_version: clean(report['@version'] || report.version || 'OWASP ZAP', 80),
    completed_at: new Date().toISOString(),
    status,
    high_count: counts.High,
    medium_count: counts.Medium,
    low_count: counts.Low,
    informational_count: counts.Informational,
    report_name: clean(input.reportName || 'ZAP JSON report', 240),
    report_sha256: reportSha256,
    authorized_scope: clean(input.authorizedScope || 'Authorized Quantum HRMS web application assessment', 500),
    reviewed_by: caller.employee_code,
    reviewed_at: new Date().toISOString(),
    notes: clean(input.notes, 1200) || null,
  })
  if (runError) return json({ error: 'The ZAP scan summary could not be stored.' }, 400)

  const findings = alerts.slice(0, 500).map((alert) => {
    const instance = Array.isArray(alert.instances) ? alert.instances[0] : null
    return {
      scan_code: scanCode,
      plugin_id: clean(alert.pluginid || alert.pluginId, 40) || null,
      name: clean(alert.alert || alert.name, 240) || 'ZAP finding',
      risk: riskName(alert),
      confidence: clean(alert.confidence, 40) || clean(alert.confidencedesc, 40) || 'Medium',
      description: clean(alert.desc || alert.description, 2000) || null,
      solution: clean(alert.solution, 2000) || null,
      reference_url: clean(alert.reference, 1000) || null,
      affected_url: clean(instance?.uri || instance?.url, 1000) || targetUrl,
      evidence: clean(instance?.evidence, 1000) || null,
      status: 'Open',
    }
  })
  if (findings.length) {
    const { error: findingError } = await admin.from('zap_findings').insert(findings)
    if (findingError) {
      await admin.from('zap_scan_runs').delete().eq('scan_code', scanCode)
      return json({ error: 'The ZAP findings could not be stored.' }, 400)
    }
  }

  await admin.from('audit_logs').insert({
    actor_employee_code: caller.employee_code,
    actor_label: `${caller.first_name} ${caller.last_name}`,
    action: 'Imported authorized OWASP ZAP report',
    target: `${scanCode} · ${environment} · ${targetUrl}`,
    display_time: 'Just now',
  })

  return json({ scanCode, status, findings: findings.length, counts }, 201)
}
