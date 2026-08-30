import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Gauge, ShieldCheck, Users } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { adminIdentity, createTestContext, emptySnapshot } from '../test/testContext.js'
import type { PortalNavigationItem } from '../types/hrms.js'
import PortalLayout from './PortalLayout.js'

const items = [
  { id: 'action-center', label: 'Action Center', icon: Gauge, group: 'Operations' },
  { id: 'people', label: 'People Directory', icon: Users, group: 'Operations' },
  { id: 'security', label: 'Security Center', icon: ShieldCheck, group: 'Governance' },
] as const satisfies readonly PortalNavigationItem[]

function renderAdminLayout(onNavigate = vi.fn()) {
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
    })}>
      <PortalLayout active="action-center" items={items} title="Action Center" onNavigate={onNavigate}>
        <h1>Administrator workspace</h1>
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
