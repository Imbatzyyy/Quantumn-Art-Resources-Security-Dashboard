import { useEffect, useState, type FormEvent } from 'react'
import { requireSupabase } from '../services/supabaseClient.js'
import { useHrms } from '../state/useHrms.js'
import { Modal } from './ui.js'
import type { Tables } from '../types/database.js'

export function LeavePolicies() {
  const { user, lastSyncedAt, refreshData } = useHrms()
  const [open, setOpen] = useState(false)
  const [policies, setPolicies] = useState<Tables<'leave_policies'>[]>([])
  const [editing, setEditing] = useState<Tables<'leave_policies'> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    if (!open) return
    let active = true
    void (async () => {
      try {
        const result = await requireSupabase().from('leave_policies').select('*').order('leave_type')
        if (result.error) throw result.error
        if (active) { setPolicies(result.data); setError('') }
      } catch { if (active) setError('Leave policies could not be loaded. Close and try again.') }
    })()
    return () => { active = false }
  }, [open, lastSyncedAt])
  if (!['admin', 'hr_admin'].includes(user?.role || '')) return null
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !confirmed || busy) return
    setBusy(true); setError('')
    try {
      const { error: failure } = await requireSupabase().rpc('save_leave_policy', { selected_type: editing.leave_type, allowance: editing.annual_days as number, policy_description: editing.description })
      if (failure) throw failure
      setPolicies(current => current.map(item => item.leave_type === editing.leave_type ? editing : item))
      setEditing(null); setConfirmed(false)
      await refreshData()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The policy could not be saved.') }
    finally { setBusy(false) }
  }
  return <><button className="button button-secondary" onClick={() => setOpen(true)}>Leave policies</button>{open && <Modal title="Leave policies" dismissible={!busy} onClose={() => { setOpen(false); setEditing(null) }}><div className="rf-form rf-form--sm"><p>Allowances apply per employee, leave type and calendar year. Pending and approved requests reserve days. These are organization settings, not a legal entitlement calculation.</p>{error && <p role="alert" className="form-error">{error}</p>}{!editing ? <div className="page-stack">{policies.map(policy => <div className="panel" key={policy.leave_type}><h3>{policy.leave_type}</h3><p>{policy.annual_days === null ? 'Case-by-case review' : `${policy.annual_days} calendar days per year`}</p><p>{policy.description}</p><button className="text-button" onClick={() => { setEditing(policy); setConfirmed(false) }}>Edit {policy.leave_type.toLowerCase()} policy</button></div>)}</div> : <form onSubmit={save} className="page-stack"><h3>{editing.leave_type}</h3><label className="rf-check"><input type="checkbox" checked={editing.annual_days === null} onChange={event => setEditing({ ...editing, annual_days: event.target.checked ? null : 0 })} />Review case by case (no fixed allowance)</label>{editing.annual_days !== null && <label className="rf-field"><span>Annual calendar days</span><input type="number" min="0" max="365" step="0.5" required value={editing.annual_days} onChange={event => setEditing({ ...editing, annual_days: Number(event.target.value) })} /></label>}<label className="rf-field"><span>Employee guidance</span><textarea maxLength={300} value={editing.description} onChange={event => setEditing({ ...editing, description: event.target.value })} /></label><label className="rf-check"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Apply this organization-wide change. Existing requests remain recorded; future submissions and approvals use the new allowance.</label><div className="modal-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" disabled={busy || !confirmed}>{busy ? 'Saving…' : 'Save policy'}</button></div></form>}</div></Modal>}</>
}
