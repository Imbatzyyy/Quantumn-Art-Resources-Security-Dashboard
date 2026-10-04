import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { adminIdentity, createTestContext, employeeIdentity, emptySnapshot } from '../test/testContext.js'
import type { EmployeeRecord, HrmsContextValue } from '../types/hrms.js'
import { businessDate } from '../utils/securityMetrics.js'
import { Payslip } from '../components/Payslip.js'
import AdminAccounts from './AdminAccounts.js'
import AdminCommunications from './AdminCommunications.js'
import AdminDocumentOperations from './AdminDocumentOperations.js'
import { EmployeeLeave } from './employee/Leave.js'

const shift = (days: number) => {
  const date = new Date(`${businessDate()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const hrAdmin: EmployeeRecord = { id: 'ADM-HR', firstName: 'Hana', lastName: 'Cruz', email: 'hana@example.test', role: 'hr_admin', status: 'Active', department: 'Human Resources', position: 'HR Administrator' }
const me: EmployeeRecord = { id: adminIdentity.id, firstName: 'Admin', lastName: 'Tester', email: adminIdentity.email ?? '', role: 'admin', status: 'Active', department: 'Administration', position: 'System Administrator' }

function renderWith(node: React.ReactNode, overrides: Partial<HrmsContextValue> = {}) {
  return render(<HrmsState.Provider value={createTestContext({ user: adminIdentity, data: emptySnapshot, ...overrides })}>{node}</HrmsState.Provider>)
}

describe('employee leave balances and cancellation', () => {
  const leaveData = {
    ...emptySnapshot,
    leaveRequests: [
      { id: 'L1', employeeId: employeeIdentity.id, status: 'Pending', type: 'Vacation', startDate: shift(10), endDate: shift(11), days: 2, reason: 'Trip' },
      { id: 'L2', employeeId: employeeIdentity.id, status: 'Rejected', type: 'Sick', startDate: shift(-30), endDate: shift(-30), days: 1, reason: 'Checkup', decisionNote: 'Please attach a medical certificate.' },
      { id: 'L3', employeeId: employeeIdentity.id, status: 'Approved', type: 'Vacation', startDate: shift(-60), endDate: shift(-58), days: 3, reason: 'Holiday' },
    ],
    leavePolicies: [
      { type: 'Vacation', annualDays: 15, description: '' },
      { type: 'Sick', annualDays: 10, description: '' },
      { type: 'Emergency', annualDays: 3, description: '' },
      { type: 'Other', annualDays: null, description: '' },
    ],
  }

  it('shows balances per leave type and the HR note on a decision', () => {
    renderWith(<EmployeeLeave />, { user: employeeIdentity, data: leaveData })
    const sameYear = shift(-60).slice(0, 4) === businessDate().slice(0, 4)
    expect(screen.getByText('Vacation leave left').closest('.stat-card')).toHaveTextContent(sameYear ? '12 days' : '15 days')
    expect(screen.getByText('Sick leave left').closest('.stat-card')).toHaveTextContent('10 days')
    expect(screen.getByText('HR: Please attach a medical certificate.')).toBeVisible()
  })

  it('cancels pending leave only after confirmation', async () => {
    const user = userEvent.setup()
    const cancelLeave = vi.fn(async () => emptySnapshot)
    renderWith(<EmployeeLeave />, { user: employeeIdentity, data: leaveData, cancelLeave })
    // Only the pending request can be cancelled; rejected and past leave cannot.
    const cancelButtons = screen.getAllByRole('button', { name: /^Cancel vacation leave from/ })
    expect(cancelButtons).toHaveLength(1)
    await user.click(cancelButtons[0])
    const dialog = screen.getByRole('dialog', { name: 'Cancel leave request' })
    expect(cancelLeave).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel leave' }))
    await waitFor(() => expect(cancelLeave).toHaveBeenCalledWith('L1'))
  })
})

describe('announcement corrections', () => {
  const data = { ...emptySnapshot, announcements: [{ id: '7', priority: 'Normal', date: '2026-09-01', title: 'Town hall', content: 'Join us on Friday.' }] }

  it('edits an announcement without notifying employees again', async () => {
    const user = userEvent.setup()
    const updateAnnouncement = vi.fn(async () => emptySnapshot)
    const addAnnouncement = vi.fn(async () => emptySnapshot)
    renderWith(<AdminCommunications />, { data, updateAnnouncement, addAnnouncement })
    await user.click(screen.getByRole('button', { name: 'Edit Town hall' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit announcement' })
    const save = within(dialog).getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/^Title/), ' moved to Monday')
    await user.click(save)
    await waitFor(() => expect(updateAnnouncement).toHaveBeenCalledWith('7', { title: 'Town hall moved to Monday', content: 'Join us on Friday.', priority: 'Normal' }))
    expect(addAnnouncement).not.toHaveBeenCalled()
  })

  it('deletes an announcement after confirmation', async () => {
    const user = userEvent.setup()
    const deleteAnnouncement = vi.fn(async () => emptySnapshot)
    renderWith(<AdminCommunications />, { data, deleteAnnouncement })
    await user.click(screen.getByRole('button', { name: 'Delete Town hall' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete announcement' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete announcement' }))
    await waitFor(() => expect(deleteAnnouncement).toHaveBeenCalledWith('7'))
  })

  it('hides edit controls from roles that cannot publish', () => {
    renderWith(<AdminCommunications />, { data, user: { ...adminIdentity, role: 'auditor' } })
    expect(screen.queryByRole('button', { name: 'Edit Town hall' })).not.toBeInTheDocument()
  })
})

describe('administrator access management', () => {
  const data = { ...emptySnapshot, employees: [me, hrAdmin] }

  it('changes another administrator’s role', async () => {
    const user = userEvent.setup()
    const manageAdminAccount = vi.fn(async () => emptySnapshot)
    renderWith(<AdminAccounts />, { data, manageAdminAccount })
    expect(screen.queryByRole('button', { name: 'Manage access for Admin Tester' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Manage access for Hana Cruz' }))
    const dialog = screen.getByRole('dialog', { name: 'Manage Hana Cruz' })
    expect(within(dialog).getByRole('button', { name: 'Save role' })).toBeDisabled()
    await user.click(within(dialog).getByRole('radio', { name: /Compliance Auditor/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Save role' }))
    await waitFor(() => expect(manageAdminAccount).toHaveBeenCalledWith({ operation: 'change-role', employeeId: 'ADM-HR', role: 'auditor' }))
  })

  it('deactivates an administrator after confirmation', async () => {
    const user = userEvent.setup()
    const manageAdminAccount = vi.fn(async () => emptySnapshot)
    renderWith(<AdminAccounts />, { data, manageAdminAccount })
    await user.click(screen.getByRole('button', { name: 'Manage access for Hana Cruz' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Manage Hana Cruz' })).getByRole('button', { name: 'Deactivate account' }))
    const confirm = screen.getByRole('dialog', { name: 'Deactivate administrator' })
    expect(manageAdminAccount).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate account' }))
    await waitFor(() => expect(manageAdminAccount).toHaveBeenCalledWith({ operation: 'deactivate', employeeId: 'ADM-HR' }))
  })
})

describe('document attachments', () => {
  it('attaches a valid file and rejects unsupported types', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const createDocument = vi.fn(async () => emptySnapshot)
    renderWith(<AdminDocumentOperations />, { createDocument })
    await user.click(screen.getAllByRole('button', { name: 'Publish document' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Publish HR document' })

    await user.upload(within(dialog).getByLabelText(/^Attach a file/), new File(['MZ'], 'tool.exe', { type: 'application/x-msdownload' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Attach a PDF, PNG, JPEG, text or Word (.docx) file.')

    const pdf = new File(['%PDF-1.7'], 'contract.pdf', { type: 'application/pdf' })
    await user.upload(within(dialog).getByLabelText(/^Attach a file/), pdf)
    expect(within(dialog).getByText('contract.pdf', { selector: 'strong' })).toBeVisible()
    expect(within(dialog).getByLabelText(/^Filename/)).toHaveValue('contract.pdf')

    await user.type(within(dialog).getByLabelText(/^Document title/), 'Employment contract')
    await user.type(within(dialog).getByLabelText(/^Summary/), 'Signed employment contract.')
    await user.click(within(dialog).getByRole('button', { name: /Publish/ }))
    await waitFor(() => expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({ title: 'Employment contract', filename: 'contract.pdf', file: pdf })))
  })
})

describe('payslip deductions', () => {
  it('itemizes Philippine statutory deductions', () => {
    render(<Payslip record={{ id: 'P1', employeeId: 'EMP1', period: 'September 2026', gross: 35000, allowances: 0, bonuses: 0, deductions: 4526.3, net: 30473.7, status: 'Released', sss: 1750, philhealth: 875, pagibig: 200, withholdingTax: 1701.3 }} />)
    expect(screen.getByRole('rowheader', { name: 'SSS contribution' })).toBeVisible()
    expect(screen.getByRole('rowheader', { name: 'Withholding tax' })).toBeVisible()
    expect(screen.queryByRole('rowheader', { name: 'Contributions and withholding' })).not.toBeInTheDocument()
  })

  it('keeps a single line for flat-rate payroll', () => {
    render(<Payslip record={{ id: 'P2', employeeId: 'EMP1', period: 'July 2026', gross: 35000, allowances: 0, bonuses: 0, deductions: 2887.5, net: 32112.5, status: 'Paid' }} />)
    expect(screen.getByRole('rowheader', { name: 'Contributions and withholding' })).toBeVisible()
  })
})
