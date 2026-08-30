import { useState, type FormEvent } from 'react'
import { AlertTriangle, BellRing, Eye, Megaphone, MessageSquareText, Plus, Send, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate } from '../utils/format.js'
import type { AnnouncementInput } from '../types/hrms.js'

const emptyAnnouncement: AnnouncementInput = { title: '', content: '', priority: 'Normal' }

export default function AdminCommunications() {
  const { data, addAnnouncement } = useHrms()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AnnouncementInput>(emptyAnnouncement)
  if (!data) return null
  const recipients = data.employees.filter((item) => item.role === 'employee' && ['Active', 'On Leave'].includes(item.status))
  const isHighPriority = form.priority === 'High'
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await addAnnouncement(form); setShowAdd(false); setForm(emptyAnnouncement) } catch { /* Keep protected input. */ }
  }
  return <div className="page-stack"><SectionHeading eyebrow="Clear organization updates" title="Communications" description="Publish concise announcements that also create employee notifications." actions={<button className="button button-primary" onClick={() => setShowAdd(true)}><Plus />New announcement</button>} /><div className="announcement-grid">{data.announcements.map((item) => <article className="panel announcement-card" key={item.id}><div><Badge tone={item.priority === 'High' ? 'warning' : 'info'}>{item.priority}</Badge><time>{formatDate(item.date)}</time></div><h2>{item.title}</h2><p>{item.content}</p></article>)}</div>{!data.announcements.length && <EmptyState icon={BellRing} title="No announcements" text="Publish the first organization update." />}{showAdd && <Modal title="Publish announcement" onClose={() => setShowAdd(false)} size="large">
    <form className="announcement-create-shell" onSubmit={submit}>
      <section className="announcement-create-intro">
        <span className="announcement-create-intro-icon"><Megaphone aria-hidden="true" /></span>
        <div><small>Organization broadcast</small><h3>Share a clear update with every employee</h3><p>Compose a concise announcement, review its employee-facing presentation, and publish one synchronized notification.</p></div>
        <span className="announcement-create-state"><Sparkles aria-hidden="true" />Live preview</span>
      </section>

      <div className="announcement-create-content">
        <section className="announcement-compose-card" aria-labelledby="announcement-compose-title">
          <header className="announcement-form-heading"><span><MessageSquareText aria-hidden="true" /></span><div><h4 id="announcement-compose-title">Message composer</h4><p>Use a specific title and an action-oriented employee message.</p></div></header>

          <label className="announcement-premium-field">Title
            <span className="announcement-input-shell"><Megaphone aria-hidden="true" /><input aria-label="Title" minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What should employees know?" required /></span>
            <small><span>Keep the headline direct and recognizable.</span><strong>{form.title.length}/120</strong></small>
          </label>

          <label className="announcement-premium-field">Message
            <textarea aria-label="Message" rows={6} minLength={3} maxLength={1000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Explain the update, why it matters, and what employees should do next…" required />
            <small><span>Plain language is easier to scan in the employee portal.</span><strong>{form.content.length}/1000</strong></small>
          </label>

          <fieldset className="announcement-priority-picker">
            <legend>Priority</legend>
            <div>
              <label className={!isHighPriority ? 'active' : ''}><input type="radio" name="announcement-priority" value="Normal" checked={!isHighPriority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><BellRing aria-hidden="true" /></span><div><strong>Normal update</strong><small>Routine organization information</small></div></label>
              <label className={isHighPriority ? 'active high' : ''}><input type="radio" name="announcement-priority" value="High" checked={isHighPriority} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><AlertTriangle aria-hidden="true" /></span><div><strong>High priority</strong><small>Time-sensitive employee action</small></div></label>
            </div>
          </fieldset>

          <div className="announcement-audience-card"><UsersRound aria-hidden="true" /><div><small>Notification audience</small><strong>{recipients.length} eligible {recipients.length === 1 ? 'employee' : 'employees'}</strong><p>Supabase creates one notification for each active or on-leave employee after the announcement is published.</p></div><Badge tone="success">Organization-wide</Badge></div>
        </section>

        <aside className={`announcement-preview ${isHighPriority ? 'high' : ''}`} aria-labelledby="announcement-preview-title">
          <header><div><small>Employee view</small><h4 id="announcement-preview-title">Announcement preview</h4></div><span><Eye aria-hidden="true" /></span></header>
          <article className="announcement-preview-card">
            <div><Badge tone={isHighPriority ? 'warning' : 'info'}>{form.priority}</Badge><time>Publishing today</time></div>
            <span className="announcement-preview-icon">{isHighPriority ? <AlertTriangle aria-hidden="true" /> : <Megaphone aria-hidden="true" />}</span>
            <h5>{form.title.trim() || 'Your announcement title'}</h5>
            <p>{form.content.trim() || 'Your employee-facing message will appear here as you compose it.'}</p>
          </article>
          <div className="announcement-notification-preview"><BellRing aria-hidden="true" /><div><small>Notification created</small><strong>{form.title.trim() || 'New organization update'}</strong><p>{form.content.trim() || 'Employees receive this message in their notification center.'}</p></div></div>
          <div className="announcement-preview-assurance"><ShieldCheck aria-hidden="true" /><div><strong>Protected publishing workflow</strong><p>Only authorized HR administrators can publish. The database trigger creates employee notifications after the insert succeeds.</p></div></div>
        </aside>
      </div>

      <footer className="announcement-create-footer">
        <div className="announcement-create-footnote"><Send aria-hidden="true" /><p><strong>Ready for organization-wide delivery.</strong> Review the title, message, and priority before notifying employees.</p></div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="button button-primary"><Send aria-hidden="true" />Publish & notify</button></div>
      </footer>
    </form>
  </Modal>}</div>
}
