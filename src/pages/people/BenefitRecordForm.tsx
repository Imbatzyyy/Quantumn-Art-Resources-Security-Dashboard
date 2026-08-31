import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { ShieldCheck } from 'lucide-react'
import { EmployeeAvatar } from '../../components/EmployeeAvatar.js'
import type { BenefitInput, EmployeeRecord } from '../../types/hrms.js'

interface Props {
  employee?: EmployeeRecord
  form: BenefitInput
  setForm: Dispatch<SetStateAction<BenefitInput>>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  saving: boolean
  error: string
}

export function BenefitRecordForm({ employee, form, setForm, onSubmit, onCancel, saving, error }: Props) {
  const set = <K extends keyof BenefitInput>(key: K, value: BenefitInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="benefit-record-form" onSubmit={onSubmit} aria-busy={saving}>
    {employee && <div className="benefit-record-person"><EmployeeAvatar employee={employee} className="benefit-record-avatar" /><div><span>Benefit record for</span><strong>{employee.preferredName || employee.firstName} {employee.lastName}</strong><p>{employee.id} · {employee.department}</p></div></div>}
    <fieldset className="benefit-record-fields" disabled={saving}>
      <section aria-labelledby="benefit-plan-heading">
        <div className="benefit-section-heading"><h3 id="benefit-plan-heading">Plan details</h3><p>Fields marked with * are required.</p></div>
        <div className="benefit-field-grid">
          <label className="benefit-full-width" htmlFor="benefit-plan-name">Plan name <span aria-hidden="true">*</span><input id="benefit-plan-name" value={form.planName} onChange={(event) => set('planName', event.target.value)} placeholder="e.g. Employee health coverage" required /></label>
          <label htmlFor="benefit-type">Benefit type <span aria-hidden="true">*</span><input id="benefit-type" value={form.type} onChange={(event) => set('type', event.target.value)} placeholder="e.g. Health, retirement, insurance" required /></label>
          <label htmlFor="benefit-provider">Provider <span className="benefit-optional">(optional)</span><input id="benefit-provider" value={form.provider} onChange={(event) => set('provider', event.target.value)} placeholder="Provider or insurer name" /></label>
        </div>
      </section>
      <section aria-labelledby="benefit-contributions-heading">
        <div className="benefit-section-heading"><h3 id="benefit-contributions-heading">Contributions</h3><p>Enter the recorded shares in Philippine pesos. Use 0 if none.</p></div>
        <div className="benefit-field-grid">
          <label htmlFor="benefit-employee-share">Employee share (PHP)<input id="benefit-employee-share" type="number" min={0} step="0.01" inputMode="decimal" value={form.employeeShare} onChange={(event) => set('employeeShare', event.target.value)} /></label>
          <label htmlFor="benefit-employer-share">Employer share (PHP)<input id="benefit-employer-share" type="number" min={0} step="0.01" inputMode="decimal" value={form.employerShare} onChange={(event) => set('employerShare', event.target.value)} /></label>
          <label htmlFor="benefit-effective-date">Effective date <span aria-hidden="true">*</span><input id="benefit-effective-date" type="date" value={form.effectiveDate} onChange={(event) => set('effectiveDate', event.target.value)} required /></label>
          <label htmlFor="benefit-status">Status<select id="benefit-status" value={form.status} onChange={(event) => set('status', event.target.value)}><option>Active</option><option>Pending</option><option>Inactive</option></select></label>
        </div>
      </section>
    </fieldset>
    {error && <p className="benefit-record-error" role="alert">{error}</p>}
    <footer className="benefit-record-footer"><p><ShieldCheck size={17} aria-hidden="true" />Saved to this employee’s benefit records.</p><div><button type="button" className="button button-secondary" disabled={saving} onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving benefit…' : 'Save benefit'}</button></div></footer>
  </form>
}
