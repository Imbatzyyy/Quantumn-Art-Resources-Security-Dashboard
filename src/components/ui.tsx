import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'

interface BadgeProps {
  children: ReactNode
  tone?: string
}

interface StatCardProps {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon: LucideIcon
  tone?: string
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  text: string
}

interface ModalProps {
  title: string
  children: ReactNode
  onClose?: () => void
  size?: 'normal' | 'large' | 'wide'
  dismissible?: boolean
}

interface ProgressBarProps {
  value: number
  label: string
}

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'blue' }: StatCardProps) {
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

export function EmptyState({ icon: Icon, title, text }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon size={28} aria-hidden="true" />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

export function Modal({ title, children, onClose, size = 'normal', dismissible = true }: ModalProps) {
  const panel = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const element = panel.current
    if (!element) return
    if (!element.contains(document.activeElement)) element.focus()
    const handleKey = (event: globalThis.KeyboardEvent) => {
      const dialogs = document.querySelectorAll('.modal[role="dialog"]')
      if (dialogs[dialogs.length - 1] !== element) return
      if (event.key === 'Escape' && dismissible) { event.preventDefault(); close.current?.() }
      if (event.key !== 'Tab') return
      const focusable = [...element.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter((node) => node.getClientRects().length)
      const first = focusable[0], last = focusable.at(-1)
      if (!first) { event.preventDefault(); element.focus() }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); if (previous?.isConnected) previous.focus() }
  }, [dismissible])
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={dismissible ? onClose : undefined}>
      <section
        ref={panel}
        tabIndex={-1}
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

export function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div className="progress-block">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <div className="progress-track"><progress value={value} max="100">{value}%</progress></div>
    </div>
  )
}

export function SectionHeading({ eyebrow, title, description, actions }: SectionHeadingProps) {
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

export function TableShell({ children }: { children: ReactNode }) {
  const [page, setPage] = useState(0)
  const sections = Children.toArray(children)
  const body = sections.find(child => isValidElement<{ children: ReactNode }>(child) && child.type === 'tbody')
  const rows = isValidElement<{ children: ReactNode }>(body) ? Children.toArray(body.props.children) : []
  const pages = Math.max(1, Math.ceil(rows.length / 25))
  const current = Math.min(page, pages - 1)
  const visible = rows.length > 25 && isValidElement<{ children: ReactNode }>(body)
    ? sections.map(child => child === body ? cloneElement(body, {}, rows.slice(current * 25, (current + 1) * 25)) : child)
    : children
  return <><div className="table-shell"><table>{visible}</table></div>{pages > 1 && <nav className="table-pagination" aria-label="Table pagination"><span aria-live="polite">{current * 25 + 1}–{Math.min((current + 1) * 25, rows.length)} of {rows.length}</span><div className="table-actions"><button className="button button-secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><button className="button button-secondary" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next</button></div></nav>}</>
}
