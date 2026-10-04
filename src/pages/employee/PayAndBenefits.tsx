import { BriefcaseBusiness, HeartPulse, PhilippinePeso, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard } from '../../components/ui.js'
import { DataTable, type DataColumn } from '../../components/DataTable.js'
import { Payslip } from '../../components/Payslip.js'
import { useHrms } from '../../state/useHrms.js'
import { downloadCsv } from '../../utils/downloads.js'
import { formatDate, formatMoney, statusTone } from '../../utils/format.js'
import type { PayrollRecord } from '../../types/hrms.js'
import { periodYear } from './shared.js'

export function PayAndBenefits({ selectedId, onSelect }: { selectedId?: string | null; onSelect: (id: string | null) => void }) {
  const { data, user, recordActivity } = useHrms()
  if (!data || !user) return null
  const records = data.payroll.filter((item) => item.employeeId === user.id)
  const benefits = data.benefits.filter((item) => item.employeeId === user.id)
  const latest = records[0]
  const year = new Date().getFullYear()
  const yearToDate = records.filter((item) => periodYear(item.period) === year).reduce((sum, item) => sum + item.net, 0)
  const employerBenefits = benefits.filter((item) => item.status === 'Active').reduce((sum, item) => sum + item.employerShare, 0)
  const selected = records.find((item) => item.id === selectedId)
  const me = data.employees.find((item) => item.id === user.id)

  const downloadPayslip = async (record: PayrollRecord) => {
    downloadCsv(`payslip-${user.id}-${record.period}`, [{ label: 'Employee ID', value: () => user.id }, { label: 'Employee', value: () => `${user.firstName} ${user.lastName}` }, { label: 'Period', key: 'period' }, { label: 'Basic pay', key: 'gross' }, { label: 'Allowances', key: 'allowances' }, { label: 'Bonuses', key: 'bonuses' }, { label: 'SSS', value: () => record.sss ?? 0 }, { label: 'PhilHealth', value: () => record.philhealth ?? 0 }, { label: 'Pag-IBIG', value: () => record.pagibig ?? 0 }, { label: 'Withholding tax', value: () => record.withholdingTax ?? 0 }, { label: 'Total deductions', key: 'deductions' }, { label: 'Net pay', key: 'net' }, { label: 'Status', key: 'status' }], [record])
    try { await recordActivity({ action: 'Downloaded own payslip', target: record.period }) } catch { /* The export is complete; toast reports the audit issue. */ }
  }
  const openPayslip = (record: PayrollRecord) => onSelect(record.id)

  const columns: DataColumn<PayrollRecord>[] = [
    { id: 'period', header: 'Pay period', primary: true, cell: (item) => <strong>{item.period}</strong>, sortValue: (item) => item.runId ?? item.period, csv: (item) => item.period },
    { id: 'earnings', header: 'Total earnings', align: 'end', cell: (item) => formatMoney(item.gross + item.allowances + item.bonuses), sortValue: (item) => item.gross + item.allowances + item.bonuses },
    { id: 'deductions', header: 'Deductions', align: 'end', cell: (item) => formatMoney(item.deductions), sortValue: (item) => item.deductions },
    { id: 'net', header: 'Net pay', align: 'end', cell: (item) => <strong>{formatMoney(item.net)}</strong>, sortValue: (item) => item.net },
    { id: 'status', header: 'Status', cell: (item) => <Badge tone={statusTone(item.status)}>{item.status}</Badge>, sortValue: (item) => item.status },
  ]

  return <div className="page-stack">
    <SectionHeading title="Pay & Benefits" description="Your payslips and benefit plans. Only you and authorized payroll staff can see this page." />
    <div className="stats-grid stats-grid-3">
      <StatCard icon={PhilippinePeso} label="Latest net pay" value={latest ? formatMoney(latest.net) : 'No payslip yet'} detail={latest?.period ?? 'Released payslips appear here'} tone="green" />
      <StatCard icon={ReceiptText} label={`Net pay in ${year}`} value={records.length ? formatMoney(yearToDate) : '—'} detail={`${records.filter((item) => periodYear(item.period) === year).length} released payslip${records.filter((item) => periodYear(item.period) === year).length === 1 ? '' : 's'}`} tone="blue" />
      <StatCard icon={WalletCards} label="Employer benefit contributions" value={benefits.length ? `${formatMoney(employerBenefits)}/mo` : 'No plans yet'} detail={`${benefits.filter((item) => item.status === 'Active').length} active plan${benefits.filter((item) => item.status === 'Active').length === 1 ? '' : 's'}`} tone="purple" />
    </div>

    <section className="panel">
      <div className="panel-header"><div><h2>Payslips</h2><p>Select a payslip to view, print, or save it as a PDF.</p></div></div>
      <DataTable
        rows={records}
        columns={columns}
        getRowId={(item) => item.id}
        caption="Released payslips"
        count={{ singular: 'payslip', plural: 'payslips' }}
        initialSort={{ column: 'period', direction: 'desc' }}
        onRowClick={openPayslip}
        rowActionLabel={(item) => `Open payslip for ${item.period}`}
        empty={{ icon: ReceiptText, title: 'No payslips yet', text: 'Payslips appear here once payroll releases them.' }}
      />
    </section>

    <section className="panel">
      <div className="panel-header"><div><h2>Benefits</h2><p>Your enrolled plans and how much you and the company contribute</p></div></div>
      {benefits.length ? <div className="benefit-grid">{benefits.map((item) => <article key={item.id}>
        <span aria-hidden="true">{item.type.toLowerCase().includes('health') ? <HeartPulse /> : <BriefcaseBusiness />}</span>
        <div>
          <div className="benefit-grid-head"><h3>{item.planName}</h3><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>
          <p>{item.type}{item.provider ? ` · ${item.provider}` : ''}{item.effectiveDate ? ` · Since ${formatDate(item.effectiveDate)}` : ''}</p>
          <dl><div><dt>You pay</dt><dd>{formatMoney(item.employeeShare)}</dd></div><div><dt>Company pays</dt><dd>{formatMoney(item.employerShare)}</dd></div></dl>
        </div>
      </article>)}</div> : <EmptyState compact icon={BriefcaseBusiness} title="No benefit plans yet" text="Plans that HR enrolls you in will appear here." />}
    </section>

    <p className="page-footnote"><ShieldCheck aria-hidden="true" />Payslip downloads are recorded for your protection.</p>

    {selected && <Modal title={`Payslip · ${selected.period}`} onClose={() => onSelect(null)} size="large">
      <Payslip record={selected} employee={{ ...user, department: me?.department ?? user.department, position: me?.position ?? user.position }} onDownloadCsv={() => void downloadPayslip(selected)} />
    </Modal>}
  </div>
}
