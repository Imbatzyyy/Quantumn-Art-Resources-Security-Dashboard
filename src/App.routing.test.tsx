import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import App from './App.js'
import { HrmsState } from './state/HrmsState.js'
import { adminIdentity, createTestContext, employeeIdentity } from './test/testContext.js'
import type { PortalIdentity } from './types/hrms.js'

vi.mock('./pages/AdminPortal.js', () => ({ default: () => <h1>Admin workspace</h1> }))
vi.mock('./pages/EmployeePortal.js', () => ({ default: () => <h1>Employee workspace</h1> }))

function RouteLocation() {
  return <output data-testid="current-path">{useLocation().pathname}</output>
}

function renderRoute(path: string, user: PortalIdentity | null = null) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <HrmsState.Provider value={createTestContext({ user })}>
        <App />
        <RouteLocation />
      </HrmsState.Provider>
    </MemoryRouter>,
  )
}

describe('public entrypoint routing', () => {
  it.each(['/', '/unknown-page'])('sends anonymous visitors from %s to Employee sign-in', async path => {
    renderRoute(path)
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/employee/login'))
    expect(await screen.findByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible()
  })

  it('keeps direct Administrator sign-in available', async () => {
    renderRoute('/admin/login')
    expect(await screen.findByRole('heading', { name: 'Administrator sign in' })).toBeVisible()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/login')
  })

  it('keeps the homepage employee-facing even with an administrator session', async () => {
    renderRoute('/', adminIdentity)
    expect(await screen.findByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/employee/login')
  })

  it('retains direct administrator access for an authenticated administrator', async () => {
    renderRoute('/admin', adminIdentity)
    expect(await screen.findByRole('heading', { name: 'Admin workspace' })).toBeVisible()
  })

  it('lets an already-authenticated employee continue to their workspace', async () => {
    renderRoute('/', employeeIdentity)
    expect(await screen.findByRole('heading', { name: 'Employee workspace' })).toBeVisible()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/employee')
  })

  it('places the exact homepage redirect ahead of static-host catch-all rules', () => {
    const lines = readFileSync('public/_redirects', 'utf8').trim().split('\n')
    expect(lines[0].trim().split(/\s+/)).toEqual(['/', '/employee/login', '302!'])
    expect(lines.some(line => line.trim().split(/\s+/)[0] === '/api/*')).toBe(true)
  })

  it('keeps the Netlify configuration aligned with the static redirect file', () => {
    const config = readFileSync('netlify.toml', 'utf8')
    const firstRedirect = config.split('[[redirects]]')[1]
    expect(firstRedirect).toContain('from = "/"')
    expect(firstRedirect).toContain('to = "/employee/login"')
    expect(firstRedirect).toContain('status = 302')
    expect(firstRedirect).toContain('force = true')
  })
})
