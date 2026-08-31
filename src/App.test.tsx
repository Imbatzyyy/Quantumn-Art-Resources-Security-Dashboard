import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App.js'
import { HrmsState } from './state/HrmsState.js'
import { adminIdentity, createTestContext, employeeIdentity } from './test/testContext.js'
import type { HrmsContextValue } from './types/hrms.js'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="route-location">{location.pathname}</output>
}

function renderRoute(path: string, context: HrmsContextValue = createTestContext()) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HrmsState.Provider value={context}>
        <App />
        <LocationProbe />
      </HrmsState.Provider>
    </MemoryRouter>,
  )
}

describe('public authentication routes', () => {
  it('renders a distinct administrator sign-in experience with accessible fields', async () => {
    const user = userEvent.setup()
    renderRoute('/admin/login')
    expect(await screen.findByRole('heading', { name: 'Administrator sign in' })).toBeVisible()
    expect(screen.getByLabelText('Work email')).toHaveAttribute('autocomplete', 'username')
    const password = screen.getByLabelText('Password', { selector: 'input' })
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.queryByText(/Open the employee portal/i)).not.toBeInTheDocument()
  })

  it('renders employee sign-in with a private recovery link, logical focus order, and no admin discovery link', async () => {
    const user = userEvent.setup()
    renderRoute('/employee/login')
    expect(await screen.findByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible()
    const email = screen.getByLabelText('Work email')
    const recovery = screen.getByRole('link', { name: 'Forgot password?' })
    const password = screen.getByLabelText('Password', { selector: 'input' })
    expect(recovery).toHaveAttribute('href', '/employee/forgot-password')
    expect(screen.queryByText(/admin portal/i)).not.toBeInTheDocument()

    await user.tab()
    expect(email).toHaveFocus()
    await user.tab()
    expect(password).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus()
    await user.tab()
    expect(recovery).toHaveFocus()
  })

  it('keeps recovery and invitation routes readable when Supabase is unavailable', async () => {
    const recovery = renderRoute('/employee/reset-password')
    expect(await screen.findByRole('heading', { name: 'Create a new password' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('not configured in this preview environment')
    recovery.unmount()

    renderRoute('/admin/setup-password')
    expect(await screen.findByRole('heading', { name: 'Create your private password' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('not configured in this preview environment')
  })
})

describe('protected route decisions', () => {
  it('keeps route decisions pending while authentication restores', () => {
    renderRoute('/admin', createTestContext({ loading: true }))
    expect(screen.getByText('Preparing your secure workspace…')).toBeVisible()
    expect(screen.getByTestId('route-location')).toHaveTextContent('/admin')
  })

  it('redirects signed-out users to the matching portal login', async () => {
    renderRoute('/employee')
    expect(await screen.findByTestId('route-location')).toHaveTextContent('/employee/login')
    expect(await screen.findByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible()
  })

  it('keeps an employee account away from the administrator workspace', async () => {
    renderRoute('/admin', createTestContext({ user: employeeIdentity }))
    expect(await screen.findByTestId('route-location')).toHaveTextContent('/admin/login')
  })

  it('requires invited administrators to complete password setup first', async () => {
    renderRoute('/admin', createTestContext({ user: { ...adminIdentity, mustSetPassword: true } }))
    expect(await screen.findByTestId('route-location')).toHaveTextContent('/admin/setup-password')
    expect(await screen.findByRole('heading', { name: 'Create your private password' })).toBeVisible()
  })
})
