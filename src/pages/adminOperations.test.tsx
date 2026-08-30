import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { adminIdentity, createTestContext, emptySnapshot } from '../test/testContext.js'
import type { EmployeeRecord, HrmsContextValue } from '../types/hrms.js'
import AdminApprovals from './AdminApprovals.js'
import AdminDocumentOperations from './AdminDocumentOperations.js'
import AdminLifecycleOperations from './AdminLifecycleOperations.js'
import AdminPayrollOperations from './AdminPayrollOperations.js'
import AdminPerformanceOperations from './AdminPerformanceOperations.js'
import AdminTimeOperations from './AdminTimeOperations.js'

const employee: EmployeeRecord = {
  id: 'EMP-OPS-1', firstName: 'Alex', lastName: 'Rivera', email: 'alex.rivera@example.test',
  role: 'employee', status: 'Active', department: 'Operations', position: 'Operations Specialist',
}

function renderOperation(node: React.ReactNode, overrides: Partial<HrmsContextValue> = {}) {
  return render(
    <HrmsState.Provider value={createTestContext({
      user: adminIdentity,
      data: { ...emptySnapshot, employees: [employee] },
      ...overrides,
    })}>
      {node}
    </HrmsState.Provider>,
  )
}

describe('core administrator operation boundaries', () => {
  it('sends an explicit leave approval to the provider', async () => {
    const user = userEvent.setup()
    const reviewLeave = vi.fn(async () => emptySnapshot)
    renderOperation(<AdminApprovals />, {
      reviewLeave,
      data: {
        ...emptySnapshot,
        employees: [employee],
        leaveRequests: [{
          id: 'LEV-1', employeeId: employee.id, status: 'Pending', type: 'Vacation',
          startDate: '2026-09-01', endDate: '2026-09-02', days: 2, reason: 'Family event',
        }],
      },
    })

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(reviewLeave).toHaveBeenCalledWith('LEV-1', 'Approved'))
  })

  it('keeps private request handoffs separate from employee-notified decisions', async () => {
    const user = userEvent.setup()
    const addRequestComment = vi.fn(async () => emptySnapshot)
    const reviewRequest = vi.fn(async () => emptySnapshot)
    renderOperation(<AdminApprovals />, {
      addRequestComment,
      reviewRequest,
      data: {
        ...emptySnapshot,
        employees: [employee],
        employeeRequests: [{
          id: 'REQ-1', employeeId: employee.id, status: 'Under Review', type: 'Payroll Concern',
          subject: 'Delayed update on salary', description: 'Please provide an update on this payroll period.',
          priority: 'High', requestedDate: '2026-08-29', requestedValue: 'Updated payslip',
          createdAt: '2026-08-29T16:42:00+08:00', updatedAt: '2026-08-29T16:42:00+08:00',
        }],
      },
    })

    await user.click(screen.getByRole('button', { name: 'Review' }))
    const dialog = screen.getByRole('dialog', { name: 'Review request #REQ-1' })
    await user.click(within(dialog).getByRole('button', { name: /Private handoff/ }))
    const privateNote = within(dialog).getByLabelText('Private HR handoff note')
    await user.type(privateNote, 'Validate the adjustment with the payroll register.')
    fireEvent.submit(privateNote.closest('form')!)

    await waitFor(() => expect(addRequestComment).toHaveBeenCalledWith(
      'REQ-1',
      'Validate the adjustment with the payroll register.',
      true,
    ))

    await user.click(within(dialog).getByRole('radio', { name: /More Information/ }))
    await user.type(within(dialog).getByLabelText(/Decision reason/), 'Please attach the latest payslip for validation.')
    fireEvent.submit(within(dialog).getByLabelText(/Decision reason/).closest('form')!)

    await waitFor(() => expect(reviewRequest).toHaveBeenCalledWith(
      'REQ-1',
      'More Information',
      'Please attach the latest payslip for validation.',
    ))
  })

  it('saves a dated employee schedule with its work mode and location', async () => {
    const user = userEvent.setup()
    const saveSchedule = vi.fn(async () => emptySnapshot)
    renderOperation(<AdminTimeOperations />, { saveSchedule })
    await user.click(screen.getByRole('button', { name: 'Assign schedule' }))
    const dialog = screen.getByRole('dialog', { name: 'Assign or update schedule' })
    await user.selectOptions(within(dialog).getByLabelText('Work mode'), 'Remote')
    await user.clear(within(dialog).getByLabelText('Location'))
    await user.type(within(dialog).getByLabelText('Location'), 'Approved remote workspace')
    await user.type(within(dialog).getByLabelText('Notes'), 'Remote coverage schedule')
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(saveSchedule).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: employee.id,
      workMode: 'Remote',
      location: 'Approved remote workspace',
      shiftStart: '08:00',
      shiftEnd: '17:00',
      notes: 'Remote coverage schedule',
    })))
  })

  it('starts offboarding as an accountable checklist without directly disabling access', async () => {
    const user = userEvent.setup()
    const createLifecycleCase = vi.fn(async () => emptySnapshot)
    renderOperation(<AdminLifecycleOperations />, { createLifecycleCase })
    await user.click(screen.getByRole('button', { name: 'Start checklist' }))
    const dialog = screen.getByRole('dialog', { name: 'Start lifecycle checklist' })
    await user.click(within(dialog).getByRole('radio', { name: /Offboarding/ }))
    expect(within(dialog).getByText(/Access is not removed when the case starts/)).toBeVisible()
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(createLifecycleCase).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: employee.id,
      type: 'Offboarding',
    })))
  })

  it('separates payroll generation from a confirmed stage transition', async () => {
    const user = userEvent.setup()
    const generatePayroll = vi.fn(async () => emptySnapshot)
    const transitionPayrollRun = vi.fn(async () => emptySnapshot)
    renderOperation(<AdminPayrollOperations />, {
      generatePayroll,
      transitionPayrollRun,
      data: {
        ...emptySnapshot,
        employees: [employee],
        payrollRuns: [{
          id: 41, period: 'August 2026', status: 'Draft', employeeCount: 1,
          grossTotal: 35000, netTotal: 32112.5, deductionRate: 8.25,
        }],
      },
    })

    await user.click(screen.getByRole('button', { name: 'Generate payroll' }))
    const generation = screen.getByRole('dialog', { name: 'Generate payroll draft' })
    await user.clear(within(generation).getByLabelText('Pay period'))
    await user.type(within(generation).getByLabelText('Pay period'), 'September 2026')
    await user.clear(within(generation).getByLabelText('Deduction rate (%)'))
    await user.type(within(generation).getByLabelText('Deduction rate (%)'), '9.5')
    fireEvent.submit(generation.querySelector('form')!)
    await waitFor(() => expect(generatePayroll).toHaveBeenCalledWith({ period: 'September 2026', deductionRate: 9.5 }))

    await user.click(screen.getByRole('button', { name: /Advance to Validation/ }))
    const transition = screen.getByRole('dialog', { name: 'Advance August 2026' })
    expect(within(transition).getByText('Draft → Validation')).toBeVisible()
    expect(transitionPayrollRun).not.toHaveBeenCalled()
    await user.click(within(transition).getByRole('button', { name: 'Confirm transition' }))
    await waitFor(() => expect(transitionPayrollRun).toHaveBeenCalledWith(41, 'Validation'))
  })

  it('publishes document metadata, acknowledgement, and sensitivity choices together', async () => {
    const user = userEvent.setup()
    const createDocument = vi.fn(async () => emptySnapshot)
    renderOperation(<AdminDocumentOperations />, { createDocument })
    await user.click(screen.getByRole('button', { name: 'Publish document' }))
    const dialog = screen.getByRole('dialog', { name: 'Publish HR document' })
    await user.selectOptions(within(dialog).getByLabelText('Audience'), employee.id)
    await user.type(within(dialog).getByLabelText('Title'), 'Remote Work Security Policy')
    await user.type(within(dialog).getByLabelText('Filename'), 'remote-work-security-policy.txt')
    await user.type(within(dialog).getByLabelText('Document text'), 'Use approved devices and report unfamiliar account activity immediately.')
    await user.click(within(dialog).getByLabelText('Sensitive employee record'))
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(createDocument).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: employee.id,
      title: 'Remote Work Security Policy',
      filename: 'remote-work-security-policy.txt',
      requiresAck: true,
      sensitive: true,
    })))
  })

  it('creates a bounded performance cycle through the provider', async () => {
    const user = userEvent.setup()
    const createPerformanceCycle = vi.fn(async () => emptySnapshot)
    renderOperation(<AdminPerformanceOperations />, { createPerformanceCycle })
    await user.click(screen.getByRole('button', { name: 'New cycle' }))
    const dialog = screen.getByRole('dialog', { name: 'Create performance cycle' })
    await user.clear(within(dialog).getByLabelText('Cycle title'))
    await user.type(within(dialog).getByLabelText('Cycle title'), 'Year-End Review')
    await user.clear(within(dialog).getByLabelText('Period label'))
    await user.type(within(dialog).getByLabelText('Period label'), 'H2 2026')
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'Draft')
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(createPerformanceCycle).toHaveBeenCalledWith({
      title: 'Year-End Review', period: 'H2 2026', status: 'Draft', startDate: '', endDate: '',
    }))
  })
})
