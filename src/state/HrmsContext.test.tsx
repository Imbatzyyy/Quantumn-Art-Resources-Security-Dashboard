import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HrmsProvider } from './HrmsContext.js'
import { useHrms } from './useHrms.js'
import { emptySnapshot, employeeIdentity, adminIdentity } from '../test/testContext.js'

const provider = vi.hoisted(() => ({ getCurrentUser:vi.fn(), getSnapshot:vi.fn(), refresh:vi.fn(), signOut:vi.fn(), recordCurrentSession:vi.fn(), subscribeToChanges:vi.fn(), addAnnouncement:vi.fn() }))
vi.mock('../services/dataProvider.js', () => ({ dataProvider:provider }))
function Harness() {
  const { user, syncError, addAnnouncement }=useHrms()
  return <><p>{user ? 'Signed in' : 'Signed out'}</p><p>{syncError ? 'Stale' : 'Current'}</p><button onClick={() => void addAnnouncement({title:'Test',content:'Test message',priority:'Normal'})}>Publish</button></>
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })
const setup=async (portal:'admin'|'employee') => {
  vi.useFakeTimers()
  provider.getCurrentUser.mockImplementation(async () => ({ ...(portal==='admin' ? adminIdentity : employeeIdentity) }))
  provider.getSnapshot.mockResolvedValue(emptySnapshot)
  provider.refresh.mockResolvedValue(emptySnapshot)
  provider.signOut.mockResolvedValue(undefined)
  provider.recordCurrentSession.mockResolvedValue('SES-TEST')
  provider.subscribeToChanges.mockReturnValue(() => undefined)
  await act(async () => { render(<HrmsProvider><Harness /></HrmsProvider>) })
}
describe('session refresh and mutation boundaries', () => {
  for (const [portal,minutes] of [['admin',15],['employee',30]] as const) {
    it(`${portal} inactivity expires even when background refresh replaces the identity object`,async () => {
      await setup(portal)
      for(let minute=0;minute<=minutes;minute++) await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
      expect(provider.signOut).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Signed out')).toBeInTheDocument()
    })
  }
  it('failed background refresh exposes stale state rather than claiming a successful sync',async () => {
    await setup('employee')
    provider.refresh.mockRejectedValue(new Error('Offline'))
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(screen.getByText('Stale')).toBeInTheDocument()
  })
  it('clears the workspace on inactivity even when the sign-out network request fails',async () => {
    await setup('admin')
    provider.signOut.mockRejectedValue(new Error('Offline'))
    for(let minute=0;minute<=15;minute++) await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(screen.getByText('Signed out')).toBeInTheDocument()
    expect(provider.getSnapshot).toHaveBeenCalledTimes(1)
  })
  it('clears private data when the database revokes the session instead of showing it as merely offline',async () => {
    await setup('employee')
    provider.getCurrentUser.mockRejectedValue({ code:'42501', message:'Session revoked' })
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(screen.getByText('Signed out')).toBeInTheDocument()
    expect(provider.signOut).toHaveBeenCalledTimes(1)
  })
  it('coalesces a duplicate pending announcement submission',async () => {
    await setup('admin')
    let finish!: (data:typeof emptySnapshot)=>void
    provider.addAnnouncement.mockImplementation(() => new Promise(resolve => {finish=resolve}))
    fireEvent.click(screen.getByRole('button',{name:'Publish'})); fireEvent.click(screen.getByRole('button',{name:'Publish'}))
    expect(provider.addAnnouncement).toHaveBeenCalledTimes(1)
    await act(async () => {finish(emptySnapshot)})
  })
})
