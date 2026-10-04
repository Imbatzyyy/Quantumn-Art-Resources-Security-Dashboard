import { useState } from 'react'
import { Bell, CheckCircle2, ChevronRight, Inbox } from 'lucide-react'
import { Badge, EmptyState, SectionHeading } from '../../components/ui.js'
import { useHrms } from '../../state/useHrms.js'
import { formatDateTime, recencyGroup } from '../../utils/format.js'
import type { NotificationSummary } from '../../types/hrms.js'
import type { NavigateProps } from './shared.js'

const groupOrder = ['Today', 'Yesterday', 'This week', 'Earlier'] as const

export function ActionInbox({ onNavigate, pageIds }: NavigateProps & { pageIds: readonly string[] }) {
  const { data, user, markNotificationRead, markAllNotificationsRead } = useHrms()
  const [filter, setFilter] = useState('All')
  if (!data || !user) return null
  const notifications = data.notifications.filter((item) => item.employeeId === user.id).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const unread = notifications.filter((item) => !item.readAt)
  const categories = [...new Set(notifications.map((item) => item.category))].sort()
  const visible = notifications.filter((item) => filter === 'All' ? true : filter === 'Unread' ? !item.readAt : item.category === filter)
  const groups = groupOrder.map((name) => ({ name, items: visible.filter((item) => recencyGroup(item.createdAt) === name) })).filter((group) => group.items.length)
  const open = async (item: NotificationSummary) => {
    if (!item.readAt) {
      try { await markNotificationRead(item.id) } catch { return }
    }
    if (item.destination && pageIds.includes(item.destination)) onNavigate(item.destination)
  }

  return <div className="page-stack">
    <SectionHeading
      title="Inbox"
      description="Decisions, replies, documents, and security notices sent to you."
      actions={unread.length > 0 && <button className="button button-secondary" onClick={() => void markAllNotificationsRead()}><CheckCircle2 aria-hidden="true" />Mark all as read</button>}
    />
    <section className="panel">
      {notifications.length > 0 && <div className="filter-chips" role="group" aria-label="Filter notifications">
        {['All', 'Unread', ...categories].map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>
          {option}{option === 'Unread' && unread.length > 0 && <em>{unread.length}</em>}
        </button>)}
      </div>}
      {groups.map((group) => <div className="notification-group" key={group.name}>
        <h2>{group.name}</h2>
        <div className="notification-feed">
          {group.items.map((item) => <button key={item.id} type="button" className={!item.readAt ? 'unread' : ''} onClick={() => void open(item)}>
            <span className="notification-icon" aria-hidden="true"><Bell /></span>
            <span className="notification-body">
              <span className="notification-meta"><Badge tone={!item.readAt ? 'info' : 'neutral'}>{item.category}</Badge><time>{formatDateTime(item.createdAt)}</time>{!item.readAt && <span className="sr-only">Unread</span>}</span>
              <strong>{item.title}</strong>
              <span className="notification-message">{item.message}</span>
            </span>
            {item.actionLabel ? <span className="notification-action">{item.actionLabel}<ChevronRight aria-hidden="true" /></span> : <ChevronRight className="notification-chevron" aria-hidden="true" />}
          </button>)}
        </div>
      </div>)}
      {notifications.length === 0 && <EmptyState icon={Inbox} title="Your inbox is empty" text="Replies, decisions, and documents from HR will appear here." />}
      {notifications.length > 0 && visible.length === 0 && <EmptyState compact icon={CheckCircle2} title={filter === 'Unread' ? 'No unread notifications' : 'Nothing in this category'} text="Choose All to see every notification." />}
    </section>
  </div>
}
