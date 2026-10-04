import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
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
  onClick?: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  text: string
  action?: ReactNode
  compact?: boolean
}

interface ModalProps {
  title: string
  children: ReactNode
  onClose?: () => void
  size?: 'small' | 'normal' | 'large' | 'wide'
  dismissible?: boolean
}

interface ProgressBarProps {
  value: number
  label: string
}

interface SectionHeadingProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'blue', onClick }: StatCardProps) {
  const body = <>
    <div className="stat-icon"><Icon size={20} aria-hidden="true" /></div>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  </>
  return onClick
    ? <button type="button" className={`stat-card stat-card-action tone-${tone}`} onClick={onClick}>{body}</button>
    : <article className={`stat-card tone-${tone}`}>{body}</article>
}

export function EmptyState({ icon: Icon, title, text, action, compact }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      <span className="empty-state-icon"><Icon size={22} aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && <div className="empty-state-action">{action}</div>}
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

interface ConfirmDialogProps {
  title: string
  heading: ReactNode
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busyLabel?: string
  tone?: 'primary' | 'danger'
  icon?: LucideIcon
  confirmDisabled?: boolean
  children?: ReactNode
  onConfirm: () => Promise<unknown> | unknown
  onCancel: () => void
}

/** A small, consistent "are you sure?" step for decisions that notify people or change records. */
export function ConfirmDialog({ title, heading, message, confirmLabel, cancelLabel = 'Cancel', busyLabel, tone = 'primary', icon: Icon, confirmDisabled, children, onConfirm, onCancel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
    } catch {
      // The shared toast explains server errors; keep the dialog open for a retry.
    } finally {
      setBusy(false)
    }
  }
  return <Modal title={title} onClose={() => !busy && onCancel()} size="small" dismissible={!busy}>
    <div className={`confirm-dialog confirm-dialog-${tone}`} aria-busy={busy}>
      {Icon && <span className="confirm-dialog-icon"><Icon aria-hidden="true" /></span>}
      <div className="confirm-dialog-copy">
        <h3>{heading}</h3>
        <div className="confirm-dialog-message">{message}</div>
      </div>
      {children}
      <div className="modal-actions">
        <button className="button button-secondary" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button className={`button ${tone === 'danger' ? 'button-danger' : 'button-primary'}`} type="button" onClick={() => void confirm()} disabled={busy || confirmDisabled}>{busy ? busyLabel || 'Saving…' : confirmLabel}</button>
      </div>
    </div>
  </Modal>
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div className="progress-block">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <div className="progress-track"><progress value={value} max="100">{value}%</progress></div>
    </div>
  )
}

/** The compact page header: one title, one short line of context, and page actions. */
export function SectionHeading({ title, description, actions, meta }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <div>
        <h1 tabIndex={-1} data-page-title="">{title}</h1>
        {description && <p>{description}</p>}
        {meta && <div className="section-heading-meta">{meta}</div>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
  )
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="table-shell"><table>{children}</table></div>
}

export interface TabItem<T extends string = string> {
  id: T
  label: string
  icon?: LucideIcon
  count?: number
}

interface TabsProps<T extends string> {
  label: string
  tabs: readonly TabItem<T>[]
  active: T
  onChange: (id: T) => void
  idPrefix: string
}

/** Accessible tabs with arrow-key navigation. Pair with tabPanelProps(). */
export function Tabs<T extends string>({ label, tabs, active, onChange, idPrefix }: TabsProps<T>) {
  const prefix = idPrefix
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? tabs.length - 1
            : null
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next].id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return <div className="tabs" role="tablist" aria-label={label}>
    {tabs.map(({ id, label: tabLabel, icon: Icon, count }, index) => <button
      key={id}
      type="button"
      role="tab"
      id={`${prefix}-tab-${id}`}
      aria-selected={active === id}
      aria-controls={`${prefix}-panel`}
      tabIndex={active === id ? 0 : -1}
      onClick={() => onChange(id)}
      onKeyDown={(event) => move(event, index)}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      <span>{tabLabel}</span>
      {count !== undefined && <em>{count}</em>}
    </button>)}
  </div>
}
