import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App.js'
import { HrmsState } from './state/HrmsState.js'
import { adminIdentity, createTestContext, emptySnapshot, employeeIdentity } from './test/testContext.js'
import type { EmployeeRecord, PortalIdentity } from './types/hrms.js'

const employee: EmployeeRecord = { id: 'EMP-42', firstName: 'Rina', lastName: 'Lopez', email: 'rina@example.test', role: 'employee', status: 'Active', department: 'Finance', position: 'Accountant' }

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}
const renderAt = (path: string, user: PortalIdentity) => render(
  <MemoryRouter initialEntries={[path]}>
    <HrmsState.Provider value={createTestContext({ user, data: { ...emptySnapshot, employees: [employee] } })}>
      <App />
      <LocationProbe />
    </HrmsState.Provider>
  </MemoryRouter>,
)

describe('portal pages have real addresses', () => {
  it('opens a deep link to an employee profile and updates the address while navigating', async () => {
    const user = userEvent.setup()
    renderAt('/admin/people/EMP-42?tab=time', adminIdentity)
    expect(await screen.findByRole('heading', { level: 1, name: 'Rina Lopez' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Attendance' })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Rina Lopez')).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('tab', { name: 'Leave' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/people/EMP-42?tab=leave')
    await user.click(within(screen.getByRole('navigation', { name: 'Portal navigation' })).getByRole('button', { name: /^Approvals/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/approvals')
    expect(await screen.findByRole('heading', { level: 1, name: 'Approvals' })).toBeVisible()
  })

  it('sends unknown or unauthorized pages back to the portal home', async () => {
    renderAt('/employee/not-a-page', employeeIdentity)
    expect(await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), Employee$/ })).toBeVisible()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/employee$/))
  })

  it('keeps role-restricted administrator pages out of reach', async () => {
    renderAt('/admin/payroll', { ...adminIdentity, role: 'security_admin' })
    expect(await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), Admin$/ })).toBeVisible()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin$/))
    expect(within(screen.getByRole('navigation', { name: 'Portal navigation' })).queryByRole('button', { name: 'Payroll' })).not.toBeInTheDocument()
  })
})
