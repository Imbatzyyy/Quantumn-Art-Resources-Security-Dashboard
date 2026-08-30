import { useState, type FormEvent } from 'react'
import { CalendarDays, Check, ChevronRight, ClipboardList, LockKeyhole, PhilippinePeso, ReceiptText, ShieldCheck, Users } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatMoney, statusTone } from '../utils/format.js'
import type { HrmsSnapshot, PayrollStage } from '../types/hrms.js'

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

export default function AdminPayrollOperations() {
  const { data, generatePayroll, transitionPayrollRun } = useHrms()
  const [showGenerate, setShowGenerate] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null)
  const [form, setForm] = useState({ period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), deductionRate: 8.25 })
  if (!data) return null
  const selectedRun = data.payrollRuns.find((item) => item.id === selectedRunId) ?? data.payrollRuns[0]
  const records = selectedRun ? data.payroll.filter((item) => item.runId === selectedRun.id || (!item.runId && item.period === selectedRun.period)) : []
  const eligibleEmployeeCount = data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').length

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await generatePayroll({ ...form, deductionRate: Number(form.deductionRate) }); setShowGenerate(false) } catch { /* Keep protected input. */ }
  }
  const confirmTransition = async () => {
    if (!pendingTransition) return
    try { await transitionPayrollRun(pendingTransition.id, pendingTransition.next); setPendingTransition(null) } catch { /* Keep confirmation visible. */ }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Controlled payroll workflow" title="Payroll Runs" description="Move each period through Draft → Validation → Approved → Released → Paid → Locked. Employees see a payslip only after release." actions={<button className="button button-primary" onClick={() => setShowGenerate(true)}><PhilippinePeso />Generate payroll</button>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={PhilippinePeso} label="Latest net total" value={selectedRun ? formatMoney(selectedRun.netTotal) : '—'} tone="green" /><StatCard icon={Users} label="Employees in run" value={selectedRun?.employeeCount ?? 0} tone="blue" /><StatCard icon={ClipboardList} label="Current stage" value={selectedRun?.status ?? 'No run'} tone="amber" /></div>
    <section className="panel payroll-pipeline"><div className="panel-header"><div><h2>Period controls</h2><p>Select a run and advance it one accountable step at a time.</p></div><select value={selectedRun?.id ?? ''} onChange={(event) => setSelectedRunId(Number(event.target.value))}>{data.payrollRuns.map((item) => <option key={item.id} value={item.id}>{item.period} · {item.status}</option>)}</select></div>{selectedRun ? <><div className="pipeline-track">{stages.map((stage, index) => { const currentIndex = stages.indexOf(selectedRun.status); return <div key={stage} className={index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}><span>{index < currentIndex ? <Check /> : index + 1}</span><strong>{stage}</strong></div> })}</div><div className="pipeline-summary"><div><span>Gross total</span><strong>{formatMoney(selectedRun.grossTotal)}</strong></div><div><span>Net total</span><strong>{formatMoney(selectedRun.netTotal)}</strong></div><div><span>Deduction rate</span><strong>{selectedRun.deductionRate}%</strong></div>{payrollNext[selectedRun.status] ? <button className="button button-primary" onClick={() => { const next = payrollNext[selectedRun.status]; if (next) setPendingTransition({ id: selectedRun.id, current: selectedRun.status, next, period: selectedRun.period }) }}>Advance to {payrollNext[selectedRun.status]}<ChevronRight /></button> : <Badge tone="neutral">Run locked</Badge>}</div></> : <EmptyState icon={PhilippinePeso} title="No payroll run" text="Generate the first payroll period to begin validation." />}</section>
    <section className="panel"><div className="panel-header"><div><h2>Employee calculations</h2><p>Base pay, rewards, deductions, and net amount for the selected run</p></div></div>{records.length ? <TableShell><thead><tr><th>Employee</th><th>Base</th><th>Allowances</th><th>Bonuses</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead><tbody>{records.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{formatMoney(item.gross)}</td><td>{formatMoney(item.allowances)}</td><td>{formatMoney(item.bonuses)}</td><td>{formatMoney(item.deductions)}</td><td><strong>{formatMoney(item.net)}</strong></td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td></tr>)}</tbody></TableShell> : <EmptyState icon={ClipboardList} title="No calculations in this run" text="Regenerate a draft to include active employees." />}</section>
    {showGenerate && <Modal title="Generate payroll draft" size="large" onClose={() => setShowGenerate(false)}>
      <div className="payroll-draft-shell">
        <section className="payroll-draft-intro">
          <span className="payroll-draft-intro-icon"><ReceiptText aria-hidden="true" /></span>
          <div>
            <small>Controlled payroll preparation</small>
            <h3>Build an auditable payroll draft</h3>
            <p>Set the pay cycle and deduction policy, then review the protected run summary before creating employee calculations.</p>
          </div>
          <span className="payroll-draft-state"><ShieldCheck aria-hidden="true" />Draft only</span>
        </section>

        <form className="payroll-draft-form" onSubmit={submit}>
          <div className="payroll-draft-content">
            <section className="payroll-draft-fields" aria-labelledby="payroll-draft-settings-title">
              <header className="payroll-draft-section-heading">
                <span><CalendarDays aria-hidden="true" /></span>
                <div>
                  <h4 id="payroll-draft-settings-title">Run settings</h4>
                  <p>Define the period and the standard deduction applied to this draft.</p>
                </div>
              </header>

              <div className="payroll-premium-field">
                <label htmlFor="payroll-period">Pay period</label>
                <div className="payroll-input-shell">
                  <CalendarDays aria-hidden="true" />
                  <input id="payroll-period" value={form.period} maxLength={60} onChange={(event) => setForm({ ...form, period: event.target.value })} placeholder="e.g. August 2026" required />
                </div>
                <small>Use a clear month and year so the run is easy to identify.</small>
              </div>

              <div className="payroll-premium-field">
                <label htmlFor="payroll-deduction-rate">Deduction rate (%)</label>
                <div className="payroll-input-shell payroll-rate-input">
                  <PhilippinePeso aria-hidden="true" />
                  <input id="payroll-deduction-rate" type="number" min={0} max={50} step="0.01" value={form.deductionRate} onChange={(event) => setForm({ ...form, deductionRate: Number(event.target.value) })} required />
                  <strong>%</strong>
                </div>
                <small>Allowed range: 0% to 50%, with up to two decimal places.</small>
              </div>
            </section>

            <aside className="payroll-draft-review" aria-labelledby="payroll-draft-review-title">
              <header>
                <div>
                  <small>Review before generating</small>
                  <h4 id="payroll-draft-review-title">Draft summary</h4>
                </div>
                <span><ShieldCheck aria-hidden="true" /></span>
              </header>
              <dl>
                <div>
                  <dt>Eligible workforce</dt>
                  <dd><strong>{eligibleEmployeeCount}</strong><span>active {eligibleEmployeeCount === 1 ? 'employee' : 'employees'}</span></dd>
                </div>
                <div>
                  <dt>Deduction policy</dt>
                  <dd><strong>{Number(form.deductionRate || 0).toFixed(2)}%</strong><span>standard rate</span></dd>
                </div>
              </dl>
              <div className="payroll-draft-visibility">
                <LockKeyhole aria-hidden="true" />
                <div>
                  <strong>Employee visibility stays off</strong>
                  <p>Payslips remain private until an authorized administrator advances this run to Released.</p>
                </div>
              </div>
              <ul>
                <li><Check aria-hidden="true" />Calculations are created in Draft</li>
                <li><Check aria-hidden="true" />The administrator action is logged</li>
                <li><Check aria-hidden="true" />Locked periods remain protected</li>
              </ul>
            </aside>
          </div>

          <footer className="payroll-draft-footer">
            <div className="payroll-draft-footnote">
              <LockKeyhole aria-hidden="true" />
              <p><strong>Safe to review.</strong> Regenerating an unlocked period returns it to Draft; locked periods cannot be changed.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button className="button button-primary"><ReceiptText aria-hidden="true" />Generate payroll draft</button>
            </div>
          </footer>
        </form>
      </div>
    </Modal>}
    {pendingTransition && <Modal title={`Advance ${pendingTransition.period}`} onClose={() => setPendingTransition(null)}><div className="confirmation-dialog"><span className="confirmation-icon"><ShieldCheck /></span><h3>{pendingTransition.current} → {pendingTransition.next}</h3><p>{payrollImpact[pendingTransition.next]}</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setPendingTransition(null)}>Cancel</button><button className="button button-primary" onClick={confirmTransition}>Confirm transition</button></div></div></Modal>}
  </div>
}
