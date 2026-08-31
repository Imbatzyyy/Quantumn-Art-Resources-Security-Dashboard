import { useState } from 'react'
import type { EmployeeRecord } from '../types/hrms.js'

export function EmployeeAvatar({ employee, className }: { employee: EmployeeRecord; className: string }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>()
  const photo = employee.avatarUrl && employee.avatarUrl !== failedUrl ? employee.avatarUrl : undefined
  return <span className={className}>
    {photo ? <img src={photo} alt={`${employee.preferredName || employee.firstName} ${employee.lastName} profile photo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(photo)} /> : <span aria-hidden="true">{employee.firstName[0]}{employee.lastName[0]}</span>}
  </span>
}
