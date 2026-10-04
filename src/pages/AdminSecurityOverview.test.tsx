import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { createTestContext } from '../test/testContext.js'
import AdminSecurityOverview, { type SecurityOverviewData } from './AdminSecurityOverview.js'

const snapshot: SecurityOverviewData = {
  asOf:'2026-09-14T00:00:00Z',windowDays:30,
  accounts:{total:4,mfaEnabled:2,privileged:2,privilegedMfaEnabled:1},
  alerts:{open:3,critical:1,resolvedInWindow:5,falsePositivesInWindow:1},
  sessions:{observedRecently:2,legacyObservations:3},
  trend:[{date:'2026-09-14',total:3,high:1}],
  bySeverity:[{severity:'Critical',total:1},{severity:'High',total:2}],byStatus:[],latestScan:null,recentAlerts:[],
}
const mount=(read=vi.fn().mockResolvedValue(snapshot))=>{
  const navigate=vi.fn()
  render(<HrmsState.Provider value={createTestContext({getSecurityOverview:read})}><AdminSecurityOverview onNavigate={navigate}/></HrmsState.Provider>)
  return {read,navigate}
}
describe('security overview data and recovery states',()=>{
  it('renders measured coverage and distinguishes observed sessions from online people',async()=>{
    mount()
    expect(await screen.findByText('50%')).toBeVisible()
    expect(screen.getByText('Observed in 15 minutes · not online users')).toBeVisible()
    expect(screen.getByText(/No scan evidence has been recorded/)).toBeVisible()
  })
  it('requests a selected time window and drills into severity-filtered alerts',async()=>{
    const {read,navigate}=mount()
    await screen.findByText('50%')
    fireEvent.change(screen.getByLabelText('Trend period'),{target:{value:'7'}})
    await waitFor(()=>expect(read).toHaveBeenLastCalledWith(7))
    fireEvent.click(screen.getByRole('button',{name:'View High alerts'}))
    expect(navigate).toHaveBeenCalledWith('security:High')
  })
  it('keeps the last snapshot explicitly stale after a failed refresh and can retry',async()=>{
    const {read}=mount()
    await screen.findByText('50%')
    read.mockRejectedValueOnce(new Error('Offline'))
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Refresh security statistics'})))
    expect(screen.getByRole('alert')).toHaveTextContent('could not be refreshed')
    expect(screen.getByText('Stale snapshot')).toBeVisible()
    expect(screen.getByText('50%')).toBeVisible()
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Refresh security statistics'})))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('does not show zero protection statistics when the initial request fails',async()=>{
    mount(vi.fn().mockRejectedValue(new Error('Unavailable')))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Refresh security statistics'})).toBeEnabled()
  })
})
