import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { adminIdentity, createTestContext, employeeIdentity, emptySnapshot } from '../test/testContext.js'
import type { HrmsContextValue, PortalIdentity } from '../types/hrms.js'
import { downloadCsv } from '../utils/downloads.js'
import AdminAnalyticsReports from './AdminAnalyticsReports.js'
import AdminCommunications from './AdminCommunications.js'
import EmployeePortal from './EmployeePortal.js'

vi.mock('../utils/downloads.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/downloads.js')>()
  return { ...original, downloadCsv: vi.fn() }
})

function renderWithContext(node: React.ReactNode, overrides: Partial<HrmsContextValue> = {}) {
  return render(
    <HrmsState.Provider value={createTestContext({ user: adminIdentity, ...overrides })}>
      {node}
    </HrmsState.Provider>,
  )
}

const employee: PortalIdentity = {
  ...employeeIdentity,
  position: 'Operations Analyst',
  department: 'Operations',
}

describe('communications, report, and employee-download boundaries', () => {
  beforeEach(() => {
    vi.mocked(downloadCsv).mockReset()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hrms-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  })

  it('publishes an announcement with its employee-facing priority and message', async () => {
    const user = userEvent.setup()
    const addAnnouncement = vi.fn(async () => emptySnapshot)
    renderWithContext(<AdminCommunications />, { addAnnouncement })

    await user.click(screen.getByRole('button', { name: 'New announcement' }))
    const dialog = screen.getByRole('dialog', { name: 'Publish announcement' })
    await user.type(within(dialog).getByLabelText('Title'), 'Quarterly security workshop')
    await user.type(within(dialog).getByLabelText('Message'), 'Complete the secure-work workshop before Friday.')
    await user.click(within(dialog).getByRole('radio', { name: /High priority/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Publish & notify' }))

    await waitFor(() => expect(addAnnouncement).toHaveBeenCalledWith({
      title: 'Quarterly security workshop',
      content: 'Complete the secure-work workshop before Friday.',
      priority: 'High',
    }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Publish announcement' })).not.toBeInTheDocument())
  })

  it('keeps an announcement draft intact when the protected provider rejects publishing', async () => {
    const user = userEvent.setup()
    const addAnnouncement = vi.fn(async () => { throw new Error('Rejected by provider') })
    renderWithContext(<AdminCommunications />, { addAnnouncement })

    await user.click(screen.getByRole('button', { name: 'New announcement' }))
    const dialog = screen.getByRole('dialog', { name: 'Publish announcement' })
    const title = within(dialog).getByLabelText('Title')
    const message = within(dialog).getByLabelText('Message')
    await user.type(title, 'Emergency contact validation')
    await user.type(message, 'Verify your emergency contact details in My Profile.')
    await user.click(within(dialog).getByRole('button', { name: 'Publish & notify' }))

    await waitFor(() => expect(addAnnouncement).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog', { name: 'Publish announcement' })).toBeVisible()
    expect(title).toHaveValue('Emergency contact validation')
    expect(message).toHaveValue('Verify your emergency contact details in My Profile.')
  })

  it('exports the selected authorized report and records the audit event', async () => {
    const user = userEvent.setup()
    const recordActivity = vi.fn(async () => emptySnapshot)
    const workforce = [{
      id: 'EMP-REPORT-1', firstName: 'Avery', lastName: 'Santos', email: 'avery@example.test',
      role: 'employee', status: 'Active', department: 'Operations', position: 'Analyst',
    }]
    renderWithContext(<AdminAnalyticsReports />, {
      recordActivity,
      data: { ...emptySnapshot, employees: workforce },
    })
    const card = screen.getByRole('heading', { name: 'Workforce directory' }).closest('article')
    expect(card).not.toBeNull()
    await user.click(within(card!).getByRole('button', { name: 'Download CSV' }))

    expect(downloadCsv).toHaveBeenCalledWith(
      'workforce-directory',
      expect.arrayContaining([expect.objectContaining({ label: 'Employee ID', key: 'id' })]),
      workforce,
    )
    await waitFor(() => expect(recordActivity).toHaveBeenCalledWith({
      action: 'Exported authorized HR report',
      target: 'Workforce directory',
    }))
  })

  it('audits a signed-in employee payslip download', async () => {
    const user = userEvent.setup()
    const recordActivity = vi.fn(async () => emptySnapshot)
    renderWithContext(<EmployeePortal />, {
      user: employee,
      recordActivity,
      data: {
        ...emptySnapshot,
        payroll: [{
          id: 'PAY-1', employeeId: employee.id, period: 'August 2026', gross: 35000,
          allowances: 2500, bonuses: 1000, deductions: 3200, net: 35300, status: 'Released',
        }],
      },
    })
    await user.click(screen.getByRole('button', { name: 'Pay & Benefits' }))
    await user.click(screen.getByRole('button', { name: 'Download payslip CSV' }))

    expect(downloadCsv).toHaveBeenCalledWith(
      `payslip-${employee.id}-August 2026`,
      expect.any(Array),
      [expect.objectContaining({ id: 'PAY-1', employeeId: employee.id })],
    )
    await waitFor(() => expect(recordActivity).toHaveBeenCalledWith({
      action: 'Downloaded own payslip',
      target: 'August 2026',
    }))
  })

  it('audits a signed-in employee document download', async () => {
    const user = userEvent.setup()
    const recordActivity = vi.fn(async () => emptySnapshot)
    renderWithContext(<EmployeePortal />, {
      user: employee,
      recordActivity,
      data: {
        ...emptySnapshot,
        documents: [{
          id: 'DOC-AUDIT-1', employeeId: employee.id, title: 'Employment Certificate', type: 'Certificate',
          version: '1.0', requiresAck: false, filename: 'employment-certificate.txt',
          content: 'Authorized fictional classroom document.', sensitive: true,
          createdAt: '2026-08-30T04:00:00.000Z',
        }],
      },
    })
    await user.click(screen.getByRole('button', { name: 'Documents' }))
    await user.click(screen.getByRole('button', { name: 'Download' }))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(recordActivity).toHaveBeenCalledWith({
      action: 'Downloaded own HR document',
      target: 'Employment Certificate',
    }))
  })
})
