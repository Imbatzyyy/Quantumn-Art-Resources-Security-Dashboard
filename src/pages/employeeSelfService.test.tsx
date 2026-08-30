import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import { createTestContext, employeeIdentity, emptySnapshot } from '../test/testContext.js'
import type { HrmsContextValue, PortalIdentity } from '../types/hrms.js'
import EmployeePortal from './EmployeePortal.js'

const employee: PortalIdentity = {
  ...employeeIdentity,
  position: 'Operations Analyst',
  department: 'Operations',
  phone: '+63 900 000 0000',
  employmentType: 'Full-time',
  workArrangement: 'Hybrid',
  workLocation: 'Main Office',
  costCenter: 'OPS-100',
  hireDate: '2026-01-15',
}

function renderEmployee(overrides: Partial<HrmsContextValue> = {}) {
  return render(
    <HrmsState.Provider value={createTestContext({ user: employee, ...overrides })}>
      <EmployeePortal />
    </HrmsState.Provider>,
  )
}

const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

describe('Employee self-service provider boundaries', () => {
  it('records attendance only for the signed-in employee', async () => {
    const user = userEvent.setup()
    const clock = vi.fn(async () => emptySnapshot)
    renderEmployee({ clock })

    await user.click(screen.getByRole('button', { name: 'Clock in securely' }))
    await waitFor(() => expect(clock).toHaveBeenCalledWith(employee.id))
  })

  it('submits a bounded leave request with calculated dates and the employee identity', async () => {
    const user = userEvent.setup()
    const submitLeave = vi.fn(async () => emptySnapshot)
    renderEmployee({ submitLeave })
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    await user.click(screen.getByRole('button', { name: 'New leave request' }))
    const dialog = screen.getByRole('dialog', { name: 'Request leave' })
    const startDate = futureDate(2)
    const endDate = futureDate(4)
    await user.selectOptions(within(dialog).getByLabelText('Leave type'), 'Vacation')
    fireEvent.change(within(dialog).getByLabelText('Start date'), { target: { value: startDate } })
    fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: endDate } })
    await user.type(within(dialog).getByLabelText('Reason'), 'Family commitment outside the city')
    expect(within(dialog).getByLabelText('Calculated duration')).toHaveValue('3 days')
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(submitLeave).toHaveBeenCalledWith({
      employeeId: employee.id,
      type: 'Vacation',
      startDate,
      endDate,
      reason: 'Family commitment outside the city',
    }))
  })

  it('creates a private HR request with its classification and requested correction', async () => {
    const user = userEvent.setup()
    const submitRequest = vi.fn(async () => emptySnapshot)
    renderEmployee({ submitRequest })
    await user.click(screen.getByRole('button', { name: 'Request Center' }))
    await user.click(screen.getByRole('button', { name: 'New request' }))
    const dialog = screen.getByRole('dialog', { name: 'Create an HR request' })
    await user.selectOptions(within(dialog).getByLabelText('Request type'), 'Attendance Correction')
    await user.selectOptions(within(dialog).getByLabelText('Priority'), 'High')
    await user.type(within(dialog).getByLabelText('Subject'), 'Missing clock-out correction')
    fireEvent.change(within(dialog).getByLabelText('Related date (optional)'), { target: { value: '2026-08-29' } })
    await user.type(within(dialog).getByLabelText('Requested value (optional)'), 'Correct clock-out to 5:06 PM')
    await user.type(within(dialog).getByLabelText('Details'), 'The network disconnected while I was completing my clock-out.')
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(submitRequest).toHaveBeenCalledWith({
      type: 'Attendance Correction',
      subject: 'Missing clock-out correction',
      description: 'The network disconnected while I was completing my clock-out.',
      requestedDate: '2026-08-29',
      requestedValue: 'Correct clock-out to 5:06 PM',
      priority: 'High',
    }))
  })

  it('adds an employee-visible request response and cancels only an eligible request', async () => {
    const user = userEvent.setup()
    const addRequestComment = vi.fn(async () => emptySnapshot)
    const cancelRequest = vi.fn(async () => emptySnapshot)
    const request = {
      id: 'REQ-EMP-1', employeeId: employee.id, status: 'More Information', type: 'Document Request',
      subject: 'Certificate of employment', description: 'Requesting a current certificate.', priority: 'Normal',
      requestedDate: '2026-08-30', requestedValue: 'Digital copy', createdAt: '2026-08-30T01:00:00.000Z',
      updatedAt: '2026-08-30T02:00:00.000Z', decisionNote: 'Please confirm the intended recipient.',
    }
    renderEmployee({
      addRequestComment,
      cancelRequest,
      data: { ...emptySnapshot, employeeRequests: [request] },
    })
    await user.click(screen.getByRole('button', { name: 'Request Center' }))
    await user.click(screen.getByRole('button', { name: 'View' }))
    const dialog = screen.getByRole('dialog', { name: `Request #${request.id}` })
    await user.type(within(dialog).getByLabelText('Add a response'), 'Please address the certificate to Quantum Art Resources.')
    fireEvent.submit(within(dialog).getByLabelText('Add a response').closest('form')!)
    await waitFor(() => expect(addRequestComment).toHaveBeenCalledWith(
      request.id,
      'Please address the certificate to Quantum Art Resources.',
      false,
    ))

    await user.click(within(dialog).getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(cancelRequest).toHaveBeenCalledWith(request.id))
  })

  it('marks an unread notification before navigating to its destination', async () => {
    const user = userEvent.setup()
    const markNotificationRead = vi.fn(async () => emptySnapshot)
    const notification = {
      id: 'NOT-1', employeeId: employee.id, readAt: null, category: 'Policy',
      createdAt: '2026-08-30T03:00:00.000Z', title: 'Security policy acknowledgement required',
      message: 'Review the updated remote-work policy.', destination: 'documents', actionLabel: 'Review policy',
    }
    renderEmployee({
      markNotificationRead,
      data: { ...emptySnapshot, notifications: [notification] },
    })
    await user.click(screen.getByRole('button', { name: /Action Inbox/ }))
    await user.click(screen.getByRole('button', { name: /Security policy acknowledgement required/ }))

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith(notification.id))
    expect(await screen.findByRole('heading', { name: 'Document Vault' })).toBeVisible()
  })

  it('marks the signed-in employee notification inbox as read in one operation', async () => {
    const user = userEvent.setup()
    const markAllNotificationsRead = vi.fn(async () => emptySnapshot)
    renderEmployee({
      markAllNotificationsRead,
      data: {
        ...emptySnapshot,
        notifications: [{
          id: 'NOT-BULK-1', employeeId: employee.id, readAt: null, category: 'HR',
          createdAt: '2026-08-30T03:00:00.000Z', title: 'Schedule updated', message: 'Review your schedule.',
        }],
      },
    })
    await user.click(screen.getByRole('button', { name: /Action Inbox/ }))
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1))
  })

  it('updates goal progress through the shared employee and administrator record', async () => {
    const user = userEvent.setup()
    const updateGoalProgress = vi.fn(async () => emptySnapshot)
    const goal = {
      id: 'GOAL-1', employeeId: employee.id, title: 'Complete security training',
      description: 'Finish all assigned secure-work modules.', category: 'Compliance',
      dueDate: '2026-09-30', progress: 25, status: 'Active',
    }
    renderEmployee({
      updateGoalProgress,
      data: { ...emptySnapshot, goals: [goal] },
    })
    await user.click(screen.getByRole('button', { name: 'Goals & Growth' }))
    const slider = screen.getByRole('slider', { name: `${goal.title} progress` })
    fireEvent.change(slider, { target: { value: '75' } })
    expect(slider).toHaveValue('75')
    await user.click(screen.getByRole('button', { name: 'Save progress' }))
    await waitFor(() => expect(updateGoalProgress).toHaveBeenCalledWith(goal.id, 75))
  })

  it('acknowledges only the selected employee-visible document', async () => {
    const user = userEvent.setup()
    const acknowledgeDocument = vi.fn(async () => emptySnapshot)
    const document = {
      id: 'DOC-1', employeeId: null, title: 'Remote Work Security Policy', type: 'Policy', version: '2.0',
      requiresAck: true, filename: 'remote-work-security.txt', content: 'Use approved devices.',
      sensitive: false, period: '2026', createdAt: '2026-08-30T04:00:00.000Z',
    }
    renderEmployee({
      acknowledgeDocument,
      data: { ...emptySnapshot, documents: [document] },
    })
    await user.click(screen.getByRole('button', { name: 'Documents' }))
    expect(screen.getByText('Remote Work Security Policy')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))
    await waitFor(() => expect(acknowledgeDocument).toHaveBeenCalledWith(document.id))
  })

  it('limits employee profile editing to the permitted phone field', async () => {
    const user = userEvent.setup()
    const updateEmployee = vi.fn(async () => emptySnapshot)
    renderEmployee({ updateEmployee })
    await user.click(screen.getByRole('button', { name: 'My Profile' }))
    const phone = screen.getByLabelText('Phone number')
    await user.clear(phone)
    await user.type(phone, '+63 917 555 0101')
    expect(screen.getByLabelText('Employee ID')).toBeDisabled()
    expect(screen.getByLabelText('Work email')).toBeDisabled()
    fireEvent.submit(phone.closest('form')!)

    await waitFor(() => expect(updateEmployee).toHaveBeenCalledWith(employee.id, { phone: '+63 917 555 0101' }))
  })

  it('shows only employee-visible lifecycle tasks in My Journey', async () => {
    const user = userEvent.setup()
    renderEmployee({
      data: {
        ...emptySnapshot,
        lifecycleCases: [{ id: 'CASE-1', employeeId: employee.id, type: 'Onboarding', status: 'Active', targetDate: '2026-09-15' }],
        lifecycleTasks: [
          { id: 'TASK-VISIBLE', caseId: 'CASE-1', title: 'Review employee handbook', category: 'People', status: 'Pending', employeeVisible: true },
          { id: 'TASK-INTERNAL', caseId: 'CASE-1', title: 'Provision privileged database role', category: 'Security', status: 'Pending', employeeVisible: false },
        ],
      },
    })
    await user.click(screen.getByRole('button', { name: 'My Journey' }))
    expect(screen.getByText('Review employee handbook')).toBeVisible()
    expect(screen.queryByText('Provision privileged database role')).not.toBeInTheDocument()
  })

  it('exposes published performance feedback while keeping drafts private', async () => {
    const user = userEvent.setup()
    renderEmployee({
      data: {
        ...emptySnapshot,
        performance: [
          { id: 'REV-PUBLISHED', employeeId: employee.id, period: 'H1 2026', score: 88, goalProgress: 75, quality: 90, productivity: 86, teamwork: 88, rating: 'Exceeds expectations', status: 'Published', comments: 'Published feedback for the employee.' },
          { id: 'REV-DRAFT', employeeId: employee.id, period: 'H2 2026', score: 60, goalProgress: 40, quality: 60, productivity: 60, teamwork: 60, rating: 'Draft', status: 'Draft', comments: 'Private calibration notes.' },
        ],
      },
    })
    await user.click(screen.getByRole('button', { name: 'Goals & Growth' }))
    expect(screen.getByText('Published feedback for the employee.')).toBeVisible()
    expect(screen.queryByText('Private calibration notes.')).not.toBeInTheDocument()
  })
})
