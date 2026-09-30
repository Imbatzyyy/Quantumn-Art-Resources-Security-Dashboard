import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import AdminAccounts from './AdminAccounts.js'
import { HrmsState } from '../state/HrmsState.js'
import { adminIdentity, createTestContext, emptySnapshot } from '../test/testContext.js'
import { adminPasswordReset } from '../services/adminPasswordReset.js'

vi.mock('../services/adminPasswordReset.js', () => ({ adminPasswordReset: vi.fn() }))
beforeEach(() => vi.mocked(adminPasswordReset).mockReset().mockResolvedValue({ sent: true }))
const renderPage = (role = 'admin') => render(<HrmsState.Provider value={createTestContext({ user: { ...adminIdentity, role }, data: { ...emptySnapshot, employees: [{ id: 'ADM-RECIPIENT', firstName: 'Casey', lastName: 'Lee', role: 'hr_admin', status: 'Active', email: 'casey@example.test', department: 'HR', position: 'HR Administrator' }] } })}><AdminAccounts /></HrmsState.Provider>)

it('confirms the exact recipient, supports cancel, and reports provider acceptance truthfully', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Reset password for Casey Lee' }))
  let dialog = screen.getByRole('dialog', { name: 'Reset administrator password' })
  expect(within(dialog).getByText('casey@example.test')).toBeVisible()
  expect(within(dialog).getByRole('button', { name: 'Send reset email' })).toBeDisabled()
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(adminPasswordReset).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Reset password for Casey Lee' }))
  dialog = screen.getByRole('dialog', { name: 'Reset administrator password' })
  await user.click(within(dialog).getByRole('checkbox'))
  await user.click(within(dialog).getByRole('button', { name: 'Send reset email' }))
  expect(adminPasswordReset).toHaveBeenCalledExactlyOnceWith({ action: 'send', employeeCode: 'ADM-RECIPIENT', confirmed: true }, true)
  expect(await screen.findByText(/The email provider accepted the message/)).toBeVisible()
})

it('does not expose the reset controls to an HR Administrator', () => {
  renderPage('hr_admin')
  expect(screen.queryByRole('button', { name: /Reset password/ })).not.toBeInTheDocument()
})
