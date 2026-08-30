import { X } from 'lucide-react'

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'blue' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon"><Icon size={22} aria-hidden="true" /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  )
}

export function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      <Icon size={28} aria-hidden="true" />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

export function Modal({ title, children, onClose, size = 'normal', dismissible = true }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={dismissible ? onClose : undefined}>
      <section
        className={`modal modal-${size}${dismissible ? '' : ' modal-required'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          {dismissible && <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>}
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  )
}

export function ProgressBar({ value, label }) {
  return (
    <div className="progress-block">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <div className="progress-track"><progress value={value} max="100">{value}%</progress></div>
    </div>
  )
}

export function SectionHeading({ eyebrow, title, description, actions }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
  )
}

export function TableShell({ children }) {
  return <div className="table-shell"><table>{children}</table></div>
}
