import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HrmsState } from '../state/HrmsState.js'
import type { EmployeeRecord, HrmsContextValue } from '../types/hrms.js'
import { adminIdentity, createTestContext, emptySnapshot } from '../test/testContext.js'
import AdminAccounts from './AdminAccounts.js'
import AdminSecurityCenter from './AdminSecurityCenter.js'
import PeopleDirectory from './PeopleDirectory.js'

const employee: EmployeeRecord = {
  id: 'EMP-1001',
  firstName: 'Jamie',
  lastName: 'Santos',
  email: 'jamie.santos@example.test',
  role: 'employee',
  status: 'Active',
  department: 'Operations',
  position: 'Operations Analyst',
  employmentType: 'Full-time',
  workArrangement: 'Hybrid',
  workLocation: 'Main Office',
}

function renderFeature(node: React.ReactNode, context: HrmsContextValue) {
  return render(<HrmsState.Provider value={context}>{node}</HrmsState.Provider>)
}

describe('People Directory protected workflows', () => {
  const administrators: EmployeeRecord[] = ['admin', 'hr_admin', 'payroll_admin', 'security_admin', 'auditor'].map((role, index) => ({
    ...employee, id: `ADM-${index}`, firstName: 'Privileged', lastName: `Account ${index}`,
    email: `privileged-${index}@example.test`, role, department: 'Administration',
  }))

  it('shows only employee-role profiles and calculates employee-only directory totals', async () => {
    const user = userEvent.setup()
    const inactive = { ...employee, id: 'EMP-INACTIVE', firstName: 'Inactive', email: 'inactive@example.test', status: 'Inactive', department: 'Finance' }
    const onLeave = { ...employee, id: 'EMP-LEAVE', firstName: 'Leave', email: 'leave@example.test', status: 'On Leave' }
    const records = [employee, inactive, onLeave, ...administrators]
    renderFeature(<PeopleDirectory onNavigate={vi.fn()} />, createTestContext({
      user: adminIdentity, data: { ...emptySnapshot, employees: records },
    }))

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    for (const person of [employee, inactive, onLeave]) {
      expect(within(table).getByText(`${person.firstName} ${person.lastName}`)).toBeVisible()
    }
    for (const account of administrators) {
      expect(within(table).queryByText(`${account.firstName} ${account.lastName}`)).not.toBeInTheDocument()
    }
    const metric = (label: string) => screen.getByText(label).closest('article')!.querySelector('strong')
    expect(metric('Employee records')).toHaveTextContent('3')
    expect(metric('Departments')).toHaveTextContent('2')
    expect(metric('Active employees')).toHaveTextContent('1')

    await user.type(screen.getByRole('textbox', { name: 'Search employees' }), 'Privileged')
    expect(screen.getByText('No matching employee')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'Search employees' }))
    await user.type(screen.getByRole('textbox', { name: 'Search employees' }), 'jamie')
    expect(screen.getAllByRole('button', { name: 'Open profile' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Open profile' }))
    expect(screen.getByRole('dialog', { name: 'Employee 360°' })).toBeVisible()
  })

  it('groups employee details and preserves tab navigation and benefit actions', async () => {
    const user = userEvent.setup()
    const record = { ...employee, middleName: 'Rivera', phone: '+639123456789', managerId: administrators[0].id, emergencyContactName: 'Sam Santos', emergencyContactRelationship: 'Sibling', emergencyContactPhone: '+639987654321' }
    renderFeature(<PeopleDirectory onNavigate={vi.fn()} />, createTestContext({
      user: adminIdentity, data: { ...emptySnapshot, employees: [record, ...administrators], attendance: [
        { id: 'A1', employeeId: employee.id, date: '2026-08-30', hours: 8, status: 'Present', clockIn: '08:00', clockOut: '17:00' },
        { id: 'A2', employeeId: 'OTHER', date: '2026-08-29', hours: 2, status: 'Absent' },
      ] },
    }))
    await user.click(screen.getByRole('button', { name: 'Open profile' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Employee 360°' }))
    expect(dialog.getByRole('region', { name: 'Personal & contact details' })).toHaveTextContent('Jamie Rivera Santos')
    expect(dialog.getByRole('region', { name: 'Employment details' })).toHaveTextContent('Privileged Account 0')
    expect(dialog.getByRole('region', { name: 'Emergency contact' })).toHaveTextContent('Sibling')
    expect(dialog.getByRole('region', { name: 'Emergency contact' })).toHaveTextContent('+639987654321')
    await user.click(dialog.getByRole('tab', { name: 'Attendance' }))
    expect(dialog.getByRole('tabpanel', { name: 'Attendance' })).toHaveTextContent('8.0 hrs')
    expect(dialog.getByRole('tabpanel')).not.toHaveTextContent('2.0 hrs')
    await user.keyboard('{End}')
    expect(dialog.getByRole('tab', { name: 'Account access' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(dialog.getByRole('tab', { name: 'Overview' })).toHaveFocus()
    await user.click(dialog.getByRole('tab', { name: 'Pay & benefits' }))
    await user.click(dialog.getByRole('button', { name: 'Add benefit' }))
    expect(screen.getByRole('dialog', { name: 'Add benefit record' })).toBeVisible()
  })

  it('preserves employee editing and offboarding from the redesigned profile', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const updateEmployee = vi.fn(async () => emptySnapshot)
    renderFeature(<PeopleDirectory onNavigate={onNavigate} />, createTestContext({
      user: adminIdentity, updateEmployee, data: { ...emptySnapshot, employees: [employee] },
    }))
    await user.click(screen.getByRole('button', { name: 'Open profile' }))
    await user.click(screen.getByRole('button', { name: 'Edit employee' }))
    expect(screen.getByRole('dialog', { name: 'Edit Jamie Santos' })).toBeVisible()
    expect(screen.getByLabelText('First name')).toHaveValue('Jamie')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Open profile' }))
    await user.click(screen.getByRole('button', { name: 'Start secure offboarding' }))
    expect(onNavigate).toHaveBeenCalledWith('lifecycle')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(updateEmployee).not.toHaveBeenCalled()
  })

  it('keeps administrators available as reporting managers without listing them as employees', async () => {
    const user = userEvent.setup()
    renderFeature(<PeopleDirectory onNavigate={vi.fn()} />, createTestContext({
      user: adminIdentity, data: { ...emptySnapshot, employees: administrators },
    }))
    expect(screen.getByText('No employee records yet')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create employee & login' }))
    const managers = within(screen.getByRole('dialog')).getByLabelText(/Reports to/)
    expect(within(managers).getAllByRole('option')).toHaveLength(3)
    expect(within(managers).getByRole('option', { name: /Privileged Account 0/ })).toBeVisible()
    expect(within(managers).getByRole('option', { name: /Privileged Account 1/ })).toBeVisible()
  })

  it('closes a selected employee profile when a realtime role update removes it from the directory', async () => {
    const user = userEvent.setup()
    const context = createTestContext({ user: adminIdentity, data: { ...emptySnapshot, employees: [employee] } })
    const rendered = renderFeature(<PeopleDirectory onNavigate={vi.fn()} />, context)
    await user.click(screen.getByRole('button', { name: 'Open profile' }))
    expect(screen.getByRole('dialog', { name: 'Employee 360°' })).toBeVisible()
    rendered.rerender(<HrmsState.Provider value={{ ...context, data: { ...emptySnapshot, employees: [{ ...employee, role: 'hr_admin' }] } }}><PeopleDirectory onNavigate={vi.fn()} /></HrmsState.Provider>)
    expect(screen.queryByRole('dialog', { name: 'Employee 360°' })).not.toBeInTheDocument()
    expect(screen.getByText('No employee records yet')).toBeVisible()
  })

  it('continues showing administrator profiles separately in Admin Accounts', () => {
    renderFeature(<AdminAccounts />, createTestContext({
      user: adminIdentity, data: { ...emptySnapshot, employees: [employee, ...administrators] },
    }))
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(6)
    expect(within(table).queryByText('Jamie Santos')).not.toBeInTheDocument()
    for (const account of administrators) {
      expect(within(table).getByText(`${account.firstName} ${account.lastName}`)).toBeVisible()
    }
  })

  it('builds a secure employee payload and calls the provider only on submission', async () => {
    const user = userEvent.setup()
    const addEmployee = vi.fn(async () => emptySnapshot)
    const context = createTestContext({
      user: adminIdentity,
      data: { ...emptySnapshot, employees: [employee] },
      addEmployee,
    })

    renderFeature(<PeopleDirectory onNavigate={vi.fn()} />, context)
    await user.click(screen.getByRole('button', { name: 'Create employee & login' }))

    const dialog = screen.getByRole('dialog', { name: 'Create employee account' })
    expect(within(dialog).getByText('Secure employee provisioning')).toBeVisible()
    expect(addEmployee).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('First name'), 'Taylor')
    await user.type(within(dialog).getByLabelText('Last name'), 'Reyes')
    await user.type(within(dialog).getByLabelText('Work email'), 'taylor.reyes@example.test')
    await user.type(within(dialog).getByLabelText('Mobile number'), '+63 912 345 6789')
    await user.type(within(dialog).getByLabelText('Position'), 'People Operations Specialist')
    await user.click(within(dialog).getByRole('button', { name: 'Generate strong password' }))

    const temporaryPassword = within(dialog).getByLabelText('Temporary password', { selector: 'input' })
    expect(temporaryPassword).toHaveAttribute('type', 'text')
    expect((temporaryPassword as HTMLInputElement).value).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%&*?]).{12,}$/)

    const invalidFields = Array.from(dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>(':invalid'))
      .map((field) => ({ type: field.type, value: field.value, label: field.closest('label')?.textContent?.trim() }))
    expect(invalidFields).toEqual([])
    expect(within(dialog).getByRole('button', { name: 'Create employee & login' })).toBeEnabled()
    fireEvent.submit(dialog.querySelector('form')!)

    await waitFor(() => expect(addEmployee).toHaveBeenCalledTimes(1))
    expect(addEmployee).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Taylor',
      lastName: 'Reyes',
      email: 'taylor.reyes@example.test',
      phone: '+63 912 345 6789',
      position: 'People Operations Specialist',
      department: 'Operations',
      temporaryPassword: expect.stringMatching(/.{12,}/),
    }))
    expect(screen.queryByRole('dialog', { name: 'Create employee account' })).not.toBeInTheDocument()
  })
})

describe('administrator invitation controls', () => {
  it('denies the privileged workflow to non-system administrators', () => {
    renderFeature(
      <AdminAccounts />,
      createTestContext({
        user: { ...adminIdentity, role: 'hr_admin' },
        data: { ...emptySnapshot, employees: [employee] },
      }),
    )

    expect(screen.getByText('System Administrator access required')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Invite administrator' })).not.toBeInTheDocument()
  })

  it('requires explicit role confirmation before sending an invitation', async () => {
    const user = userEvent.setup()
    const inviteAdminAccount = vi.fn(async () => emptySnapshot)
    renderFeature(
      <AdminAccounts />,
      createTestContext({
        user: adminIdentity,
        data: { ...emptySnapshot, employees: [employee] },
        inviteAdminAccount,
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Invite administrator' }))
    const dialog = screen.getByRole('dialog', { name: 'Invite administrator account' })
    const submit = within(dialog).getByRole('button', { name: 'Create account & send invitation' })
    expect(submit).toBeDisabled()
    expect(dialog.querySelector('input[type="password"]')).not.toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/First name/), 'Morgan')
    await user.type(within(dialog).getByLabelText(/Last name/), 'Cruz')
    await user.type(within(dialog).getByLabelText(/Work email/), 'morgan.cruz@example.test')
    await user.click(within(dialog).getByRole('radio', { name: /Security Administrator/ }))
    await user.click(within(dialog).getByRole('checkbox', { name: /I verified this recipient and role assignment/ }))
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => expect(inviteAdminAccount).toHaveBeenCalledTimes(1))
    expect(inviteAdminAccount).toHaveBeenCalledWith({
      firstName: 'Morgan',
      lastName: 'Cruz',
      email: 'morgan.cruz@example.test',
      phone: '',
      role: 'security_admin',
      confirmed: true,
    })
    expect(screen.queryByRole('dialog', { name: 'Invite administrator account' })).not.toBeInTheDocument()
  })
})

describe('Security Center protected workflows', () => {
  it('creates a plain-language, employee-scoped security alert through the provider', async () => {
    const user = userEvent.setup()
    const addSecurityAlert = vi.fn(async () => emptySnapshot)
    renderFeature(
      <AdminSecurityCenter />,
      createTestContext({
        user: adminIdentity,
        data: { ...emptySnapshot, employees: [employee] },
        addSecurityAlert,
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Create alert' }))
    const dialog = screen.getByRole('dialog', { name: 'Create a reviewable security alert' })
    await user.selectOptions(within(dialog).getByLabelText(/Affected account/), employee.id)
    await user.selectOptions(within(dialog).getByLabelText(/Severity/), 'High')
    await user.selectOptions(within(dialog).getByLabelText(/Confidence/), 'High')
    await user.type(within(dialog).getByLabelText(/Alert title/), 'New sign-in from an unfamiliar browser')
    await user.type(within(dialog).getByLabelText(/What happened/), 'A new browser session was recorded for this account.')
    await user.type(within(dialog).getByLabelText(/Why this matters/), 'An unfamiliar session may indicate that account access should be reviewed.')
    await user.type(within(dialog).getByLabelText(/Recommended safe action/), 'Review active sessions and report the session if it was not yours.')
    await user.click(within(dialog).getByRole('button', { name: 'Create secure alert' }))

    await waitFor(() => expect(addSecurityAlert).toHaveBeenCalledTimes(1))
    expect(addSecurityAlert).toHaveBeenCalledWith({
      employeeCode: employee.id,
      severity: 'High',
      confidence: 'High',
      eventType: 'Unusual access',
      title: 'New sign-in from an unfamiliar browser',
      description: 'A new browser session was recorded for this account.',
      whyItMatters: 'An unfamiliar session may indicate that account access should be reviewed.',
      recommendedAction: 'Review active sessions and report the session if it was not yours.',
    })
  })

  it('keeps mutation controls hidden in read-only auditor mode', async () => {
    renderFeature(
      <AdminSecurityCenter readOnly />,
      createTestContext({
        user: { ...adminIdentity, role: 'auditor' },
        data: { ...emptySnapshot, employees: [employee] },
      }),
    )

    expect(screen.queryByRole('button', { name: 'Create alert' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh evidence' })).toBeVisible()
    await waitFor(() => expect(screen.getByText('0/0')).toBeVisible())
  })

  it('paginates alert and audit evidence instead of rendering unbounded lists', async () => {
    const user = userEvent.setup()
    const securityAlerts = Array.from({ length: 6 }, (_, index) => ({
      id: `ALT-PAGE-${index + 1}`,
      employeeId: employee.id,
      status: 'New',
      severity: 'Medium',
      confidence: 'Medium',
      title: `Pagination alert ${index + 1}`,
      description: `Reviewable security evidence number ${index + 1}.`,
      affected: 'Jamie Santos',
      time: 'Aug 30, 2026, 4:00 PM',
      whyItMatters: 'The activity needs an accountable review.',
      recommendedAction: 'Review the evidence and record a decision.',
      createdAt: `2026-08-30T0${index}:00:00.000Z`,
    }))
    const auditLog = Array.from({ length: 7 }, (_, index) => ({
      id: `AUD-PAGE-${index + 1}`,
      actor: 'Admin Tester',
      action: `Pagination audit action ${index + 1}`,
      target: `Evidence ${index + 1}`,
      time: `Aug 30, 2026, ${index + 1}:00 PM`,
    }))
    renderFeature(
      <AdminSecurityCenter />,
      createTestContext({
        user: adminIdentity,
        data: { ...emptySnapshot, employees: [employee], securityAlerts, auditLog },
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Alerts' }))
    expect(screen.getByText('Pagination alert 1')).toBeVisible()
    expect(screen.queryByText('Pagination alert 6')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next alert page' }))
    expect(screen.getByText('Pagination alert 6')).toBeVisible()
    expect(screen.queryByText('Pagination alert 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alert page 2' })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('button', { name: 'Audit trail' }))
    expect(screen.getByText(/Pagination audit action 1/)).toBeVisible()
    expect(screen.queryByText(/Pagination audit action 7/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next audit page' }))
    expect(screen.getByText(/Pagination audit action 7/)).toBeVisible()
    expect(screen.queryByText(/Pagination audit action 1/)).not.toBeInTheDocument()
  })

  it('preserves investigation decisions and session revocations through protected operations', async () => {
    const user = userEvent.setup()
    const updateSecurityInvestigation = vi.fn(async () => emptySnapshot)
    const endSession = vi.fn(async () => emptySnapshot)
    const alert = {
      id: 'ALT-1001',
      employeeId: employee.id,
      status: 'New',
      severity: 'High',
      confidence: 'High',
      title: 'Unfamiliar sign-in detected',
      description: 'A new browser session was recorded.',
      affected: 'Jamie Santos',
      time: 'Aug 30, 2026, 2:00 PM',
      whyItMatters: 'The employee should confirm whether this session is recognized.',
      recommendedAction: 'Review the session and report it if unfamiliar.',
      createdAt: '2026-08-30T06:00:00.000Z',
    }
    const session = {
      id: 'SES-1001',
      employeeId: employee.id,
      device: 'Chrome on Windows',
      location: 'Manila, PH',
      assuranceLevel: 'aal1',
      current: false,
      lastSeenAt: '2026-08-30T06:00:00.000Z',
      trustStatus: 'Review',
    }
    renderFeature(
      <AdminSecurityCenter />,
      createTestContext({
        user: adminIdentity,
        data: { ...emptySnapshot, employees: [employee], securityAlerts: [alert], sessions: [session] },
        updateSecurityInvestigation,
        endSession,
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Alerts' }))
    await user.click(screen.getByRole('button', { name: 'Investigate' }))
    const investigationDialog = screen.getByRole('dialog', { name: `Investigation ${alert.id}` })
    await user.selectOptions(within(investigationDialog).getByLabelText(/Next status/), 'Resolved')
    const reason = within(investigationDialog).getByLabelText(/Resolution reason/)
    expect(reason).toBeEnabled()
    expect(reason).toBeRequired()
    await user.type(reason, 'Employee confirmed the session and credentials remain protected.')
    await user.type(within(investigationDialog).getByLabelText(/Investigation note/), 'Reviewed the session evidence with the account owner.')
    await user.click(within(investigationDialog).getByRole('button', { name: 'Save investigation decision' }))

    await waitFor(() => expect(updateSecurityInvestigation).toHaveBeenCalledWith({
      alertCode: alert.id,
      status: 'Resolved',
      resolutionReason: 'Employee confirmed the session and credentials remain protected.',
      note: 'Reviewed the session evidence with the account owner.',
    }))

    await user.click(screen.getByRole('button', { name: 'Sessions' }))
    await user.click(screen.getByRole('button', { name: 'Review & revoke' }))
    const sessionDialog = screen.getByRole('dialog', { name: 'Review organization session' })
    expect(within(sessionDialog).getByText('Chrome on Windows')).toBeVisible()
    await user.click(within(sessionDialog).getByRole('button', { name: 'Revoke & audit' }))
    await waitFor(() => expect(endSession).toHaveBeenCalledWith(session.id))
  })

  it('passes an authorized ZAP JSON report and its scope metadata to the provider', async () => {
    const user = userEvent.setup()
    const importZapReport = vi.fn(async () => emptySnapshot)
    renderFeature(
      <AdminSecurityCenter />,
      createTestContext({
        user: adminIdentity,
        data: { ...emptySnapshot, employees: [employee] },
        importZapReport,
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Vulnerability testing' }))
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="json"]')
    expect(input).not.toBeNull()
    const reportBody = JSON.stringify({ '@version': '2.15.0', site: [] })
    await user.upload(input!, new File([reportBody], 'authorized-baseline.json', { type: 'application/json' }))
    const submit = screen.getByRole('button', { name: 'Verify & import report' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    await waitFor(() => expect(importZapReport).toHaveBeenCalledTimes(1))
    expect(importZapReport).toHaveBeenCalledWith(expect.objectContaining({
      report: reportBody,
      reportName: 'authorized-baseline.json',
      targetUrl: 'https://quantumnhr.com',
      environment: 'Production',
      scanType: 'Baseline',
    }))
  })
})
