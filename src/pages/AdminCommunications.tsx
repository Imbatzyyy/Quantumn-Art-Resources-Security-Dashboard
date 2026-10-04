import { useState, type FormEvent } from 'react'
import { BellRing, Megaphone, Pencil, Plus, Search, Send, ShieldCheck, Trash2, UsersRound } from 'lucide-react'
import { Badge, ConfirmDialog, EmptyState, Modal, SectionHeading } from '../components/ui.js'
import { Field, FormFooter, FormIntro, Note, SummaryList } from '../components/readable.js'
import { useSubmissionLock } from '../utils/useSubmissionLock.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateTime } from '../utils/format.js'
import type { AnnouncementInput, AnnouncementRecord } from '../types/hrms.js'

const emptyAnnouncement: AnnouncementInput = { title: '', content: '', priority: 'Normal' }

export default function AdminCommunications() {
  const submission = useSubmissionLock()
  const { data, user, addAnnouncement, updateAnnouncement, deleteAnnouncement } = useHrms()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AnnouncementRecord | null>(null)
  const [deleting, setDeleting] = useState<AnnouncementRecord | null>(null)
  const [form, setForm] = useState<AnnouncementInput>(emptyAnnouncement)
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('')
  if (!data) return null
  const recipients = data.employees.filter((item) => item.role === 'employee' && ['Active', 'On Leave'].includes(item.status))
  const isHighPriority = form.priority === 'High'
  const canManage = ['admin', 'hr_admin'].includes(user?.role ?? '')
  const canEdit = canManage && Boolean(updateAnnouncement)
  const canDelete = canManage && Boolean(deleteAnnouncement)
  const startCreate = () => { setEditing(null); setForm(emptyAnnouncement); setShowAdd(true) }
  const startEdit = (item: AnnouncementRecord) => { setEditing(item); setForm({ title: item.title, content: item.content, priority: item.priority }); setShowAdd(true) }
  const closeForm = () => { setShowAdd(false); setEditing(null); setForm(emptyAnnouncement) }
  const unchanged = Boolean(editing) && editing?.title === form.title && editing?.content === form.content && editing?.priority === form.priority
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!submission.begin()) return
    try {
      if (editing) await updateAnnouncement?.(editing.id, form)
      else await addAnnouncement(form)
      closeForm()
    } catch { /* Keep protected input. */ } finally { submission.finish() }
  }
  const visible = data.announcements.filter((item) => (!priority || item.priority === priority) && `${item.title} ${item.content}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="page-stack"><SectionHeading title="Announcements" description="Company news for every employee. Each announcement also sends a notification." actions={<button className="button button-primary" onClick={startCreate}><Plus aria-hidden="true" />New announcement</button>} />
    <section className="panel">
      {data.announcements.length > 0 && <div className="data-table-toolbar">
        <div className="data-table-filters">
          <label className="data-table-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search announcements</span><input type="search" value={query} placeholder="Search announcements" onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="data-table-filter"><span className="sr-only">Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option><option value="High">Important</option><option value="Normal">Normal</option></select></label>
        </div>
        <p className="data-table-count">{visible.length} of {data.announcements.length} announcement{data.announcements.length === 1 ? '' : 's'} · sent to {recipients.length} employee{recipients.length === 1 ? '' : 's'}</p>
      </div>}
      {visible.length > 0 && <ul className="announcement-feed">{visible.map((item) => <li key={item.id} className={canEdit || canDelete ? 'has-actions' : undefined}><span className={`announcement-feed-icon${item.priority === 'High' ? ' is-important' : ''}`} aria-hidden="true"><Megaphone /></span><div><div className="announcement-feed-meta"><Badge tone={item.priority === 'High' ? 'warning' : 'neutral'}>{item.priority === 'High' ? 'Important' : 'Normal'}</Badge><time>{formatDate(item.date)}</time>{item.updatedAt && <span title={`Edited ${formatDateTime(item.updatedAt)}`}>· Edited</span>}</div><h2>{item.title}</h2><p>{item.content}</p></div>{(canEdit || canDelete) && <div className="announcement-feed-actions">{canEdit && <button type="button" className="icon-button" onClick={() => startEdit(item)} aria-label={`Edit ${item.title}`} title="Edit"><Pencil aria-hidden="true" /></button>}{canDelete && <button type="button" className="icon-button icon-button-danger" onClick={() => setDeleting(item)} aria-label={`Delete ${item.title}`} title="Delete"><Trash2 aria-hidden="true" /></button>}</div>}</li>)}</ul>}
      {!data.announcements.length && <EmptyState icon={BellRing} title="No announcements yet" text="Publish the first company update. Every employee is notified." action={<button type="button" className="button button-primary button-small" onClick={startCreate}><Plus aria-hidden="true" />New announcement</button>} />}
      {data.announcements.length > 0 && !visible.length && <EmptyState compact icon={Search} title="No matching announcements" text="Try a different search or priority." />}
    </section>
    {showAdd && <Modal title={editing ? 'Edit announcement' : 'Publish announcement'} onClose={closeForm} size="large">
    <form className="rf-form" onSubmit={submit}>
      <FormIntro>{editing ? 'Correct the title, message or priority. The announcement and the copies in employees’ inboxes are updated. Employees are not notified again.' : 'Write a short, clear update. It is posted to every employee’s portal and each person receives a notification.'}</FormIntro>

      <div className="rf-layout">
        <div className="rf-fields">
          <Field label="Title" count={`${form.title.length}/120`} help="Keep the headline short and specific.">{(control) => <input {...control} minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What should employees know?" required />}</Field>
          <Field label="Message" count={`${form.content.length}/1000`} help="Say what is changing, why it matters, and what employees should do.">{(control) => <textarea {...control} rows={6} minLength={3} maxLength={1000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Explain the update and the next step for employees" required />}</Field>
          <fieldset className="rf-field rf-choices rf-choices--2">
            <legend className="rf-label">Priority</legend>
            <div>
              <label className={`rf-choice${!isHighPriority ? ' is-selected' : ''}`}><input type="radio" name="announcement-priority" value="Normal" checked={!isHighPriority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><strong>Normal update</strong><small>General information for everyone</small></span></label>
              <label className={`rf-choice${isHighPriority ? ' is-selected' : ''}`}><input type="radio" name="announcement-priority" value="High" checked={isHighPriority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><strong>Important</strong><small>Employees need to act soon</small></span></label>
            </div>
          </fieldset>
          {!editing && <p className="rf-callout"><UsersRound aria-hidden="true" /><span><strong>{recipients.length} {recipients.length === 1 ? 'employee' : 'employees'}</strong> will be notified: everyone who is active or on leave.</span></p>}
        </div>

        <aside className="rf-summary" aria-label="Announcement preview">
          <h3>What employees will see</h3>
          <article className="rf-preview">
            <div className="rf-preview-meta"><Badge tone={isHighPriority ? 'warning' : 'neutral'}>{isHighPriority ? 'Important' : 'Normal'}</Badge><time>{editing ? `Published ${formatDate(editing.date)}` : 'Publishing today'}</time></div>
            <h4>{form.title.trim() || 'Your announcement title'}</h4>
            <p>{form.content.trim() || 'Your message will appear here as you type.'}</p>
          </article>
          <SummaryList items={[
            ['Recipients', `${recipients.length} ${recipients.length === 1 ? 'employee' : 'employees'}`],
            ['Priority', form.priority],
            ['Notification', editing ? 'Not sent again' : 'Sent when published'],
          ]} />
          <Note icon={ShieldCheck}>Only authorized HR administrators can publish announcements.</Note>
        </aside>
      </div>

      <FormFooter icon={Send} note={editing ? 'Check your corrections before saving.' : 'Check the title, message, and priority before publishing.'}>
        <button type="button" className="button button-secondary" onClick={closeForm}>Cancel</button>
        {editing
          ? <button className="button button-primary" disabled={submission.busy || unchanged}><Pencil aria-hidden="true" />Save changes</button>
          : <button className="button button-primary" disabled={submission.busy}><Send aria-hidden="true" />Publish &amp; notify</button>}
      </FormFooter>
    </form>
  </Modal>}
    {deleting && <ConfirmDialog
      title="Delete announcement"
      icon={Trash2}
      tone="danger"
      heading={`Delete “${deleting.title}”?`}
      message={<p>It is removed from the announcement feed and from every employee’s inbox. This can’t be undone.</p>}
      confirmLabel="Delete announcement"
      cancelLabel="Keep announcement"
      busyLabel="Deleting…"
      onCancel={() => setDeleting(null)}
      onConfirm={async () => { await deleteAnnouncement?.(deleting.id); setDeleting(null) }}
    />}
  </div>
}
