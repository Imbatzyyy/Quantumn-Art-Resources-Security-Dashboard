import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { createTestContext, employeeIdentity, emptySnapshot } from '../test/testContext.js'
import type { HrmsContextValue } from '../types/hrms.js'
import EmployeeAccountSecurity from './EmployeeAccountSecurity.js'

function renderSecurity(context: HrmsContextValue) {
  return render(
    <HrmsState.Provider value={context}>
      <EmployeeAccountSecurity />
    </HrmsState.Provider>,
  )
}

describe('Employee Account Security', () => {
  it('blocks weak passwords locally and sends an accepted passphrase only through the provider', async () => {
    const user = userEvent.setup()
    const changePassword = vi.fn(async () => emptySnapshot)
    renderSecurity(createTestContext({
      user: employeeIdentity,
      changePassword,
      getMfaStatus: async () => ({ enabled: true, factorId: 'factor-1', currentLevel: 'aal2' }),
    }))

    await user.click(screen.getByRole('button', { name: 'Change password' }))
    const dialog = screen.getByRole('dialog', { name: 'Change your password' })
    const current = within(dialog).getByLabelText('Current password')
    const next = within(dialog).getByLabelText(/^New private password/)
    const confirmation = within(dialog).getByLabelText('Confirm password')
    await user.type(current, 'Current private passphrase 2025!')
    await user.type(next, 'too short')
    await user.type(confirmation, 'too short')
    fireEvent.submit(dialog.querySelector('form')!)

    expect(await within(dialog).findByText('Use at least 15 characters. A memorable passphrase works well.')).toBeVisible()
    expect(changePassword).not.toHaveBeenCalled()

    await user.clear(next)
    await user.clear(confirmation)
    await user.type(next, 'Lavender trains orbit quietly 2026!')
    await user.type(confirmation, 'Lavender trains orbit quietly 2026!')
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'Current private passphrase 2025!',
      newPassword: 'Lavender trains orbit quietly 2026!',
      confirmPassword: 'Lavender trains orbit quietly 2026!',
    }))
    expect(screen.queryByRole('dialog', { name: 'Change your password' })).not.toBeInTheDocument()
  })

  it('reveals password values only on request and clears every credential when dismissed', async () => {
    const user = userEvent.setup()
    renderSecurity(createTestContext({
      user: employeeIdentity,
      getMfaStatus: async () => ({ enabled: true, factorId: 'factor-1', currentLevel: 'aal2' }),
    }))

    await user.click(screen.getByRole('button', { name: 'Change password' }))
    let dialog = screen.getByRole('dialog', { name: 'Change your password' })
    const current = within(dialog).getByLabelText('Current password')
    const next = within(dialog).getByLabelText('New private password')
    const confirmation = within(dialog).getByLabelText('Confirm password')
    const submit = within(dialog).getByRole('button', { name: 'Update my password' })

    expect(current).toHaveAttribute('type', 'password')
    expect(next).toHaveAttribute('type', 'password')
    expect(confirmation).toHaveAttribute('type', 'password')
    expect(submit).toBeDisabled()

    await user.type(current, 'Current private passphrase 2025!')
    await user.type(next, 'Lavender trains orbit quietly 2026!')
    await user.type(confirmation, 'Lavender trains orbit quietly 2026!')
    expect(within(dialog).getByText('Passwords match.')).toBeVisible()
    expect(within(dialog).getByText('Very strong')).toBeVisible()
    expect(submit).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: 'Show password values' }))
    expect(current).toHaveAttribute('type', 'text')
    expect(next).toHaveAttribute('type', 'text')
    expect(confirmation).toHaveAttribute('type', 'text')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Change your password' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change password' }))
    dialog = screen.getByRole('dialog', { name: 'Change your password' })
    expect(within(dialog).getByLabelText('Current password')).toHaveValue('')
    expect(within(dialog).getByLabelText('New private password')).toHaveValue('')
    expect(within(dialog).getByLabelText('Confirm password')).toHaveValue('')
    expect(within(dialog).getByLabelText('Current password')).toHaveAttribute('type', 'password')
  })

  it('keeps authenticator enrollment employee-owned and verifies a six-digit code', async () => {
    const user = userEvent.setup()
    const beginMfaEnrollment = vi.fn(async () => ({
      factorId: 'factor-new',
      qrCode: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
      secret: 'TEST-ONLY-SECRET',
    }))
    const verifyMfaEnrollment = vi.fn(async () => ({ enabled: true, factorId: 'factor-new', currentLevel: 'aal2' }))
    const refreshData = vi.fn(async () => emptySnapshot)
    renderSecurity(createTestContext({
      user: employeeIdentity,
      beginMfaEnrollment,
      verifyMfaEnrollment,
      refreshData,
    }))

    const setup = await screen.findByRole('button', { name: 'Set up MFA' })
    await user.click(setup)
    await waitFor(() => expect(beginMfaEnrollment).toHaveBeenCalledTimes(1))
    const dialog = screen.getByRole('dialog', { name: 'Set up authenticator MFA' })
    expect(within(dialog).getByText('TEST-ONLY-SECRET')).toBeVisible()
    const enable = within(dialog).getByRole('button', { name: 'Enable my MFA' })
    expect(enable).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Authenticator code'), '12a34b56')
    expect(within(dialog).getByLabelText('Authenticator code')).toHaveValue('123456')
    expect(enable).toBeEnabled()
    await user.click(enable)

    await waitFor(() => expect(verifyMfaEnrollment).toHaveBeenCalledWith({ factorId: 'factor-new', code: '123456' }))
    expect(refreshData).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Set up authenticator MFA' })).not.toBeInTheDocument()
  })

  it('records the employee response to an alert and revokes only the selected other session', async () => {
    const user = userEvent.setup()
    const respondToAlert = vi.fn(async () => emptySnapshot)
    const endSession = vi.fn(async () => emptySnapshot)
    const alert = {
      id: 'ALT-EMP-1',
      employeeId: employeeIdentity.id,
      status: 'New',
      severity: 'High',
      confidence: 'High',
      title: 'Was this sign-in yours?',
      description: 'A new browser signed in to your account.',
      affected: 'Employee Tester',
      time: 'Aug 30, 2026, 3:00 PM',
      whyItMatters: 'An unknown session may have access to your work account.',
      recommendedAction: 'Tell us whether you recognize this activity.',
      createdAt: '2026-08-30T07:00:00.000Z',
    }
    const otherSession = {
      id: 'SES-OTHER-1',
      employeeId: employeeIdentity.id,
      device: 'Safari on iPhone',
      location: 'Quezon City, PH',
      assuranceLevel: 'aal1',
      current: false,
      createdAt: '2026-08-30T07:00:00.000Z',
      trustStatus: 'Review',
    }
    renderSecurity(createTestContext({
      user: employeeIdentity,
      data: { ...emptySnapshot, securityAlerts: [alert], sessions: [otherSession] },
      respondToAlert,
      endSession,
      getMfaStatus: async () => ({ enabled: true, factorId: 'factor-1', currentLevel: 'aal2' }),
    }))

    await user.click(screen.getByRole('button', { name: 'My alerts' }))
    await user.click(screen.getByRole('button', { name: 'Review' }))
    const alertDialog = screen.getByRole('dialog', { name: `Review ${alert.id}` })
    await user.click(within(alertDialog).getByRole('button', { name: 'This was not me' }))
    await waitFor(() => expect(respondToAlert).toHaveBeenCalledWith(alert.id, 'This was not me'))

    await user.click(screen.getByRole('button', { name: 'My sessions' }))
    await user.click(screen.getByRole('button', { name: 'End other sessions' }))
    const sessionDialog = screen.getByRole('dialog', { name: 'End other sessions' })
    await user.click(within(sessionDialog).getByRole('button', { name: 'End other sessions' }))
    await waitFor(() => expect(endSession).toHaveBeenCalledWith(otherSession.id))
  })
})
