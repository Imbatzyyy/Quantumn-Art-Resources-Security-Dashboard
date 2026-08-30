import { useState, type FormEvent } from 'react'
import { Check, ChevronRight, ClipboardList, PhilippinePeso, ShieldCheck, Users } from 'lucide-react'
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
    {showGenerate && <Modal title="Generate payroll draft" onClose={() => setShowGenerate(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Pay period<input value={form.period} maxLength={60} onChange={(event) => setForm({ ...form, period: event.target.value })} required /></label><label>Deduction rate (%)<input type="number" min={0} max={50} step="0.01" value={form.deductionRate} onChange={(event) => setForm({ ...form, deductionRate: Number(event.target.value) })} required /></label><label>Eligible employees<input value={`${data.employees.filter((item) => item.role === 'employee' && item.status === 'Active').length} active employees`} disabled /></label><p className="form-note span-2">Regenerating an unlocked period returns it to Draft. Locked periods cannot be changed.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowGenerate(false)}>Cancel</button><button className="button button-primary">Generate secure draft</button></div></form></Modal>}
    {pendingTransition && <Modal title={`Advance ${pendingTransition.period}`} onClose={() => setPendingTransition(null)}><div className="confirmation-dialog"><span className="confirmation-icon"><ShieldCheck /></span><h3>{pendingTransition.current} → {pendingTransition.next}</h3><p>{payrollImpact[pendingTransition.next]}</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setPendingTransition(null)}>Cancel</button><button className="button button-primary" onClick={confirmTransition}>Confirm transition</button></div></div></Modal>}
  </div>
}
