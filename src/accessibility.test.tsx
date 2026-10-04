import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it } from 'vitest'
import App from './App.js'
import AdminAccounts from './pages/AdminAccounts.js'
import AdminSecurityCenter from './pages/AdminSecurityCenter.js'
import EmployeeAccountSecurity from './pages/EmployeeAccountSecurity.js'
import PeopleDirectory from './pages/PeopleDirectory.js'
import { HrmsState } from './state/HrmsState.js'
import { expectNoAccessibilityViolations } from './test/accessibility.js'
import { adminIdentity, createTestContext, employeeIdentity, emptySnapshot } from './test/testContext.js'
import type { EmployeeRecord, HrmsContextValue } from './types/hrms.js'

const employee: EmployeeRecord = {
  id: employeeIdentity.id,
  firstName: employeeIdentity.firstName,
  lastName: employeeIdentity.lastName,
  email: employeeIdentity.email!,
  role: 'employee',
  status: 'Active',
  department: 'Operations',
  position: 'Operations Analyst',
}

function renderWithContext(node: React.ReactNode, context: HrmsContextValue) {
  return render(<HrmsState.Provider value={context}>{node}</HrmsState.Provider>)
}

describe('public portal accessibility', () => {
  it.each([
    ['/admin/login', 'Administrator sign in'],
    ['/employee/login', 'Welcome to your workspace'],
  ])('has no detectable structural violations on %s', async (path, heading) => {
    const view = render(
      <MemoryRouter initialEntries={[path]}>
        <HrmsState.Provider value={createTestContext()}>
          <App />
        </HrmsState.Provider>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: heading })
    await expectNoAccessibilityViolations(view.container)
  })
})

describe('authenticated portal shell accessibility', () => {
  it.each([
    ['/admin', adminIdentity, 'Good day, Admin.'],
    ['/employee', employeeIdentity, 'Good day, Employee.'],
  ])('has no detectable structural violations on %s', async (path, identity, heading) => {
    const view = render(
      <MemoryRouter initialEntries={[path]}>
        <HrmsState.Provider value={createTestContext({ user: identity })}>
          <App />
        </HrmsState.Provider>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: heading })
    await expectNoAccessibilityViolations(view.container)
  })
})

describe('protected workflow dialog accessibility', () => {
  it('keeps the Create Employee dialog structurally accessible', async () => {
    const user = userEvent.setup()
    renderWithContext(
      <PeopleDirectory onNavigate={() => undefined} />,
      createTestContext({ user: adminIdentity, data: { ...emptySnapshot, employees: [employee] } }),
    )
    await user.click(screen.getByRole('button', { name: 'Create employee & login' }))
    await expectNoAccessibilityViolations(screen.getByRole('dialog', { name: 'Create employee account' }))
  })

  it('keeps the administrator invitation dialog structurally accessible', async () => {
    const user = userEvent.setup()
    renderWithContext(
      <AdminAccounts />,
      createTestContext({ user: adminIdentity, data: { ...emptySnapshot, employees: [employee] } }),
    )
    await user.click(screen.getByRole('button', { name: 'Invite administrator' }))
    await expectNoAccessibilityViolations(screen.getByRole('dialog', { name: 'Invite administrator account' }))
  })

  it('keeps the security-alert composer structurally accessible', async () => {
    const user = userEvent.setup()
    renderWithContext(
      <AdminSecurityCenter />,
      createTestContext({ user: adminIdentity, data: { ...emptySnapshot, employees: [employee] } }),
    )
    await user.click(screen.getByRole('button', { name: 'Create alert' }))
    await expectNoAccessibilityViolations(screen.getByRole('dialog', { name: 'Create a reviewable security alert' }))
  })

  it('keeps the employee password dialog structurally accessible', async () => {
    const user = userEvent.setup()
    renderWithContext(
      <EmployeeAccountSecurity />,
      createTestContext({
        user: employeeIdentity,
        data: { ...emptySnapshot, employees: [employee] },
        getMfaStatus: async () => ({ enabled: true, factorId: 'factor-1', currentLevel: 'aal2' }),
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    await expectNoAccessibilityViolations(screen.getByRole('dialog', { name: 'Change your password' }))
  })
})
