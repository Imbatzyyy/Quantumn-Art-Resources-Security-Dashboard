import { describe, expect, it } from 'vitest'
import { businessDate, isOpenSecurityAlert, securitySeverityOrder, attendanceForClock, isUnclosedPastShift } from './securityMetrics.js'
import { parseZapReport } from '../../netlify/functions/_shared/zap-report.mjs'

const report = () => ({ '@version': '2.16.1', '@generated': '2026-09-13T00:00:00Z', site: [{ '@name': 'https://quantumnhr.com', alerts: [] as object[] }] })
describe('security metric definitions', () => {
  it('keeps an overnight shift available for clock-out without prematurely flagging it', () => {
    const row = { id:'1',employeeId:'EMP1',date:'2026-09-13',clockIn:'22:00',clockOut:null,hours:0,status:'Present' }
    const morning = new Date('2026-09-14T07:00:00+08:00')
    expect(attendanceForClock([row], 'EMP1', morning)).toBe(row)
    expect(isUnclosedPastShift(row, morning)).toBe(false)
    expect(isUnclosedPastShift(row, new Date('2026-09-14T23:00:00+08:00'))).toBe(true)
  })
  it('uses the Philippine business day across UTC midnight', () => {
    expect(businessDate(new Date('2026-09-13T16:05:00Z'))).toBe('2026-09-14')
    expect(businessDate(new Date('2026-09-13T15:59:00Z'))).toBe('2026-09-13')
  })
  it('includes acknowledged alerts until closed, excluding false positives', () => {
    for (const status of ['New','Acknowledged','Investigating','Confirmed','Contained']) expect(isOpenSecurityAlert(status)).toBe(true)
    expect(isOpenSecurityAlert('False Positive')).toBe(false)
    expect(isOpenSecurityAlert('Resolved')).toBe(false)
    expect(securitySeverityOrder('Critical')).toBeLessThan(securitySeverityOrder('High'))
  })
})
describe('ZAP evidence integrity', () => {
  it('matches the selected website even when the linked backend appears first', () => {
    const value=report()
    value.site.unshift({ '@name':'https://ndzgmrmpsqqpcmoxvyfu.supabase.co', alerts:[] })
    expect(parseZapReport({report:value,targetUrl:'https://quantumnhr.com'}).targetUrl).toBe('https://quantumnhr.com/')
    value.site[0]['@name']='https://unrelated.supabase.co'
    expect(()=>parseZapReport({report:value,targetUrl:'https://quantumnhr.com'})).toThrow(/scope/)
  })
  it('requires an explicit generator time zone for traditional ZAP timestamps', () => {
    const value={...report(),'@generated':'Mon, 14 Sept 2026 16:51:05'}
    expect(()=>parseZapReport({report:value})).toThrow(/time zone/)
    expect(parseZapReport({report:value,reportTimeZone:'UTC'}).completedAt).toBe('2026-09-14T16:51:05.000Z')
    expect(parseZapReport({report:value,reportTimeZone:'Asia/Manila'}).completedAt).toBe('2026-09-14T08:51:05.000Z')
  })
  it('accepts an empty finding list only inside a valid dated report', () => {
    const parsed = parseZapReport({ report: report() })
    expect(parsed.findings).toEqual([])
    expect(parsed.completedAt).toBe('2026-09-13T00:00:00.000Z')
  })
  it('rejects unrelated JSON, even with an allowed target override', () => {
    expect(() => parseZapReport({ report: { message: 'not a scan' }, targetUrl: 'https://quantumnhr.com' })).toThrow()
  })
  it('rejects a foreign scanned site concealed by a target override', () => {
    const value=report(); value.site[0]['@name']='https://example.com'
    expect(() => parseZapReport({ report: value, targetUrl:'https://quantumnhr.com' })).toThrow()
  })
  it('rejects malformed or future dates and unsupported assurance claims', () => {
    expect(() => parseZapReport({ report:{ ...report(), '@generated':'unknown' } })).toThrow()
    expect(() => parseZapReport({ report:{ ...report(), '@generated':'2999-01-01' } })).toThrow()
    expect(() => parseZapReport({ report:report(), scanType:'Authenticated' })).toThrow()
  })
  it('rejects partial imports and cross-origin finding instances', () => {
    const value=report()
    const alert={ pluginid:'10000', alert:'Test finding', riskcode:'1', instances:[{ uri:'https://quantumnhr.com/employee/login' }] }
    value.site[0].alerts=Array(501).fill(alert)
    expect(() => parseZapReport({ report:value })).toThrow(/500/)
    value.site[0].alerts=[{ ...alert, instances:[{ uri:'https://example.com' }] }]
    expect(() => parseZapReport({ report:value })).toThrow()
  })
})
