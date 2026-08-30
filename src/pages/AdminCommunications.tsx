import { useState, type FormEvent } from 'react'
import { BellRing, Plus } from 'lucide-react'
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await addAnnouncement(form); setShowAdd(false); setForm(emptyAnnouncement) } catch { /* Keep protected input. */ }
  }
  return <div className="page-stack"><SectionHeading eyebrow="Clear organization updates" title="Communications" description="Publish concise announcements that also create employee notifications." actions={<button className="button button-primary" onClick={() => setShowAdd(true)}><Plus />New announcement</button>} /><div className="announcement-grid">{data.announcements.map((item) => <article className="panel announcement-card" key={item.id}><div><Badge tone={item.priority === 'High' ? 'warning' : 'info'}>{item.priority}</Badge><time>{formatDate(item.date)}</time></div><h2>{item.title}</h2><p>{item.content}</p></article>)}</div>{!data.announcements.length && <EmptyState icon={BellRing} title="No announcements" text="Publish the first organization update." />}{showAdd && <Modal title="Publish announcement" onClose={() => setShowAdd(false)}><form className="form-grid" onSubmit={submit}><label className="span-2">Title<input minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label className="span-2">Message<textarea rows={5} minLength={3} maxLength={1000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Normal</option><option>High</option></select></label><p className="form-note span-2">Publishing inserts an announcement and creates a notification for every active employee.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="button button-primary">Publish & notify</button></div></form></Modal>}</div>
}
