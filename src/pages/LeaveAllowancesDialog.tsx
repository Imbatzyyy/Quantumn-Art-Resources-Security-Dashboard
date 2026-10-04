import { useState, type FormEvent } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '../components/ui.js'
import type { LeavePolicyInput, LeavePolicyRecord } from '../types/hrms.js'

interface Draft { type: string; days: string; caseByCase: boolean; description: string }

const draftOf = (policy: LeavePolicyRecord): Draft => ({
  type: policy.type,
  days: policy.annualDays == null ? '' : String(policy.annualDays),
  caseByCase: policy.annualDays == null,
  description: policy.description,
})

const daysOf = (draft: Draft) => draft.caseByCase ? null : Number(draft.days)
const validDays = (draft: Draft) => draft.caseByCase || (draft.days.trim() !== '' && Number(draft.days) >= 0 && Number(draft.days) <= 365)

/** HR edits the yearly allowance for each leave type. */
export function LeaveAllowancesDialog({ policies, onSave, onClose }: { policies: LeavePolicyRecord[]; onSave: (input: LeavePolicyInput) => Promise<unknown>; onClose: () => void }) {
  const [drafts, setDrafts] = useState(() => policies.map(draftOf))
  const [saving, setSaving] = useState(false)
  const changed = drafts.filter((draft) => {
    const original = policies.find((policy) => policy.type === draft.type)
    return !original || daysOf(draft) !== original.annualDays || draft.description.trim() !== original.description
  })
  const ready = drafts.every(validDays) && changed.length > 0
  const update = (type: string, changes: Partial<Draft>) => setDrafts((current) => current.map((draft) => draft.type === type ? { ...draft, ...changes } : draft))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ready) return
    setSaving(true)
    try {
      for (const draft of changed) await onSave({ type: draft.type, annualDays: daysOf(draft), description: draft.description })
      onClose()
    } catch { /* The toast explains the error; keep the form open. */ }
    finally { setSaving(false) }
  }

  return <Modal title="Leave allowances" onClose={() => !saving && onClose()} dismissible={!saving}>
    <form className="rf-form rf-form-compact" onSubmit={submit} aria-busy={saving}>
      <p className="rf-help rf-tip"><Info aria-hidden="true" />Allowances are days per calendar year for every employee. Changes apply right away to balances and new requests.</p>
      <div className="allowance-list">
        {drafts.map((draft) => <fieldset key={draft.type} className="allowance-row">
          <legend>{draft.type} leave</legend>
          <div className="allowance-grid">
          <label className="rf-field allowance-days">
            <span className="rf-label">Days per year</span>
            <input type="number" inputMode="decimal" min={0} max={365} step={0.5} value={draft.days} disabled={draft.caseByCase} required={!draft.caseByCase} aria-label={`${draft.type} leave days per year`} onChange={(event) => update(draft.type, { days: event.target.value })} />
          </label>
          <label className="rf-check allowance-case">
            <input type="checkbox" checked={draft.caseByCase} onChange={(event) => update(draft.type, { caseByCase: event.target.checked, days: event.target.checked ? '' : draft.days || '0' })} />
            <span>No fixed allowance (HR decides case by case)</span>
          </label>
          <label className="rf-field allowance-description">
            <span className="rf-label">Guidance for employees</span>
            <input value={draft.description} maxLength={300} aria-label={`${draft.type} leave guidance`} onChange={(event) => update(draft.type, { description: event.target.value })} />
          </label>
          </div>
        </fieldset>)}
      </div>
      <div className="modal-actions">
        <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="button button-primary" disabled={!ready || saving}>{saving ? 'Saving…' : changed.length > 1 ? `Save ${changed.length} changes` : 'Save changes'}</button>
      </div>
    </form>
  </Modal>
}
