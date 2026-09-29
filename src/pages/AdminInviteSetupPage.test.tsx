import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { createTestContext } from '../test/testContext.js'
import AdminInviteSetupPage from './AdminInviteSetupPage.js'

const invitation = { email: 'sierra.reviewer@quantum.example', firstName: 'Sierra', lastName: 'Reviewer', role: 'security_admin' }

describe('Administrator invitation setup', () => {
  it('shows the invited account and activates it only with a policy-compliant password', async () => {
    const user = userEvent.setup()
    const completeAdminInvitation = vi.fn(async () => null)
    render(
      <MemoryRouter>
        <HrmsState.Provider value={createTestContext({ completeAdminInvitation })}>
          <AdminInviteSetupPage preview={invitation} />
        </HrmsState.Provider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Create your private password' })).toBeVisible()
    const account = screen.getByLabelText('Invited account')
    expect(within(account).getByText('sierra.reviewer@quantum.example')).toBeVisible()
    expect(within(account).getByText('Security Administrator', { exact: true })).toBeVisible()

    const password = screen.getByLabelText('New password')
    const confirmation = screen.getByLabelText('Confirm new password')
    expect(password).toHaveAccessibleDescription(/At least 15 characters/)
    const activate = screen.getByRole('button', { name: 'Create password & activate account' })
    expect(activate).toBeDisabled()
    expect(screen.getAllByText(/^Not met yet:/)).toHaveLength(4)

    await user.type(password, 'Sierra reviewer passphrase 2026')
    await user.type(confirmation, 'Sierra reviewer passphrase 2026')
    fireEvent.submit(password.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(/name|email|Quantum HRMS/i)
    expect(completeAdminInvitation).not.toHaveBeenCalled()

    await user.clear(password)
    await user.clear(confirmation)
    await user.type(password, 'Lavender trains orbit quietly 2026!')
    await user.type(confirmation, 'Lavender trains orbit quietly')
    expect(screen.getByText('The passwords do not match yet.')).toBeVisible()
    expect(activate).toBeDisabled()

    await user.type(confirmation, ' 2026!')
    expect(screen.getByText('Passwords match.')).toBeVisible()
    await user.click(activate)
    expect(completeAdminInvitation).toHaveBeenCalledWith({ newPassword: 'Lavender trains orbit quietly 2026!' })
    expect(await screen.findByRole('heading', { name: 'Your administrator account is ready' })).toBeVisible()
  })
})
