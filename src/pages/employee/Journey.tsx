import { CheckCircle2, Circle, ListChecks } from 'lucide-react'
import { Badge, EmptyState, ProgressBar, SectionHeading } from '../../components/ui.js'
import { useHrms } from '../../state/useHrms.js'
import { formatDate, statusTone } from '../../utils/format.js'

export function EmployeeJourney() {
  const { data, user } = useHrms()
  if (!data || !user) return null
  const cases = data.lifecycleCases.filter((item) => item.employeeId === user.id)
  return <div className="page-stack">
    <SectionHeading title="My Journey" description="Your onboarding or offboarding checklist and what is left to do." />
    {cases.map((item) => {
      const tasks = data.lifecycleTasks.filter((task) => task.caseId === item.id && task.employeeVisible)
      const complete = tasks.filter((task) => task.status !== 'Pending').length
      const progress = tasks.length ? Math.round((complete / tasks.length) * 100) : 0
      return <section className="panel journey-card" key={item.id} aria-labelledby={`journey-${item.id}`}>
        <div className="panel-header">
          <div><h2 id={`journey-${item.id}`}>{item.type} checklist</h2><p>Target date: {formatDate(item.targetDate)}</p></div>
          <Badge tone={statusTone(item.status)}>{item.status}</Badge>
        </div>
        <div className="journey-body">
          <ProgressBar value={progress} label={`${complete} of ${tasks.length} steps complete`} />
          <ol className="checklist">{tasks.map((task) => <li key={task.id} className={task.status !== 'Pending' ? 'complete' : ''}>
            {task.status !== 'Pending' ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
            <div><strong>{task.title}</strong><p>{task.category}</p></div>
            <Badge tone={statusTone(task.status)}>{task.status === 'Pending' ? 'To do' : task.status}</Badge>
          </li>)}</ol>
          {!tasks.length && <p className="form-note">HR is preparing your checklist.</p>}
        </div>
      </section>
    })}
    {!cases.length && <section className="panel"><EmptyState icon={ListChecks} title="No checklist right now" text="When HR starts your onboarding or offboarding, the steps for you appear here." /></section>}
  </div>
}
