import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { dataProvider } from '../services/dataProvider.js'
import { HrmsState } from './HrmsState.js'
import { securityOperation } from '../services/supabaseSecurityApi.js'
import { requireSupabase } from '../services/supabaseClient.js'
import type {
  HrmsContextValue,
  HrmsSnapshot,
  AuthenticationResult,
  PortalIdentity,
  ToastMessage,
  ToastTone,
} from '../types/hrms.js'

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message
  : 'The request could not be completed.'

const isIdentity = (result: AuthenticationResult): result is PortalIdentity =>
  !('mfaRequired' in result) && !('emailVerificationRequired' in result)

const getSecurityOverview: NonNullable<HrmsContextValue['getSecurityOverview']> = (windowDays) => securityOperation({ action: 'security-overview', windowDays })
const getSecurityAccountOptions = async () => {
  const { data, error } = await requireSupabase().rpc('security_account_options')
  if (error) throw error
  return data
}

export function HrmsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HrmsSnapshot | null>(null)
  const [user, setUser] = useState<PortalIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const toastSequence = useRef(0)
  const userId = user?.id
  const userPortal = user?.portal
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState(false)
  const mutations = useRef(new Map<unknown, Promise<HrmsSnapshot>>())

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    toastSequence.current += 1
    setToast({ id: toastSequence.current, message, tone, exiting: false })
  }, [])

  useEffect(() => {
    if (!toast?.id) return undefined

    const toastId = toast.id
    const fadeTimer = window.setTimeout(() => {
      setToast((current) => current?.id === toastId
        ? { ...current, exiting: true }
        : current)
    }, 3200)
    const removalTimer = window.setTimeout(() => {
      setToast((current) => current?.id === toastId ? null : current)
    }, 3600)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(removalTimer)
    }
  }, [toast?.id])

  useEffect(() => {
    let active = true

    const restore = async () => {
      try {
        // Recovery/setup owns the pre-verification Auth session on these routes.
        if (/\/(reset-password|setup-password|verify-email)$/.test(window.location.pathname)) return
        const restoredUser = await dataProvider.getCurrentUser()
        if (restoredUser && !restoredUser.mustChangePassword && !restoredUser.mustSetPassword && dataProvider.recordCurrentSession) {
          await dataProvider.recordCurrentSession()
        }
        const snapshot = await dataProvider.getSnapshot()

        if (active) {
          setUser(restoredUser)
          setData(snapshot)
          setLastSyncedAt(new Date().toISOString())
          setSyncError(false)
        }
      } catch (error: unknown) {
        if (active) {
          setUser(null)
          setData(null)
          notify(errorMessage(error), 'error')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    restore()
    return () => {
      active = false
    }
  }, [notify])

  useEffect(() => {
    if (!userId) return undefined

    let active = true
    let syncing = false
    const sync = async () => {
      if (syncing || /\/(reset-password|setup-password)$/.test(window.location.pathname)) return
      syncing = true
      try {
        const refreshedUser = await dataProvider.getCurrentUser()
        if (!refreshedUser) {
          if (active) { setUser(null); setData(null) }
          return
        }
        if (!refreshedUser.mustChangePassword && !refreshedUser.mustSetPassword && dataProvider.recordCurrentSession) await dataProvider.recordCurrentSession()
        const snapshot = dataProvider.refresh
          ? await dataProvider.refresh()
          : await dataProvider.getSnapshot()
        if (active) {
          setData(snapshot)
          setUser(refreshedUser)
          setLastSyncedAt(new Date().toISOString())
          setSyncError(false)
        }
      } catch (error: unknown) {
        if (active) {
          if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42501') {
            setUser(null); setData(null)
            void dataProvider.signOut?.().catch(() => undefined)
          } else setSyncError(true)
        }
      } finally {
        syncing = false
      }
    }

    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const interval = window.setInterval(syncWhenVisible, 60000)
    const unsubscribe = dataProvider.subscribeToChanges
      ? dataProvider.subscribeToChanges(sync)
      : undefined
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      if (unsubscribe) unsubscribe()
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    const timeoutMs = userPortal === 'admin' ? 15 * 60 * 1000 : 30 * 60 * 1000
    let timeout: number | undefined
    const expire = async () => {
      try {
        if (dataProvider.signOut) await dataProvider.signOut()
      } catch {
        // An unavailable network must never retain the private workspace on expiry.
      } finally {
        setUser(null)
        setData(null)
        notify('You were signed out after a period of inactivity.', 'error')
      }
    }
    const reset = () => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(expire, timeoutMs)
    }
    const events = ['click', 'keydown', 'pointerdown', 'touchstart']

    events.forEach((eventName) => window.addEventListener(eventName, reset, { passive: true }))
    reset()
    return () => {
      window.clearTimeout(timeout)
      events.forEach((eventName) => window.removeEventListener(eventName, reset))
    }
  }, [notify, userId, userPortal])

  const run = async (
    operation: () => Promise<HrmsSnapshot>,
    successMessage?: string,
    options: { reportError?: boolean } = {},
  ) => {
    const mutationKey = successMessage || operation
    const pending = mutations.current.get(mutationKey)
    if (pending) return pending
    const task = operation()
    mutations.current.set(mutationKey, task)
    try {
      const snapshot = await task
      setData(snapshot)
      setLastSyncedAt(new Date().toISOString())
      setSyncError(false)
      if (successMessage) notify(successMessage)
      return snapshot
    } catch (error: unknown) {
      if (options.reportError !== false) notify(errorMessage(error), 'error')
      throw error
    } finally {
      mutations.current.delete(mutationKey)
    }
  }

  const value: HrmsContextValue = {
      data,
      user,
      loading,
      lastSyncedAt,
      syncError,
      getSecurityOverview,
      getSecurityAccountOptions,
      toast,
      notify,
      async login(credentials) {
        // Never retain another portal's identity/data while a new sign-in is
        // waiting for email verification or an authenticator challenge.
        setUser(null)
        setData(null)
        const authenticated = await dataProvider.authenticate(credentials)
        if (!isIdentity(authenticated)) return authenticated
        if (dataProvider.recordCurrentSession) await dataProvider.recordCurrentSession()
        const snapshot = await dataProvider.getSnapshot()
        setUser(authenticated)
        setData(snapshot)
        return authenticated
      },
      async completeEmailSignIn(portal) {
        if (!dataProvider.completeEmailSignIn) throw new Error('Email verification is unavailable.')
        const authenticated = await dataProvider.completeEmailSignIn(portal)
        if (!isIdentity(authenticated)) return authenticated
        if (dataProvider.recordCurrentSession) await dataProvider.recordCurrentSession()
        const snapshot = await dataProvider.getSnapshot()
        setUser(authenticated)
        setData(snapshot)
        return authenticated
      },
      async verifyMfaLogin(input) {
        const authenticated = await dataProvider.verifyMfaLogin(input)
        if (dataProvider.recordCurrentSession) await dataProvider.recordCurrentSession()
        const snapshot = await dataProvider.getSnapshot()
        setUser(authenticated)
        setData(snapshot)
        return authenticated
      },
      async logout() {
        if (dataProvider.signOut) await dataProvider.signOut()
        setUser(null)
        setData(await dataProvider.getSnapshot())
      },
      addEmployee: (input) => run(() => dataProvider.addEmployee(input), 'Employee created and temporary credentials emailed securely.'),
      inviteAdminAccount: (input) => run(() => dataProvider.inviteAdminAccount(input), 'Administrator invitation sent securely.'),
      async completeAdminInvitation(input) {
        const result = await dataProvider.completeAdminInvitation(input)
        setUser(null)
        setData(await dataProvider.getSnapshot())
        notify('Administrator password created. Sign in with your new credentials.')
        return result
      },
      async completeInitialPassword(input) {
        const snapshot = await dataProvider.completeInitialPassword(input)
        const refreshedUser = await dataProvider.getCurrentUser()
        setUser(refreshedUser)
        setData(snapshot)
        notify('Your private password is ready. Welcome to Quantum HRMS.')
        return refreshedUser
      },
      async updateEmployee(id, changes) {
        const snapshot = await run(
          () => dataProvider.updateEmployee(id, changes),
          'Employee profile updated.',
        )
        if (user?.id === id) {
          const updatedUser = await dataProvider.getCurrentUser()
          setUser(updatedUser)
        }
        return snapshot
      },
      async updateProfilePhoto(photo) {
        const snapshot = await run(
          () => dataProvider.updateProfilePhoto(photo),
          'Profile photo updated securely.',
          { reportError: false },
        )
        const updatedUser = await dataProvider.getCurrentUser()
        setUser(updatedUser)
        return snapshot
      },
      submitLeave: (input) => run(() => dataProvider.submitLeave(input), 'Leave request submitted.'),
      reviewLeave: (id, status) => run(() => dataProvider.reviewLeave(id, status), `Leave request ${status.toLowerCase()}.`),
      submitRequest: (input) => run(() => dataProvider.submitRequest(input), 'Request submitted to HR.'),
      reviewRequest: (id, status, reason) => run(() => dataProvider.reviewRequest(id, status, reason), `Request marked ${status.toLowerCase()}.`),
      addRequestComment: (id, body, internal) => run(() => dataProvider.addRequestComment(id, body, internal), 'Response added.'),
      cancelRequest: (id) => run(() => dataProvider.cancelRequest(id), 'Request cancelled.'),
      markNotificationRead: (id) => run(() => dataProvider.markNotificationRead(id)),
      markAllNotificationsRead: () => run(() => dataProvider.markAllNotificationsRead(), 'Notifications marked as read.'),
      acknowledgeDocument: (id) => run(() => dataProvider.acknowledgeDocument(id), 'Document acknowledged.'),
      updateGoalProgress: (id, progress) => run(() => dataProvider.updateGoalProgress(id, progress), 'Goal progress updated.'),
      clock: (employeeId) => run(() => dataProvider.clock(employeeId), 'Attendance record updated.'),
      updateAlert: (id, status) => run(() => dataProvider.updateAlert(id, status), `Alert marked ${status.toLowerCase()}.`),
      addSecurityAlert: (input) => run(() => dataProvider.addSecurityAlert(input), 'Security alert created and added to the live investigation queue.'),
      respondToAlert: (id, action, note) => run(
        () => dataProvider.respondToAlert(id, action, note),
        action === 'This was me' ? 'Activity marked as recognized.' : 'Activity reported for security review.',
      ),
      updateSecurityInvestigation: (input) => run(
        () => dataProvider.updateSecurityInvestigation(input),
        `Alert marked ${input.status.toLowerCase()}.`,
      ),
      importZapReport: (input) => run(
        () => dataProvider.importZapReport(input),
        'OWASP ZAP report verified and imported.',
      ),
      endSession: (id) => run(() => dataProvider.endSession(id), 'Unfamiliar session ended.'),
      changePassword: (input) => run(() => dataProvider.changePassword(input), 'Password changed successfully.'),
      getMfaStatus: dataProvider.getMfaStatus,
      getOrganizationSecuritySummary: dataProvider.getOrganizationSecuritySummary,
      beginMfaEnrollment: () => dataProvider.beginMfaEnrollment(),
      verifyMfaEnrollment: (input) => dataProvider.verifyMfaEnrollment(input),
      disableMfa: (factorId) => dataProvider.disableMfa(factorId),
      addAnnouncement: (input) => run(() => dataProvider.addAnnouncement(input), 'Announcement published.'),
      createDocument: (input) => run(() => dataProvider.createDocument(input), 'Document published securely.'),
      saveSchedule: (input) => run(() => dataProvider.saveSchedule(input), 'Work schedule saved.'),
      saveBenefit: (input) => run(() => dataProvider.saveBenefit(input), 'Benefit record saved.'),
      saveGoal: (input) => run(() => dataProvider.saveGoal(input), 'Employee goal saved.'),
      createLifecycleCase: (input) => run(() => dataProvider.createLifecycleCase(input), `${input.type} checklist created.`),
      updateLifecycleTask: (id, status) => run(() => dataProvider.updateLifecycleTask(id, status), 'Lifecycle task updated.'),
      generatePayroll: (input) => run(() => dataProvider.generatePayroll(input), 'Payroll draft generated for all active employees.'),
      transitionPayrollRun: (id, status) => run(() => dataProvider.transitionPayrollRun(id, status), `Payroll run moved to ${status}.`),
      savePerformance: (input) => run(() => dataProvider.savePerformance(input), 'Performance review saved.'),
      publishPerformance: (id) => run(() => dataProvider.publishPerformance(id), 'Performance review published to the employee.'),
      createPerformanceCycle: (input) => run(() => dataProvider.createPerformanceCycle(input), 'Performance cycle created.'),
      recordActivity: (input) => run(() => dataProvider.recordActivity(input)),
      refreshData: () => run(
        () => dataProvider.refresh ? dataProvider.refresh() : dataProvider.getSnapshot(),
        'Latest records loaded.',
      ),
    }

  return <HrmsState.Provider value={value}>{children}</HrmsState.Provider>
}
