import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { createTestContext, employeeIdentity } from '../test/testContext.js'
import FirstLoginPasswordSetup from './FirstLoginPasswordSetup.js'
import { TERMS_VERSION, PRIVACY_VERSION } from '../utils/accountPolicies.js'

describe('First sign-in password setup', () => {
  it('labels every field plainly and saves only a policy-compliant replacement', async () => {
    const user = userEvent.setup()
    const completeInitialPassword = vi.fn(async () => null)
    render(
      <HrmsState.Provider value={createTestContext({ user: { ...employeeIdentity, mustChangePassword: true }, completeInitialPassword })}>
        <FirstLoginPasswordSetup />
      </HrmsState.Provider>,
    )

    let dialog = screen.getByRole('dialog', { name: 'Secure your employee account' })
    expect(within(dialog).queryByLabelText('New password')).not.toBeInTheDocument()
    const proceed = within(dialog).getByRole('button', { name: 'Continue to password' })
    expect(proceed).toBeDisabled()
    await user.click(within(dialog).getByLabelText('I have read and agree to the Terms and Conditions.'))
    expect(proceed).toBeDisabled()
    await user.click(within(dialog).getByLabelText('I have read and acknowledge the Privacy Notice.'))
    await user.click(proceed)
    dialog = screen.getByRole('dialog', { name: 'Secure your employee account' })
    expect(within(dialog).getByRole('heading', { name: 'Create your private password' })).toBeVisible()
    const temporary = within(dialog).getByLabelText('Temporary password')
    const next = within(dialog).getByLabelText('New password')
    const confirmation = within(dialog).getByLabelText('Confirm new password')
    expect(temporary).toHaveAccessibleDescription(/welcome email/)
    const save = within(dialog).getByRole('button', { name: 'Save password & enter workspace' })
    expect(save).toBeDisabled()
    expect(within(dialog).getAllByText(/^Not met yet:/)).toHaveLength(5)

    await user.type(temporary, 'Temporary private passphrase 1!')
    await user.type(next, 'too short')
    await user.type(confirmation, 'too short')
    fireEvent.submit(dialog.querySelector('form')!)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Use at least 15 characters')
    expect(completeInitialPassword).not.toHaveBeenCalled()

    await user.clear(next)
    await user.clear(confirmation)
    await user.type(next, 'Lavender trains orbit quietly 2026!')
    await user.type(confirmation, 'Lavender trains orbit quietly 2026!')
    expect(within(dialog).getByText('Passwords match.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Show passwords' }))
    expect(next).toHaveAttribute('type', 'text')
    await user.click(save)
    expect(completeInitialPassword).toHaveBeenCalledWith({ currentPassword: 'Temporary private passphrase 1!', newPassword: 'Lavender trains orbit quietly 2026!', acknowledgment: { termsAccepted: true, privacyAcknowledged: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION } })
  })
})
