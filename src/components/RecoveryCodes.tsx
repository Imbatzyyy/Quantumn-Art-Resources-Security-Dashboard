import { useState } from 'react'
import { Modal } from './ui.js'
import { requireSupabase } from '../services/supabaseClient.js'
import '../pages/SignInVerificationPage.css'

export default function RecoveryCodes({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const close = () => { if (!busy && (!codes || saved)) { setOpen(false); setCodes(null); setSaved(false); setError('') } }
  const generate = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const { data, error: problem } = await requireSupabase().rpc('create_mfa_recovery_codes')
      if (problem) throw new Error(problem.message)
      if (!Array.isArray(data) || data.length !== 8 || !data.every(code => typeof code === 'string' && /^[a-f0-9]{32}$/.test(code))) throw new Error('Recovery codes could not be read.')
      setCodes(data as string[])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Verify your authenticator and try again.') }
    finally { setBusy(false) }
  }
  return <><button className="button button-secondary" disabled={!enabled} onClick={() => setOpen(true)}>Recovery codes</button>{open && <Modal title="Private MFA recovery codes" onClose={close}><div className="rf-form rf-form--sm"><p>{codes ? 'Save these eight codes privately. Each works once, together with your password and email verification. Never share a code with HR or another administrator.' : 'Generate new single-use codes for a lost authenticator. This immediately replaces all previously saved recovery codes. Your current session must be verified with an authenticator.'}</p>{codes && <><pre className="mfa-recovery-codes">{codes.join('\n')}</pre><label className="account-policy-confirm"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} /><span>I saved these codes privately.</span></label></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-secondary" disabled={busy || !!codes && !saved} onClick={close}>{codes ? 'Done' : 'Cancel'}</button>{!codes && <button className="button button-primary" disabled={busy} onClick={() => void generate()}>{busy ? 'Generating…' : 'Replace recovery codes'}</button>}</div></div></Modal>}</>
}
