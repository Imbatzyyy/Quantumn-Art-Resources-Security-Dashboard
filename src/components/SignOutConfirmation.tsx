import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Modal } from './ui.js'

interface SignOutConfirmationProps {
  open: boolean
  portal: 'admin' | 'employee'
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export default function SignOutConfirmation({ open, portal, onCancel, onConfirm }: SignOutConfirmationProps) {
  const [signingOut, setSigningOut] = useState(false)
  if (!open) return null

  const confirm = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await onConfirm()
      onCancel()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Modal title="Confirm sign out" onClose={() => !signingOut && onCancel()} dismissible={!signingOut}>
      <div className="signout-confirmation" aria-busy={signingOut}>
        <span className="signout-confirmation-icon"><LogOut aria-hidden="true" /></span>
        <div>
          <small>{portal === 'admin' ? 'Administrator session' : 'Employee session'}</small>
          <h3>Sign out of Quantum HRMS?</h3>
          <p>You’ll return to the {portal === 'admin' ? 'Administrator' : 'Employee'} sign-in page. No changes will be made to your account.</p>
        </div>
        <div className="modal-actions">
          <button className="button button-secondary" type="button" autoFocus onClick={onCancel} disabled={signingOut}>Cancel</button>
          <button className="button button-danger" type="button" onClick={confirm} disabled={signingOut}><LogOut aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </div>
    </Modal>
  )
}
