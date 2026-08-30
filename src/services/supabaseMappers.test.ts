import { describe, expect, it } from 'vitest'
import {
  attendanceFromRow,
  employeeFromRow,
  emptySnapshot,
  notificationFromRow,
  payrollRunFromRow,
  scheduleFromRow,
} from './supabaseMappers.js'

describe('Supabase row boundary', () => {
  it('creates an empty snapshot containing every expected collection', () => {
    const snapshot = emptySnapshot()
    expect(Object.keys(snapshot)).toHaveLength(24)
    expect(Object.values(snapshot).every((value) => Array.isArray(value) && value.length === 0)).toBe(true)
  })

  it('normalizes employee fields and numeric values', () => {
    const employee = employeeFromRow({
      employee_code: 'EMP001', first_name: 'Ada', last_name: 'Lovelace',
      email: 'ada@example.test', role: 'employee', department: 'Engineering',
      position: 'Analyst', status: 'Active', salary: '45000',
    })
    expect(employee).toMatchObject({ id: 'EMP001', firstName: 'Ada', lastName: 'Lovelace', salary: 45000 })
    expect(employee.portal).toBeUndefined()
    expect(employee.workArrangement).toBe('On-site')
  })

  it('normalizes nullable times, booleans, and payroll stage numbers', () => {
    expect(attendanceFromRow({ id: 1, employee_code: 'EMP001', work_date: '2026-08-30', clock_in: '08:05:00', hours: '7.5', status: 'Present' }))
      .toMatchObject({ id: '1', clockIn: '08:05', clockOut: null, hours: 7.5 })
    expect(scheduleFromRow({ id: 2, employee_code: 'EMP001', work_date: '2026-08-31', work_mode: 'Rest Day' }))
      .toMatchObject({ shiftStart: '', shiftEnd: '' })
    expect(payrollRunFromRow({ id: '3', period: 'August 2026', status: 'Draft', employee_count: '2', gross_total: '90000', net_total: '82000' }))
      .toMatchObject({ id: 3, employeeCount: 2, grossTotal: 90000, netTotal: 82000 })
  })

  it('preserves notification privacy state without inventing a read timestamp', () => {
    expect(notificationFromRow({ id: 4, employee_code: 'EMP001', category: 'HR', title: 'Update', message: 'Review policy', read_at: null, created_at: '2026-08-30' }))
      .toMatchObject({ id: '4', readAt: null })
  })
})
