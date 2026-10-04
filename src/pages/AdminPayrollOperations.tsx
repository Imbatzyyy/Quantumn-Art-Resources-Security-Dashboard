import { useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, ClipboardList, Landmark, LockKeyhole, Percent, PhilippinePeso, ReceiptText, ShieldCheck, Users } from 'lucide-react'
import { Badge, ConfirmDialog, EmptyState, Modal, SectionHeading, StatCard } from '../components/ui.js'
import { DataTable, type DataColumn } from '../components/DataTable.js'
import { Payslip } from '../components/Payslip.js'
import { Field, FormFooter, FormIntro, SummaryList } from '../components/readable.js'
import { useSubmissionLock } from '../utils/useSubmissionLock.js'
import { useHrms } from '../state/useHrms.js'
import { formatMoney, formatMoneyExact, statusTone } from '../utils/format.js'
import { phStatutoryDeductions } from '../utils/payrollPh.js'
import type { HrmsSnapshot, PayrollCalculationMethod, PayrollRecord, PayrollStage } from '../types/hrms.js'

const payrollNext: Partial<Record<PayrollStage, PayrollStage>> = { Draft: 'Validation', Validation: 'Approved', Approved: 'Released', Released: 'Paid', Paid: 'Locked' }
const payrollImpact: Partial<Record<PayrollStage, string>> = {
  Validation: 'The draft becomes the official validation set. Review employee counts and totals before approving.',
  Approved: 'This records the approving administrator and timestamp. Payslips remain hidden from employees.',
  Released: 'This immediately makes each employee’s own payslip visible and sends a notification.',
  Paid: 'This records the payment date for every employee calculation in the run.',
  Locked: 'This makes the period final. A locked payroll run cannot be regenerated or advanced further.',
}
const stages: PayrollStage[] = ['Draft', 'Validation', 'Approved', 'Released', 'Paid', 'Locked']
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}
interface PendingTransition { id: number; current: PayrollStage; next: PayrollStage; period: string }

export default function AdminPayrollOperations({ runId, onRunChange }: { runId?: string | null; onRunChange?: (id: string | null) => void } = {}) {
  const submission = useSubmissionLock()
  const { data, generatePayroll, transitionPayrollRun } = useHrms()
  const [showGenerate, setShowGenerate] = useState(false)
  const [localRunId, setLocalRunId] = useState<number | null>(null)
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null)
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null)
  const [form, setForm] = useState<{ period: string; deductionRate: number; method: PayrollCalculationMethod }>({ period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), deductionRate: 8.25, method: 'Philippine statutory' })
  if (!data) return null
  const selectedRunId = onRunChange ? (runId ? Number(runId) : null) : localRunId
  const setSelectedRunId = (id: number) => onRunChange ? onRunChange(String(id)) : setLocalRunId(id)
  const selectedRun = data.payrollRuns.find((item) => item.id === selectedRunId) ?? data.payrollRuns[0]
  const previousRun = selectedRun ? data.payrollRuns[data.payrollRuns.indexOf(selectedRun) + 1] : undefined
  const netChange = selectedRun && previousRun && previousRun.netTotal ? ((selectedRun.netTotal - previousRun.netTotal) / previousRun.netTotal) * 100 : null
  const records = selectedRun ? data.payroll.filter((item) => item.runId === selectedRun.id || (!item.runId && item.period === selectedRun.period)) : []
  const eligibleEmployees = data.employees.filter((item) => item.role === 'employee' && item.status === 'Active')
  const eligibleEmployeeCount = eligibleEmployees.length
  const statutory = form.method === 'Philippine statutory'
  // Estimated deductions for the draft, using the same rules as the server.
  const estimatedDeductions = eligibleEmployees.reduce((sum, employee) => sum + (statutory ? phStatutoryDeductions(employee.salary ?? 0).total : (employee.salary ?? 0) * Number(form.deductionRate || 0) / 100), 0)
  const example = phStatutoryDeductions(35000)
  const methodLabel = (run?: { calculationMethod?: PayrollCalculationMethod; deductionRate: number }) => run?.calculationMethod === 'Philippine statutory' ? 'SSS, PhilHealth, Pag-IBIG and tax' : run ? `Flat deduction ${run.deductionRate}%` : undefined

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!submission.begin()) return
    try { await generatePayroll({ ...form, deductionRate: Number(form.deductionRate) }); setShowGenerate(false) } catch { /* Keep protected input. */ } finally { submission.finish() }
  }
  const confirmTransition = async () => {
    if (!pendingTransition) return
    await transitionPayrollRun(pendingTransition.id, pendingTransition.next)
    setPendingTransition(null)
  }

  const columns: DataColumn<PayrollRecord>[] = [
    { id: 'employee', header: 'Employee', primary: true, cell: (item) => <span className="cell-stack"><strong>{personName(data, item.employeeId)}</strong><small>{item.employeeId}</small></span>, sortValue: (item) => personName(data, item.employeeId) },
    { id: 'base', header: 'Basic pay', align: 'end', cell: (item) => formatMoney(item.gross), sortValue: (item) => item.gross },
    { id: 'allowances', header: 'Allowances', align: 'end', hideOnMobile: true, cell: (item) => formatMoney(item.allowances), sortValue: (item) => item.allowances },
    { id: 'bonuses', header: 'Bonuses', align: 'end', hideOnMobile: true, cell: (item) => formatMoney(item.bonuses), sortValue: (item) => item.bonuses },
    { id: 'deductions', header: 'Deductions', align: 'end', cell: (item) => formatMoney(item.deductions), sortValue: (item) => item.deductions },
    { id: 'sss', header: 'SSS', exportOnly: true, cell: (item) => item.sss ?? 0, csv: (item) => item.sss ?? 0 },
    { id: 'philhealth', header: 'PhilHealth', exportOnly: true, cell: (item) => item.philhealth ?? 0, csv: (item) => item.philhealth ?? 0 },
    { id: 'pagibig', header: 'Pag-IBIG', exportOnly: true, cell: (item) => item.pagibig ?? 0, csv: (item) => item.pagibig ?? 0 },
    { id: 'tax', header: 'Withholding tax', exportOnly: true, cell: (item) => item.withholdingTax ?? 0, csv: (item) => item.withholdingTax ?? 0 },
    { id: 'net', header: 'Net pay', align: 'end', cell: (item) => <strong>{formatMoney(item.net)}</strong>, sortValue: (item) => item.net },
    { id: 'status', header: 'Status', cell: (item) => <Badge tone={statusTone(item.status)}>{item.status}</Badge>, sortValue: (item) => item.status },
  ]

  return <div className="page-stack">
    <SectionHeading title="Payroll" description="Move each pay period from Draft to Locked. Employees see their payslip only after it is released." actions={<button className="button button-primary" onClick={() => setShowGenerate(true)}><PhilippinePeso aria-hidden="true" />Generate payroll</button>} />
    <div className="stats-grid stats-grid-4">
      <StatCard icon={PhilippinePeso} label="Net payroll" value={selectedRun ? formatMoney(selectedRun.netTotal) : '—'} detail={netChange === null ? (selectedRun ? selectedRun.period : 'No run yet') : <span className={`trend ${netChange >= 0 ? 'trend-up' : 'trend-down'}`}>{netChange >= 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}{Math.abs(netChange).toFixed(1)}% vs {previousRun!.period}</span>} tone="green" />
      <StatCard icon={ReceiptText} label="Gross payroll" value={selectedRun ? formatMoney(selectedRun.grossTotal) : '—'} detail={methodLabel(selectedRun)} tone="blue" />
      <StatCard icon={Users} label="Employees in run" value={selectedRun?.employeeCount ?? 0} detail={previousRun ? `${previousRun.employeeCount} last period` : `${eligibleEmployeeCount} active employees`} tone="purple" />
      <StatCard icon={ClipboardList} label="Current stage" value={selectedRun?.status ?? 'No run'} detail={selectedRun && payrollNext[selectedRun.status] ? `Next: ${payrollNext[selectedRun.status]}` : selectedRun ? 'Final' : undefined} tone="amber" />
    </div>
    <section className="panel payroll-pipeline">
      <div className="panel-header"><div><h2>Pay period</h2><p>Select a run and move it forward one step at a time.</p></div>{data.payrollRuns.length > 0 && <label className="select-field"><span>Pay period</span><select value={selectedRun?.id ?? ''} onChange={(event) => setSelectedRunId(Number(event.target.value))}>{data.payrollRuns.map((item) => <option key={item.id} value={item.id}>{item.period} · {item.status}</option>)}</select></label>}</div>
      {selectedRun ? <div className="panel-body">
        <ol className="pipeline-track">{stages.map((stage, index) => { const currentIndex = stages.indexOf(selectedRun.status); return <li key={stage} className={index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''} aria-current={index === currentIndex ? 'step' : undefined}><span>{index < currentIndex ? <Check aria-hidden="true" /> : index + 1}</span><strong>{stage}</strong></li> })}</ol>
        <div className="pipeline-summary"><p>{payrollNext[selectedRun.status] ? payrollImpact[payrollNext[selectedRun.status]!] : 'This pay period is final and can no longer change.'}</p>{payrollNext[selectedRun.status] ? <button className="button button-primary" onClick={() => { const next = payrollNext[selectedRun.status]; if (next) setPendingTransition({ id: selectedRun.id, current: selectedRun.status, next, period: selectedRun.period }) }}>Move to {payrollNext[selectedRun.status]}<ChevronRight aria-hidden="true" /></button> : <Badge tone="neutral">Locked</Badge>}</div>
      </div> : <EmptyState icon={PhilippinePeso} title="No payroll run yet" text="Generate the first pay period to start." action={<button type="button" className="button button-primary button-small" onClick={() => setShowGenerate(true)}>Generate payroll</button>} />}
    </section>
    {selectedRun && <section className="panel">
      <div className="panel-header"><div><h2>Employee pay</h2><p>Select an employee to preview their payslip</p></div></div>
      <DataTable
        rows={records}
        columns={columns}
        getRowId={(item) => item.id}
        caption={`Employee pay for ${selectedRun.period}`}
        count={{ singular: 'employee', plural: 'employees' }}
        search={{ placeholder: 'Search employees', text: (item) => `${personName(data, item.employeeId)} ${item.employeeId}` }}
        initialSort={{ column: 'employee', direction: 'asc' }}
        exportName={`payroll-${selectedRun.period}`}
        onRowClick={setPayslip}
        rowActionLabel={(item) => `Preview payslip for ${personName(data, item.employeeId)}`}
        empty={{ icon: ClipboardList, title: 'No employees in this run', text: 'Generate the draft again to include active employees.' }}
      />
    </section>}
    {showGenerate && <Modal title="Generate payroll draft" size="large" onClose={() => setShowGenerate(false)}>
      <form className="rf-form rf-form--md" onSubmit={submit}>
        <FormIntro>Choose the pay period and how deductions are calculated. This creates draft calculations only. Employees can’t see their payslips until you release the run.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            <Field label="Pay period" help="Use a month and year so the run is easy to find, for example “August 2026”.">{(control) => <input {...control} value={form.period} maxLength={60} onChange={(event) => setForm({ ...form, period: event.target.value })} placeholder="e.g. August 2026" required />}</Field>
            <fieldset className="rf-field rf-choices rf-choices--2">
              <legend className="rf-label">Deductions</legend>
              <div>
                <button type="button" className={`rf-choice${statutory ? ' is-selected' : ''}`} aria-pressed={statutory} onClick={() => setForm({ ...form, method: 'Philippine statutory' })}><Landmark aria-hidden="true" /><span><strong>Philippine statutory</strong><small>SSS, PhilHealth, Pag-IBIG and withholding tax for each employee</small></span></button>
                <button type="button" className={`rf-choice${!statutory ? ' is-selected' : ''}`} aria-pressed={!statutory} onClick={() => setForm({ ...form, method: 'Flat rate' })}><Percent aria-hidden="true" /><span><strong>Flat rate</strong><small>One percentage of basic pay for everyone</small></span></button>
              </div>
            </fieldset>
            {statutory
              ? <p className="rf-help rf-tip">Uses the 2025 employee shares and the BIR monthly tax table on each employee’s monthly base salary. Example: a ₱35,000 salary has SSS {formatMoneyExact(example.sss)}, PhilHealth {formatMoneyExact(example.philhealth)}, Pag-IBIG {formatMoneyExact(example.pagibig)} and withholding tax {formatMoneyExact(example.withholdingTax)}.</p>
              : <Field label="Deduction rate (%)" help="Between 0% and 50%, with up to two decimal places.">{(control) => <div className="rf-input-suffix"><input {...control} type="number" min={0} max={50} step="0.01" value={form.deductionRate} onChange={(event) => setForm({ ...form, deductionRate: Number(event.target.value) })} required /><span aria-hidden="true">%</span></div>}</Field>}
          </div>

          <aside className="rf-summary" aria-label="Payroll draft summary">
            <h3>Draft summary</h3>
            <SummaryList items={[
              ['Employees included', `${eligibleEmployeeCount} active ${eligibleEmployeeCount === 1 ? 'employee' : 'employees'}`],
              ['Deductions', statutory ? 'Philippine statutory' : `Flat ${Number(form.deductionRate || 0).toFixed(2)}%`],
              ['Estimated total deductions', formatMoney(estimatedDeductions)],
              ['Starting stage', <Badge tone="neutral">Draft</Badge>],
              ['Visible to employees', 'Not until released'],
            ]} />
            <ul className="rf-checklist">
              <li className="is-met"><CheckCircle2 aria-hidden="true" /><span>Calculations are created as a draft</span></li>
              <li className="is-met"><CheckCircle2 aria-hidden="true" /><span>Your action is recorded in the audit log</span></li>
              <li className="is-met"><CheckCircle2 aria-hidden="true" /><span>Locked periods can’t be changed</span></li>
            </ul>
          </aside>
        </div>

        <FormFooter icon={LockKeyhole} note="Generating again for an unlocked period returns it to Draft.">
          <button type="button" className="button button-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
          <button className="button button-primary" disabled={submission.busy}><ReceiptText aria-hidden="true" />Generate payroll draft</button>
        </FormFooter>
      </form>
    </Modal>}
    {payslip && <Modal title={`Payslip preview · ${payslip.period}`} onClose={() => setPayslip(null)} size="large"><Payslip record={payslip} employee={data.employees.find((item) => item.id === payslip.employeeId)} /></Modal>}
    {pendingTransition && <ConfirmDialog
      title={`Move ${pendingTransition.period} to ${pendingTransition.next}`}
      icon={ShieldCheck}
      heading={`${pendingTransition.current} → ${pendingTransition.next}`}
      message={<p>{payrollImpact[pendingTransition.next]}</p>}
      confirmLabel={`Move to ${pendingTransition.next}`}
      busyLabel="Updating…"
      onCancel={() => setPendingTransition(null)}
      onConfirm={confirmTransition}
    />}
  </div>
}
