import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { BriefcaseBusiness, Building2, CalendarDays, Camera, HeartHandshake, Pencil, Phone, ShieldCheck, UserRound } from 'lucide-react'
import ProfilePhotoEditor from '../../components/ProfilePhotoEditor.js'
import { Badge, Modal, SectionHeading } from '../../components/ui.js'
import { useHrms } from '../../state/useHrms.js'
import { formatDate, formatTenure, statusTone } from '../../utils/format.js'
import type { NavigateProps } from './shared.js'

export function EmployeeProfile({ onNavigate }: NavigateProps) {
  const { user, data, updateEmployee, updateProfilePhoto, notify } = useHrms()
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [editing, setEditing] = useState(false)
  const [confirmingSave, setConfirmingSave] = useState(false)
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoEditorUrl, setPhotoEditorUrl] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const phoneInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) phoneInput.current?.focus()
  }, [editing])
  if (!user) return null
  const record = data?.employees.find((item) => item.id === user.id)
  const manager = record?.managerId ? data?.employees.find((item) => item.id === record.managerId) : undefined
  const initials = `${user.firstName[0] || ''}${user.lastName[0] || ''}`
  const currentPhone = (user.phone || '').trim()
  const nextPhone = phone.trim()
  const phoneChanged = nextPhone !== currentPhone
  const fullName = `${user.preferredName || user.firstName} ${user.lastName}`

  const resetPhotoEditor = () => {
    if (photoEditorUrl) URL.revokeObjectURL(photoEditorUrl)
    setPhotoEditorUrl('')
    if (photoInput.current) photoInput.current.value = ''
  }
  const closePhotoEditor = () => {
    if (photoSaving) return
    resetPhotoEditor()
  }
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('Choose a JPG, PNG, or WebP profile photo.', 'error')
      event.target.value = ''
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      notify('Choose a profile photo smaller than 8 MB.', 'error')
      event.target.value = ''
      return
    }
    if (photoEditorUrl) URL.revokeObjectURL(photoEditorUrl)
    setPhotoEditorUrl(URL.createObjectURL(file))
  }
  const savePhoto = async (photo: Blob) => {
    setPhotoSaving(true)
    try {
      await updateProfilePhoto(photo)
      resetPhotoEditor()
    } finally { setPhotoSaving(false) }
  }
  const beginEditing = () => {
    setPhone(user.phone ?? '')
    setEditing(true)
  }
  const cancelEditing = () => {
    if (phoneSaving) return
    setConfirmingSave(false)
    setPhone(user.phone ?? '')
    setEditing(false)
  }
  const requestSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing || phoneSaving || !phoneChanged) return
    if (nextPhone.length < 7 || nextPhone.length > 30) {
      notify('Enter a phone number between 7 and 30 characters.', 'error')
      return
    }
    setConfirmingSave(true)
  }
  const confirmSave = async () => {
    if (!confirmingSave || phoneSaving) return
    setPhoneSaving(true)
    try {
      await updateEmployee(user.id, { phone: nextPhone })
      setConfirmingSave(false)
      setEditing(false)
    } catch { /* Keep the confirmation available for a retry. */ }
    finally { setPhoneSaving(false) }
  }

  const employment: Array<[string, string | undefined]> = [
    ['Employee ID', user.id],
    ['Work email', user.email],
    ['Legal name', [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')],
    ['Preferred name', user.preferredName],
    ['Department', user.department],
    ['Position', user.position],
    ['Employment type', user.employmentType],
    ['Work arrangement', user.workArrangement],
    ['Work location', user.workLocation],
    ['Start date', user.hireDate ? formatDate(user.hireDate) : undefined],
    ['Reports to', manager ? `${manager.firstName} ${manager.lastName}` : undefined],
    ['Cost center', user.costCenter],
  ]

  return <div className="page-stack profile-page">
    <SectionHeading title="My Profile" description="Your employment details and contact information." />
    <section className="panel profile-header" aria-label="Profile summary">
      <input ref={photoInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile picture" tabIndex={-1} onChange={choosePhoto} />
      <button type="button" className="profile-avatar-button" onClick={() => photoInput.current?.click()}>
        <span className="profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span aria-hidden="true">{initials}</span>}</span>
        <span className="profile-avatar-action"><Camera aria-hidden="true" />Change photo</span>
      </button>
      <div className="profile-identity">
        <h2>{fullName}</h2>
        <p><span><BriefcaseBusiness aria-hidden="true" />{user.position || 'Position not set'}</span><span><Building2 aria-hidden="true" />{user.department || 'Department not set'}</span></p>
        <div className="inline-badges"><Badge tone={statusTone(user.status)}>{user.status}</Badge><Badge tone="neutral">{user.id}</Badge></div>
      </div>
      <dl className="profile-highlights">
        <div><dt><CalendarDays aria-hidden="true" />With the company</dt><dd>{formatTenure(user.hireDate)}</dd></div>
        <div><dt><UserRound aria-hidden="true" />Manager</dt><dd>{manager ? `${manager.firstName} ${manager.lastName}` : 'Not assigned'}</dd></div>
      </dl>
    </section>

    <div className="profile-grid">
      <section className="panel" aria-labelledby="profile-employment-title">
        <div className="panel-header">
          <div><h2 id="profile-employment-title">Employment information</h2><p>Managed by HR. Found a mistake? <button type="button" className="text-button inline-link" onClick={() => onNavigate('requests?new=Profile%20Correction')}>Ask HR to correct it</button></p></div>
        </div>
        <dl className="detail-list">{employment.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={value ? undefined : 'is-missing'}>{value || 'Not provided'}</dd></div>)}</dl>
      </section>

      <div className="side-stack">
        <form className="panel" onSubmit={requestSave} aria-labelledby="profile-contact-title">
          <div className="panel-header">
            <div><h2 id="profile-contact-title">Contact details</h2><p>So HR can reach you</p></div>
            {!editing && <button type="button" className="button button-secondary button-small" onClick={beginEditing}><Pencil aria-hidden="true" />Edit</button>}
          </div>
          <div className="panel-body">
            {editing ? <>
              <label className="rf-field">
                <span className="rf-label">Phone number</span>
                <input ref={phoneInput} type="tel" autoComplete="tel" value={phone} minLength={7} maxLength={30} onChange={(event) => setPhone(event.target.value)} placeholder="+63 912 345 6789" disabled={phoneSaving} required />
              </label>
              <div className="rf-actions"><button type="button" className="button button-secondary" onClick={cancelEditing} disabled={phoneSaving}>Cancel</button><button type="submit" className="button button-primary" disabled={phoneSaving || !phoneChanged}>{phoneSaving ? 'Saving…' : 'Save changes'}</button></div>
            </> : <dl className="detail-list detail-list-single">
              <div><dt><Phone aria-hidden="true" />Phone number</dt><dd className={currentPhone ? undefined : 'is-missing'}>{currentPhone || 'Not provided'}</dd></div>
              <div><dt>Work email</dt><dd>{user.email}</dd></div>
            </dl>}
          </div>
        </form>

        <section className="panel" aria-labelledby="profile-emergency-title">
          <div className="panel-header"><div><h2 id="profile-emergency-title">Emergency contact</h2><p>Kept private to HR</p></div><HeartHandshake className="panel-header-icon" aria-hidden="true" /></div>
          <dl className="detail-list detail-list-single">
            <div><dt>Name</dt><dd className={record?.emergencyContactName ? undefined : 'is-missing'}>{record?.emergencyContactName || 'Not provided'}</dd></div>
            <div><dt>Relationship</dt><dd className={record?.emergencyContactRelationship ? undefined : 'is-missing'}>{record?.emergencyContactRelationship || 'Not provided'}</dd></div>
            <div><dt>Phone</dt><dd className={record?.emergencyContactPhone ? undefined : 'is-missing'}>{record?.emergencyContactPhone || 'Not provided'}</dd></div>
          </dl>
          <p className="panel-footnote"><button type="button" className="text-button inline-link" onClick={() => onNavigate('requests?new=Profile%20Correction')}>Ask HR to update your emergency contact</button></p>
        </section>

        <p className="page-footnote"><ShieldCheck aria-hidden="true" />Your photo is stored privately, and every profile change is recorded.</p>
      </div>
    </div>

    {confirmingSave && <Modal title="Confirm profile changes" onClose={() => setConfirmingSave(false)} dismissible={!phoneSaving} size="small">
      <div className="confirm-dialog">
        <div className="confirm-dialog-copy"><h3>Save this phone number?</h3><div className="confirm-dialog-message"><p>Only your contact number changes. HR is able to see the new number right away.</p></div></div>
        <dl className="change-summary"><div><dt>Current</dt><dd>{currentPhone || 'Not provided'}</dd></div><span aria-hidden="true">→</span><div><dt>New</dt><dd>{nextPhone}</dd></div></dl>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setConfirmingSave(false)} disabled={phoneSaving}>Keep editing</button><button type="button" className="button button-primary" onClick={() => void confirmSave()} disabled={phoneSaving}>{phoneSaving ? 'Saving…' : 'Confirm & save'}</button></div>
      </div>
    </Modal>}
    {photoEditorUrl && <Modal title="Crop your profile picture" onClose={closePhotoEditor} size="large" dismissible={!photoSaving}><ProfilePhotoEditor sourceUrl={photoEditorUrl} saving={photoSaving} onCancel={closePhotoEditor} onSave={savePhoto} /></Modal>}
  </div>
}
