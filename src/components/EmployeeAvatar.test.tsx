import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { EmployeeAvatar } from './EmployeeAvatar.js'
import type { EmployeeRecord } from '../types/hrms.js'

const employee: EmployeeRecord = { id: 'EMP1', firstName: 'Maya', lastName: 'Santos', email: 'maya@example.test', department: 'Design', position: 'Designer', status: 'Active', role: 'employee' }

it('shows initials without a photo, falls back after an image error, and retries a refreshed URL', () => {
  const { rerender } = render(<EmployeeAvatar employee={employee} className="employee-360-avatar" />)
  expect(screen.getByText('MS')).toBeVisible()
  rerender(<EmployeeAvatar employee={{ ...employee, avatarUrl: '/photo.png' }} className="employee-360-avatar" />)
  const photo = screen.getByRole('img', { name: 'Maya Santos profile photo' })
  expect(photo).toHaveAttribute('src', '/photo.png')
  fireEvent.error(photo)
  expect(screen.getByText('MS')).toBeVisible()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  rerender(<EmployeeAvatar employee={{ ...employee, avatarUrl: '/photo.png?v=2' }} className="employee-360-avatar" />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/photo.png?v=2')
})
