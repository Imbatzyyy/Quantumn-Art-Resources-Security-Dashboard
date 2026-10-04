import { useState } from 'react'
import { Star, Target, UserRound } from 'lucide-react'
import { Badge, EmptyState, ProgressBar, SectionHeading } from '../../components/ui.js'
import { useHrms } from '../../state/useHrms.js'
import { formatDate, statusTone } from '../../utils/format.js'
import { businessDate } from '../../utils/securityMetrics.js'
import type { GoalRecord } from '../../types/hrms.js'

const daysUntil = (date?: string) => date ? Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${businessDate()}T00:00:00Z`).getTime()) / 86_400_000) : null

export function GoalsAndGrowth() {
  const { data, user } = useHrms()
  if (!data || !user) return null
  const reviews = data.performance.filter((item) => item.employeeId === user.id && item.status === 'Published')
  const goals = data.goals.filter((item) => item.employeeId === user.id)
  const latest = reviews[0]

  return <div className="page-stack">
    <SectionHeading title="Goals & Growth" description="Track your goals and read feedback that HR has shared with you." />
    {latest ? <section className="panel performance-summary">
      <div className="performance-summary-score">
        <span>Latest review · {latest.period}</span>
        <strong>{latest.score}<small>/100</small></strong>
        <Badge tone="success">{latest.rating}</Badge>
      </div>
      <div className="performance-summary-detail">
        <div className="performance-metrics">
          {[{ icon: Star, label: 'Quality', value: latest.quality }, { icon: Target, label: 'Productivity', value: latest.productivity }, { icon: UserRound, label: 'Teamwork', value: latest.teamwork }].map(({ icon: Icon, label, value }) => <div key={label}><Icon aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <ProgressBar value={latest.goalProgress} label="Goal completion" />
        {latest.comments && <blockquote>{latest.comments}</blockquote>}
      </div>
    </section> : <section className="panel"><EmptyState compact icon={Star} title="No review shared yet" text="Your review appears here after HR publishes it." /></section>}
    <section className="panel">
      <div className="panel-header"><div><h2>My goals</h2><p>Update your progress. HR sees the same saved value.</p></div><Badge tone="neutral">{goals.filter((goal) => goal.status === 'Active').length} active</Badge></div>
      <div className="goal-list">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}{!goals.length && <EmptyState compact icon={Target} title="No goals yet" text="Goals agreed with your manager or HR will appear here." />}</div>
    </section>
  </div>
}

function GoalCard({ goal }: { goal: GoalRecord }) {
  const { updateGoalProgress } = useHrms()
  const [progress, setProgress] = useState(goal.progress)
  const [saving, setSaving] = useState(false)
  const remaining = daysUntil(goal.dueDate)
  const due = goal.status !== 'Active' || remaining === null ? null
    : remaining < 0 ? { tone: 'danger', label: `Overdue by ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? '' : 's'}` }
      : remaining <= 14 ? { tone: 'warning', label: remaining === 0 ? 'Due today' : `Due in ${remaining} day${remaining === 1 ? '' : 's'}` }
        : null
  const save = async () => {
    setSaving(true)
    try { await updateGoalProgress(goal.id, progress) } catch { setProgress(goal.progress) } finally { setSaving(false) }
  }
  return <article>
    <div className="goal-head">
      <div><div className="inline-badges"><Badge tone={statusTone(goal.status)}>{goal.status}</Badge>{due && <Badge tone={due.tone}>{due.label}</Badge>}</div><h3>{goal.title}</h3>{goal.description && <p>{goal.description}</p>}</div>
      <strong>{progress}%</strong>
    </div>
    <input className="goal-slider" aria-label={`${goal.title} progress`} type="range" min={0} max={100} step={5} value={progress} onChange={(event) => setProgress(Number(event.target.value))} disabled={goal.status !== 'Active'} />
    <div className="goal-foot"><span>{goal.category} · Due {formatDate(goal.dueDate)}</span><button className="button button-secondary button-small" disabled={progress === goal.progress || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save progress'}</button></div>
  </article>
}
