import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Gauge, ShieldCheck, Users } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { adminIdentity, createTestContext, employeeIdentity, emptySnapshot } from '../test/testContext.js'
import type { HrmsContextValue, PortalNavigationItem } from '../types/hrms.js'
import PortalLayout from './PortalLayout.js'

const items = [
  { id: 'action-center', label: 'Action Center', icon: Gauge, group: 'Operations' },
  { id: 'people', label: 'People Directory', icon: Users, group: 'Operations' },
  { id: 'security', label: 'Security Center', icon: ShieldCheck, group: 'Governance' },
] as const satisfies readonly PortalNavigationItem[]

const employeeItems = [
  { id: 'home', label: 'My Day', icon: Gauge, group: 'Workspace' },
  { id: 'requests', label: 'Request Center', icon: Users, group: 'My Work' },
  { id: 'inbox', label: 'Action Inbox', icon: ShieldCheck, group: 'My Work' },
  { id: 'documents', label: 'Documents', icon: ShieldCheck, group: 'Resources' },
] as const satisfies readonly PortalNavigationItem[]

function renderAdminLayout(onNavigate = vi.fn(), overrides: Partial<HrmsContextValue> = {}) {
  render(
    <HrmsState.Provider value={createTestContext({
      user: adminIdentity,
      data: {
        ...emptySnapshot,
        leaveRequests: [{
          id: 'LEV-1', employeeId: 'EMP-1', status: 'Pending', type: 'Vacation',
          startDate: '2026-09-01', endDate: '2026-09-02', days: 2, reason: 'Family event',
        }],
        employeeRequests: [
          { id: 'REQ-1', employeeId: 'EMP-1', status: 'Submitted', type: 'Payroll Concern', subject: 'Payslip correction', description: 'Please review.', priority: 'Normal', createdAt: '2026-08-30T08:00:00+08:00', updatedAt: '2026-08-30T08:00:00+08:00' },
          { id: 'REQ-2', employeeId: 'EMP-2', status: 'Under Review', type: 'Profile Update', subject: 'Update department', description: 'Please review.', priority: 'Normal', createdAt: '2026-08-30T08:00:00+08:00', updatedAt: '2026-08-30T08:00:00+08:00' },
        ],
        securityAlerts: [
          { id: 'ALT-1', employeeId: 'EMP-1', status: 'New', severity: 'High', confidence: 'High', title: 'Unfamiliar session', description: 'Review this session.', affected: 'EMP-1', time: 'Now', whyItMatters: 'Unexpected access.', recommendedAction: 'Investigate.', createdAt: '2026-08-30T08:00:00+08:00' },
          { id: 'ALT-2', employeeId: 'EMP-2', status: 'Investigating', severity: 'Medium', confidence: 'Medium', title: 'Review in progress', description: 'Already triaged.', affected: 'EMP-2', time: 'Earlier', whyItMatters: 'Account activity.', recommendedAction: 'Continue investigation.', createdAt: '2026-08-30T07:00:00+08:00' },
        ],
      },
      ...overrides,
    })}>
      <PortalLayout active="action-center" items={items} title="Action Center" onNavigate={onNavigate}>
        <h1>Administrator workspace</h1>
      </PortalLayout>
    </HrmsState.Provider>,
  )
  return onNavigate
}

function renderEmployeeLayout(overrides: Partial<HrmsContextValue> = {}, onNavigate = vi.fn()) {
  render(
    <HrmsState.Provider value={createTestContext({
      user: employeeIdentity,
      data: {
        ...emptySnapshot,
        notifications: [
          { id: 'NOT-NEW', employeeId: employeeIdentity.id, readAt: null, category: 'Policy', createdAt: '2026-08-30T09:00:00+08:00', title: 'Updated policy is ready', message: 'Review the updated workplace policy.', destination: 'documents', actionLabel: 'Review policy' },
          { id: 'NOT-READ', employeeId: employeeIdentity.id, readAt: '2026-08-30T08:30:00+08:00', category: 'HR', createdAt: '2026-08-30T08:00:00+08:00', title: 'Request received', message: 'HR received your request.', destination: 'requests' },
          { id: 'NOT-OTHER', employeeId: 'EMP-OTHER', readAt: null, category: 'Private', createdAt: '2026-08-30T10:00:00+08:00', title: 'Another employee notification', message: 'This must remain hidden.' },
        ],
      },
      ...overrides,
    })}>
      <PortalLayout active="home" items={employeeItems} title="My Day" onNavigate={onNavigate}>
        <h1>Employee workspace</h1>
      </PortalLayout>
    </HrmsState.Provider>,
  )
  return onNavigate
}

describe('administrator portal header controls', () => {
  it('searches role-allowed pages and supports arrow-key navigation', async () => {
    const user = userEvent.setup()
    const onNavigate = renderAdminLayout()
    const search = screen.getByRole('combobox', { name: 'Find a portal page' })

    await user.type(search, 'operations')
    const results = screen.getByRole('listbox', { name: 'Matching portal pages' })
    expect(within(results).getAllByRole('option')).toHaveLength(2)

    await user.keyboard('{ArrowDown}{Enter}')
    expect(onNavigate).toHaveBeenCalledWith('people')
    expect(search).toHaveValue('')
  })

  it('opens a counted admin attention menu and routes each work type correctly', async () => {
    const user = userEvent.setup()
    const onNavigate = renderAdminLayout()

    await user.click(screen.getByRole('button', { name: 'Open admin notifications, 4 items need attention' }))
    const menu = screen.getByLabelText('Administrator attention center')
    expect(within(menu).getByText('1 leave request · 2 employee cases')).toBeVisible()
    expect(within(menu).getByText('New security alerts')).toBeVisible()

    await user.click(within(menu).getByRole('button', { name: /Approvals and HR cases/ }))
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('approvals'))
  })
})

describe('employee portal header controls', () => {
  it('searches only Employee pages and supports keyboard navigation', async () => {
    const user = userEvent.setup()
    const onNavigate = renderEmployeeLayout()
    const search = screen.getByRole('combobox', { name: 'Find a portal page' })

    await user.type(search, 'documents')
    const results = screen.getByRole('listbox', { name: 'Matching portal pages' })
    expect(within(results).getAllByRole('option')).toHaveLength(1)
    expect(within(results).queryByText('People Directory')).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(onNavigate).toHaveBeenCalledWith('documents')
    expect(search).toHaveValue('')
  })

  it('opens personal notifications, marks an unread item, and routes to its destination', async () => {
    const user = userEvent.setup()
    const markNotificationRead = vi.fn(async () => emptySnapshot)
    const onNavigate = renderEmployeeLayout({ markNotificationRead })

    await user.click(screen.getByRole('button', { name: 'Open employee notifications, 1 unread' }))
    const menu = screen.getByLabelText('Employee notification center')
    expect(within(menu).getByText('Updated policy is ready')).toBeVisible()
    expect(within(menu).getByText('Request received')).toBeVisible()
    expect(within(menu).queryByText('Another employee notification')).not.toBeInTheDocument()

    await user.click(within(menu).getByRole('button', { name: /Updated policy is ready/ }))
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('NOT-NEW'))
    expect(onNavigate).toHaveBeenCalledWith('documents')
  })

  it('marks all unread Employee notifications through the shared data provider', async () => {
    const user = userEvent.setup()
    const markAllNotificationsRead = vi.fn(async () => emptySnapshot)
    renderEmployeeLayout({ markAllNotificationsRead })

    await user.click(screen.getByRole('button', { name: 'Open employee notifications, 1 unread' }))
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1))
  })
})

describe('portal sign-out confirmation', () => {
  it.each(['admin', 'employee'] as const)('requires confirmation before signing out of the %s portal', async (portal) => {
    const user = userEvent.setup()
    const logout = vi.fn(async () => undefined)
    if (portal === 'admin') renderAdminLayout(vi.fn(), { logout })
    else renderEmployeeLayout({ logout })

    await user.click(screen.getByRole('button', { name: /^Sign out$/ }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm sign out' })
    expect(logout).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Confirm sign out' })).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^Sign out$/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Confirm sign out' })).getByRole('button', { name: /^Sign out$/ }))
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  })
})
