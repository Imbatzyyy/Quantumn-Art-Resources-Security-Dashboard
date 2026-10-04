import { Printer } from 'lucide-react'
import logo from '../../assets/images/mainlogo_blue.png'
import type { EmployeeRecord, PayrollRecord, PortalIdentity } from '../types/hrms.js'
import { formatMoneyExact } from '../utils/format.js'
import { Badge } from './ui.js'
import { statusTone } from '../utils/format.js'
import { deductionLines } from '../utils/payrollPh.js'

interface PayslipProps {
  record: PayrollRecord
  employee?: Pick<EmployeeRecord | PortalIdentity, 'id' | 'firstName' | 'lastName' | 'middleName' | 'department' | 'position'>
  onDownloadCsv?: () => void
}

/** A printable payslip built from the released payroll record. */
export function Payslip({ record, employee, onDownloadCsv }: PayslipProps) {
  const earnings = record.gross + record.allowances + record.bonuses
  const lines = deductionLines(record)
  const name = employee ? [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ') : record.employeeId
  return <div className="payslip-view">
    <article className="payslip-document print-target" aria-label={`Payslip for ${record.period}`}>
      <header className="payslip-document-head">
        <img src={logo} alt="Quantumn Art Resources" />
        <div><span>Payslip</span><strong>{record.period}</strong><Badge tone={statusTone(record.status)}>{record.status}</Badge></div>
      </header>
      <dl className="payslip-employee">
        <div><dt>Employee</dt><dd>{name}</dd></div>
        <div><dt>Employee ID</dt><dd>{employee?.id ?? record.employeeId}</dd></div>
        <div><dt>Department</dt><dd>{employee?.department || '—'}</dd></div>
        <div><dt>Position</dt><dd>{employee?.position || '—'}</dd></div>
      </dl>
      <div className="payslip-columns">
        <section aria-labelledby={`earnings-${record.id}`}>
          <h3 id={`earnings-${record.id}`}>Earnings</h3>
          <table>
            <tbody>
              <tr><th scope="row">Basic pay</th><td>{formatMoneyExact(record.gross)}</td></tr>
              <tr><th scope="row">Allowances</th><td>{formatMoneyExact(record.allowances)}</td></tr>
              <tr><th scope="row">Bonuses</th><td>{formatMoneyExact(record.bonuses)}</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">Total earnings</th><td>{formatMoneyExact(earnings)}</td></tr></tfoot>
          </table>
        </section>
        <section aria-labelledby={`deductions-${record.id}`}>
          <h3 id={`deductions-${record.id}`}>Deductions</h3>
          <table>
            <tbody>
              {lines ? lines.map((line) => <tr key={line.label}><th scope="row">{line.label}</th><td>{formatMoneyExact(line.amount)}</td></tr>)
                : <tr><th scope="row">Contributions and withholding</th><td>{formatMoneyExact(record.deductions)}</td></tr>}
            </tbody>
            <tfoot><tr><th scope="row">Total deductions</th><td>{formatMoneyExact(record.deductions)}</td></tr></tfoot>
          </table>
        </section>
      </div>
      <div className="payslip-net"><span>Net pay</span><strong>{formatMoneyExact(record.net)}</strong></div>
      <p className="payslip-note">This payslip is generated from the payroll record released by HR.{lines ? ' Government contributions and withholding tax use the published 2025 SSS, PhilHealth and Pag-IBIG rates and the BIR monthly tax table.' : ''} Contact Payroll through the Request Center if any amount looks incorrect.</p>
    </article>
    <div className="modal-actions payslip-actions">
      {onDownloadCsv && <button type="button" className="button button-secondary" onClick={onDownloadCsv}>Download CSV</button>}
      <button type="button" className="button button-primary" onClick={() => window.print()}><Printer aria-hidden="true" />Print or save as PDF</button>
    </div>
  </div>
}
