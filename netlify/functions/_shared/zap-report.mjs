export const cleanReportText = (value, max = 2000) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export function parseZapReport(input, { allowLocal = false, now = Date.now() } = {}) {
  const raw = typeof input.report === 'string' ? input.report : JSON.stringify(input.report || {})
  if (new globalThis.TextEncoder().encode(raw).length > 5_000_000) throw new Error('The report must be smaller than 5 MB.')
  let report
  try { report = JSON.parse(raw) } catch { throw new Error('Select a valid ZAP JSON report.') }
  if (!report || !report['@version'] || !Array.isArray(report.site) || !report.site.length) throw new Error('The JSON is not a supported ZAP report: version and scanned sites are required.')
  const allowed = (value) => {
    let url
    try { url = new globalThis.URL(value) } catch { throw new Error('The report contains an invalid target URL.') }
    if (url.username || url.password) throw new Error('Report URLs must not contain credentials.')
    const hosted = url.protocol === 'https:' && (['quantumnhr.com', 'www.quantumnhr.com', 'quantumnartresources.netlify.app', 'ndzgmrmpsqqpcmoxvyfu.supabase.co'].includes(url.hostname) || url.hostname.endsWith('--quantumnartresources.netlify.app'))
    const local = allowLocal && url.origin === 'http://host.docker.internal:4175'
    if (!hosted && !local) throw new Error('The report contains a site outside the authorized HRMS scope.')
    return url
  }
  const sites = report.site.map((site) => allowed(site?.['@name']))
  const target = input.targetUrl ? allowed(input.targetUrl) : sites.find((site) => site.hostname !== 'ndzgmrmpsqqpcmoxvyfu.supabase.co')
  if (!target || !sites.some((site) => site.origin === target.origin)) throw new Error('The selected target does not match a site actually recorded in the report.')
  const generated = String(report['@generated'] || '').trim()
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2}|\bGMT|\bUTC)$/i.test(generated)
  const reportOffset = { UTC: '+0000', 'Asia/Manila': '+0800' }[input.reportTimeZone]
  if (!hasZone && !reportOffset) throw new Error('This report has no time zone. Select the report generator time zone before importing.')
  const completed = Date.parse(hasZone ? generated : `${generated} ${reportOffset}`)
  if (!Number.isFinite(completed) || completed > now + 300_000) throw new Error('The report must contain a valid, non-future generated timestamp.')
  if (input.scanType && input.scanType !== 'Baseline') throw new Error('This importer accepts baseline evidence only. Full or authenticated scan claims need a separately verified assessment.')
  const alerts = []
  for (const site of report.site) {
    const siteUrl = allowed(site['@name'])
    if (!Array.isArray(site.alerts)) throw new Error('Every scanned site must include its alerts array.')
    for (const alert of site.alerts) {
      if (!alert || !alert.pluginid || !(alert.alert || alert.name) || !['0','1','2','3'].includes(String(alert.riskcode))) throw new Error('A finding is missing a valid plugin, name or risk code.')
      if (!Array.isArray(alert.instances)) throw new Error('Each finding must include its instances array.')
      for (const instance of alert.instances) {
        if (allowed(instance.uri || instance.url).origin !== siteUrl.origin) throw new Error('A finding references a different site from its report section.')
      }
      alerts.push({ ...alert, siteUrl: siteUrl.href })
    }
  }
  if (alerts.length > 500) throw new Error('This report exceeds 500 findings. Split it into scoped reports; no findings have been imported.')
  const counts = { High: 0, Medium: 0, Low: 0, Informational: 0 }
  const findings = alerts.map((alert) => {
    const risk = ['Informational','Low','Medium','High'][Number(alert.riskcode)]
    counts[risk]++
    return { plugin_id: cleanReportText(alert.pluginid,40), name: cleanReportText(alert.alert || alert.name,240), risk,
      confidence: cleanReportText(alert.confidence || alert.confidencedesc,40), description: cleanReportText(alert.desc || alert.description),
      solution: cleanReportText(alert.solution), reference_url: cleanReportText(alert.reference,1000),
      affected_url: cleanReportText(alert.instances[0]?.uri || alert.instances[0]?.url || alert.siteUrl,1000), evidence: cleanReportText(alert.instances[0]?.evidence,1000), status: 'Open' }
  })
  return { raw, targetUrl: target.href, completedAt: new Date(completed).toISOString(), timestampBasis: hasZone ? 'Time zone embedded in report.' : `Report generator time zone selected by administrator: ${input.reportTimeZone}.`, version: cleanReportText(report['@version'],80), findings, counts }
}
