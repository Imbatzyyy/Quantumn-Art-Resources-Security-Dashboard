import { useId, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Info } from 'lucide-react'

/*
 * Small building blocks for the light, readable form and banner design
 * (styles in styles.css, "Readable forms" section). Labels are real <label> elements, so a
 * control's accessible name is exactly its visible label; help text is
 * linked with aria-describedby instead of being folded into the name.
 */

interface ControlProps { id: string; 'aria-describedby'?: string }

interface FieldProps {
  label: ReactNode
  optional?: boolean
  count?: ReactNode
  help?: ReactNode
  status?: ReactNode
  className?: string
  children: (control: ControlProps) => ReactNode
}

export function Field({ label, optional, count, help, status, className, children }: FieldProps) {
  const id = useId()
  const helpId = help ? `${id}-help` : undefined
  return <div className={`rf-field${className ? ` ${className}` : ''}`}>
    <div className="rf-label-row">
      <label className="rf-label" htmlFor={id}>{label}{optional && <span className="rf-optional"> (optional)</span>}</label>
      {status}
      {count !== undefined && <span className="rf-count">{count}</span>}
    </div>
    {children({ id, 'aria-describedby': helpId })}
    {help && <p className="rf-help" id={helpId}>{help}</p>}
  </div>
}

export function FormIntro({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="rf-intro"><p>{children}</p>{aside}</div>
}

export function FormFooter({ note, icon: Icon = Info, children }: { note: ReactNode; icon?: LucideIcon; children: ReactNode }) {
  return <footer className="rf-footer"><p><Icon aria-hidden="true" /><span>{note}</span></p><div className="rf-actions">{children}</div></footer>
}

export function SummaryList({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return <dl>{items.map(([term, value], index) => <div key={index}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
}

export function Note({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <p className="rf-note"><Icon aria-hidden="true" /><span>{children}</span></p>
}

export function PersonCard({ name, meta, badge }: { name: string; meta: ReactNode; badge?: ReactNode }) {
  const initials = name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <div className="rf-person"><span aria-hidden="true">{initials || '—'}</span><div><strong>{name}</strong><p>{meta}</p></div>{badge}</div>
}

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

export function Banner({ icon: Icon, label, title, children, badge, tone = 'info', className }: { icon: LucideIcon; label?: ReactNode; title: ReactNode; children?: ReactNode; badge?: ReactNode; tone?: Tone; className?: string }) {
  return <section className={`rf-banner rf-banner--${tone}${className ? ` ${className}` : ''}`}>
    <span className={`rf-icon rf-icon--${tone}`}><Icon aria-hidden="true" /></span>
    <div>{label && <span className="rf-banner-label">{label}</span>}<h2>{title}</h2>{children && <p>{children}</p>}</div>
    {badge}
  </section>
}

export function SectionTitle({ step, children, description }: { step?: number; children: ReactNode; description?: ReactNode }) {
  return <div className="rf-section-title">
    <h3>{step !== undefined && <span className="rf-step" aria-hidden="true">{step}</span>}{children}</h3>
    {description && <p>{description}</p>}
  </div>
}
