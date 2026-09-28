import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HrmsProvider } from './HrmsContext.js'
import { useHrms } from './useHrms.js'
import { emptySnapshot, employeeIdentity, adminIdentity } from '../test/testContext.js'

const provider = vi.hoisted(() => ({ getCurrentUser:vi.fn(), getSnapshot:vi.fn(), refresh:vi.fn(), signOut:vi.fn(), recordCurrentSession:vi.fn(), subscribeToChanges:vi.fn(), addAnnouncement:vi.fn(), completeEmailSignIn:vi.fn() }))
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

let state: ReturnType<typeof useHrms>
function HandoffHarness() {
  const current = useHrms()
  useEffect(() => { state = current }, [current])
  return null
}
const loadedSnapshot = { ...emptySnapshot, employees: [{ ...employeeIdentity, email: 'employee@example.test', role: 'employee', status: 'Active', department: 'QA', position: 'Tester', avatarUrl: 'https://example.test/avatar' }] }
describe('verified sign-in workspace handoff', () => {
  const start = async () => {
    provider.getCurrentUser.mockResolvedValue(null)
    provider.getSnapshot.mockResolvedValue(emptySnapshot)
    provider.completeEmailSignIn.mockResolvedValue(employeeIdentity)
    provider.signOut.mockResolvedValue(undefined)
    provider.subscribeToChanges.mockReturnValue(() => undefined)
    await act(async () => { render(<HrmsProvider><HandoffHarness /></HrmsProvider>) })
    provider.recordCurrentSession.mockClear()
    provider.subscribeToChanges.mockClear()
  }
  it('returns the verified identity before the snapshot, then supplies its batched avatar', async () => {
    await start()
    let resolve!: (value: typeof emptySnapshot) => void
    provider.getSnapshot.mockImplementation(() => new Promise(done => { resolve = done }))
    await act(async () => { expect(await state.completeEmailSignIn!('employee')).toEqual(employeeIdentity) })
    expect(state.loading).toBe(true)
    expect(state.data).toBeNull()
    expect(state.user?.id).toBe(employeeIdentity.id)
    expect(provider.recordCurrentSession).not.toHaveBeenCalled()
    expect(provider.subscribeToChanges).not.toHaveBeenCalled()
    await act(async () => { resolve(loadedSnapshot) })
    expect(state.loading).toBe(false)
    expect(state.user?.avatarUrl).toBe('https://example.test/avatar')
    expect(provider.subscribeToChanges).toHaveBeenCalledTimes(1)
  })
  it('does not restore private records if logout wins the loading race', async () => {
    await start()
    let resolve!: (value: typeof emptySnapshot) => void
    provider.getSnapshot.mockImplementation(() => new Promise(done => { resolve = done }))
    await act(async () => { await state.completeEmailSignIn!('employee') })
    await act(async () => { await state.logout() })
    await act(async () => { resolve(emptySnapshot) })
    expect(state.user).toBeNull()
    expect(state.data).toBeNull()
    expect(state.loading).toBe(false)
  })
  it('allows an offline workspace load to be retried without re-verifying or signing in again', async () => {
    await start()
    provider.getSnapshot.mockRejectedValue(new Error('Offline'))
    await act(async () => { await state.completeEmailSignIn!('employee') })
    expect(state.user?.id).toBe(employeeIdentity.id)
    expect(state.syncError).toBe(true)
    expect(state.data).toBeNull()
    provider.getSnapshot.mockResolvedValue(loadedSnapshot)
    await act(async () => { await state.retryWorkspaceLoad!() })
    expect(state.syncError).toBe(false)
    expect(state.data).toEqual(loadedSnapshot)
    expect(provider.completeEmailSignIn).toHaveBeenCalledTimes(1)
  })
  it('fails closed when the database revokes access during the initial load', async () => {
    await start()
    provider.getSnapshot.mockRejectedValue({ code: '42501' })
    await act(async () => { await state.completeEmailSignIn!('employee') })
    expect(state.user).toBeNull()
    expect(state.data).toBeNull()
    expect(provider.signOut).toHaveBeenCalledTimes(1)
  })
  it('does not display empty totals if access changes between verification and the snapshot', async () => {
    await start()
    provider.getSnapshot.mockResolvedValue(emptySnapshot)
    await act(async () => { await state.completeEmailSignIn!('employee') })
    expect(state.user).toBeNull()
    expect(state.data).toBeNull()
    expect(provider.signOut).toHaveBeenCalledTimes(1)
  })
})
