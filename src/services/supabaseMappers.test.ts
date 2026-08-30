import { describe, expect, it } from 'vitest'
import type { Tables } from '../types/database.js'
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
    const row: Tables<'profiles'> = {
      avatar_path: null,
      auth_user_id: null, cost_center: null, created_at: '2026-08-30T00:00:00Z',
      emergency_contact_name: null, emergency_contact_phone: null,
      emergency_contact_relationship: null, employment_type: 'Full-time',
      employee_code: 'EMP001', first_name: 'Ada', last_name: 'Lovelace',
      email: 'ada@example.test', role: 'employee', department: 'Engineering',
      hire_date: '2026-01-01', manager_code: null, middle_name: null, phone: null,
      position: 'Analyst', preferred_name: null, status: 'Active', salary: 45000,
      updated_at: '2026-08-30T00:00:00Z', work_arrangement: 'On-site', work_location: 'Main Office',
    }
    const employee = employeeFromRow(row)
    expect(employee).toMatchObject({ id: 'EMP001', firstName: 'Ada', lastName: 'Lovelace', salary: 45000 })
    expect(employee.portal).toBeUndefined()
    expect(employee.workArrangement).toBe('On-site')
  })

  it('normalizes nullable times, booleans, and payroll stage numbers', () => {
    expect(attendanceFromRow({
      id: 1, employee_code: 'EMP001', work_date: '2026-08-30', clock_in: '08:05:00',
      clock_out: null, hours: 7.5, status: 'Present', created_at: '2026-08-30T00:00:00Z',
      updated_at: '2026-08-30T08:05:00Z',
    }))
      .toMatchObject({ id: '1', clockIn: '08:05', clockOut: null, hours: 7.5 })
    expect(scheduleFromRow({
      id: 2, employee_code: 'EMP001', work_date: '2026-08-31', work_mode: 'Rest Day',
      shift_start: '00:00:00', shift_end: '00:00:00', location: 'Not scheduled', notes: null,
      created_at: '2026-08-30T00:00:00Z', updated_at: '2026-08-30T00:00:00Z',
    }))
      .toMatchObject({ shiftStart: '00:00', shiftEnd: '00:00' })
    expect(payrollRunFromRow({
      id: 3, period: 'August 2026', status: 'Draft', employee_count: 2,
      gross_total: 90000, net_total: 82000, deduction_rate: 8.25,
      approved_at: null, approved_by: null, created_at: '2026-08-30T00:00:00Z',
      created_by: null, locked_at: null, paid_at: null, released_at: null,
      updated_at: '2026-08-30T00:00:00Z',
    }))
      .toMatchObject({ id: 3, employeeCount: 2, grossTotal: 90000, netTotal: 82000 })
  })

  it('preserves notification privacy state without inventing a read timestamp', () => {
    expect(notificationFromRow({
      id: 4, employee_code: 'EMP001', category: 'HR', title: 'Update',
      message: 'Review policy', read_at: null, created_at: '2026-08-30',
      destination: null, action_label: null,
    }))
      .toMatchObject({ id: '4', readAt: null })
  })
})
