import { useState, type FormEvent } from 'react'
import { BellRing, Plus, Send, ShieldCheck, UsersRound } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading } from '../components/ui.js'
import { Field, FormFooter, FormIntro, Note, SummaryList } from '../components/readable.js'
import { useSubmissionLock } from '../utils/useSubmissionLock.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate } from '../utils/format.js'
import type { AnnouncementInput } from '../types/hrms.js'

const emptyAnnouncement: AnnouncementInput = { title: '', content: '', priority: 'Normal' }

export default function AdminCommunications() {
  const submission = useSubmissionLock()
  const { data, addAnnouncement } = useHrms()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AnnouncementInput>(emptyAnnouncement)
  if (!data) return null
  const recipients = data.employees.filter((item) => item.role === 'employee' && ['Active', 'On Leave'].includes(item.status))
  const isHighPriority = form.priority === 'High'
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!submission.begin()) return
    try { await addAnnouncement(form); setShowAdd(false); setForm(emptyAnnouncement) } catch { /* Keep protected input. */ } finally { submission.finish() }
  }
  return <div className="page-stack"><SectionHeading eyebrow="Clear organization updates" title="Communications" description="Publish concise announcements that also create employee notifications." actions={<button className="button button-primary" onClick={() => setShowAdd(true)}><Plus />New announcement</button>} /><div className="announcement-grid">{data.announcements.map((item) => <article className="panel announcement-card" key={item.id}><div><Badge tone={item.priority === 'High' ? 'warning' : 'info'}>{item.priority}</Badge><time>{formatDate(item.date)}</time></div><h2>{item.title}</h2><p>{item.content}</p></article>)}</div>{!data.announcements.length && <EmptyState icon={BellRing} title="No announcements" text="Publish the first organization update." />}{showAdd && <Modal title="Publish announcement" onClose={() => setShowAdd(false)} size="large">
    <form className="rf-form" onSubmit={submit}>
      <FormIntro>Write a short, clear update. It is posted to every employee’s portal and each person receives a notification.</FormIntro>

      <div className="rf-layout">
        <div className="rf-fields">
          <Field label="Title" count={`${form.title.length}/120`} help="Keep the headline short and specific.">{(control) => <input {...control} minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What should employees know?" required />}</Field>
          <Field label="Message" count={`${form.content.length}/1000`} help="Say what is changing, why it matters, and what employees should do.">{(control) => <textarea {...control} rows={6} minLength={3} maxLength={1000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Explain the update and the next step for employees" required />}</Field>
          <fieldset className="rf-field rf-choices rf-choices--2">
            <legend className="rf-label">Priority</legend>
            <div>
              <label className={`rf-choice${!isHighPriority ? ' is-selected' : ''}`}><input type="radio" name="announcement-priority" value="Normal" checked={!isHighPriority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><strong>Normal update</strong><small>General information for everyone</small></span></label>
              <label className={`rf-choice${isHighPriority ? ' is-selected' : ''}`}><input type="radio" name="announcement-priority" value="High" checked={isHighPriority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><strong>High priority</strong><small>Employees need to act soon</small></span></label>
            </div>
          </fieldset>
          <p className="rf-callout"><UsersRound aria-hidden="true" /><span><strong>{recipients.length} {recipients.length === 1 ? 'employee' : 'employees'}</strong> will be notified: everyone who is active or on leave.</span></p>
        </div>

        <aside className="rf-summary" aria-label="Announcement preview">
          <h3>What employees will see</h3>
          <article className="rf-preview">
            <div className="rf-preview-meta"><Badge tone={isHighPriority ? 'warning' : 'info'}>{form.priority}</Badge><time>Publishing today</time></div>
            <h4>{form.title.trim() || 'Your announcement title'}</h4>
            <p>{form.content.trim() || 'Your message will appear here as you type.'}</p>
          </article>
          <SummaryList items={[
            ['Recipients', `${recipients.length} ${recipients.length === 1 ? 'employee' : 'employees'}`],
            ['Priority', form.priority],
            ['Notification', 'Sent when published'],
          ]} />
          <Note icon={ShieldCheck}>Only authorized HR administrators can publish announcements.</Note>
        </aside>
      </div>

      <FormFooter icon={Send} note="Check the title, message, and priority before publishing.">
        <button type="button" className="button button-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
        <button className="button button-primary" disabled={submission.busy}><Send aria-hidden="true" />Publish &amp; notify</button>
      </FormFooter>
    </form>
  </Modal>}</div>
}
