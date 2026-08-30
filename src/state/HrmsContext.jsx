import { useCallback, useEffect, useRef, useState } from 'react'
import { dataProvider } from '../services/dataProvider.js'
import { HrmsState } from './HrmsState.js'

export function HrmsProvider({ children }) {
  const [data, setData] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const toastSequence = useRef(0)

  const notify = useCallback((message, tone = 'success') => {
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
        const restoredUser = await dataProvider.getCurrentUser()
        if (restoredUser && dataProvider.recordCurrentSession) {
          await dataProvider.recordCurrentSession()
        }
        const snapshot = await dataProvider.getSnapshot()

        if (active) {
          setUser(restoredUser)
          setData(snapshot)
        }
      } catch (error) {
        if (active) {
          setUser(null)
          setData(null)
          notify(error.message, 'error')
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
    if (!user) return undefined

    let active = true
    let syncing = false
    const sync = async () => {
      if (syncing) return
      syncing = true
      try {
        if (dataProvider.recordCurrentSession) await dataProvider.recordCurrentSession()
        const snapshot = dataProvider.refresh
          ? await dataProvider.refresh()
          : await dataProvider.getSnapshot()
        const refreshedUser = await dataProvider.getCurrentUser()
        if (active) {
          setData(snapshot)
          setUser(refreshedUser)
        }
      } catch {
        // Background synchronization is intentionally quiet; an explicit
        // refresh still reports useful errors to the user.
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
  }, [user])

  useEffect(() => {
    if (!user) return undefined

    const timeoutMs = user.portal === 'admin' ? 15 * 60 * 1000 : 30 * 60 * 1000
    let timeout
    const expire = async () => {
      try {
        if (dataProvider.signOut) await dataProvider.signOut()
      } finally {
        setUser(null)
        setData(await dataProvider.getSnapshot())
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
  }, [notify, user])

  const run = async (operation, successMessage) => {
    try {
      const snapshot = await operation()
      setData(snapshot)
      if (successMessage) notify(successMessage)
      return snapshot
    } catch (error) {
      notify(error.message || 'The request could not be completed.', 'error')
      throw error
    }
  }

  const value = {
      data,
      user,
      loading,
      toast,
      notify,
      async login(credentials) {
        const authenticated = await dataProvider.authenticate(credentials)
        if (authenticated?.mfaRequired) return authenticated
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
      getMfaStatus: () => dataProvider.getMfaStatus(),
      getOrganizationSecuritySummary: () => dataProvider.getOrganizationSecuritySummary(),
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
      recordActivity: (input) => run(() => dataProvider.recordActivity({
        ...input,
        actor: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      })),
      refreshData: () => run(
        () => dataProvider.refresh ? dataProvider.refresh() : dataProvider.getSnapshot(),
        'Latest records loaded.',
      ),
    }

  return <HrmsState.Provider value={value}>{children}</HrmsState.Provider>
}
