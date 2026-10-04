import { useState, type FormEvent } from 'react'
import { Award, BriefcaseBusiness, CalendarCheck, CalendarDays, Check, FileText, GraduationCap, LockKeyhole, Plus, Save, Send, ShieldCheck, Star, Target, TrendingUp } from 'lucide-react'
import { Badge, EmptyState, Modal, ProgressBar, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { Field, FormFooter, FormIntro, Note, PersonCard, SummaryList } from '../components/readable.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { GoalInput, HrmsSnapshot, PerformanceCycleInput, PerformanceRecord, PerformanceReviewInput } from '../types/hrms.js'

const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}
const reviewMetrics = [
  { key: 'score' as const, label: 'Overall score' },
  { key: 'goalProgress' as const, label: 'Goal progress' },
  { key: 'quality' as const, label: 'Quality' },
  { key: 'productivity' as const, label: 'Productivity' },
  { key: 'teamwork' as const, label: 'Teamwork' },
]
const ratingForScore = (score: number) => score >= 90 ? 'Outstanding' : score >= 80 ? 'Exceeds expectations' : score >= 70 ? 'Meets expectations' : 'Needs improvement'

export default function AdminPerformanceOperations() {
  const { data, savePerformance, publishPerformance, createPerformanceCycle, saveGoal } = useHrms()
  const [reviewForm, setReviewForm] = useState<PerformanceReviewInput | null>(null)
  const [showCycle, setShowCycle] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const defaultEmployee = data?.employees.find((item) => item.role === 'employee' && item.status === 'Active')?.id ?? ''
  const defaultCycle = data?.performanceCycles.find((item) => item.status === 'Active')
  const [cycleForm, setCycleForm] = useState<PerformanceCycleInput>({ title: 'Quarterly Performance Cycle', period: `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`, status: 'Active', startDate: '', endDate: '' })
  const [goalForm, setGoalForm] = useState<GoalInput>({ employeeId: defaultEmployee, title: '', description: '', category: 'Growth', progress: 0, status: 'Active', dueDate: '' })
  if (!data) return null
  const cycleStatuses = [
    { value: 'Draft', description: 'Private, still being planned' },
    { value: 'Active', description: 'Reviews in progress' },
    { value: 'Review', description: 'Scores being calibrated' },
    { value: 'Closed', description: 'Cycle finished' },
  ]
  const selectedStatusIndex = cycleStatuses.findIndex((item) => item.value === cycleForm.status)
  const cycleWindowDays = cycleForm.startDate && cycleForm.endDate
    ? Math.max(0, Math.round((new Date(`${cycleForm.endDate}T00:00:00`).getTime() - new Date(`${cycleForm.startDate}T00:00:00`).getTime()) / 86400000) + 1)
    : null
  const goalEmployees = data.employees.filter((item) => item.role === 'employee')
  const selectedGoalEmployee = goalEmployees.find((item) => item.id === goalForm.employeeId)
  const goalCategories = [
    { value: 'Growth', icon: GraduationCap },
    { value: 'Role', icon: BriefcaseBusiness },
    { value: 'Leadership', icon: Award },
    { value: 'Delivery', icon: Target },
  ]
  const selectedReviewEmployee = reviewForm ? data.employees.find((item) => item.id === reviewForm.employeeId) : undefined
  const selectedReviewCycle = reviewForm ? data.performanceCycles.find((item) => item.id === Number(reviewForm.cycleId)) : undefined
  const calculatedReviewRating = reviewForm ? ratingForScore(Number(reviewForm.score)) : ''

  const openReview = (review?: PerformanceRecord) => setReviewForm(review ? { ...review, comments: review.comments ?? '', cycleId: review.cycleId ?? '' } : { employeeId: defaultEmployee, cycleId: defaultCycle?.id ?? '', period: defaultCycle?.period ?? `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`, score: 80, goalProgress: 80, quality: 80, productivity: 80, teamwork: 80, comments: '' })
  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reviewForm) return
    const score = Number(reviewForm.score)
    const rating = ratingForScore(score)
    try { await savePerformance({ ...reviewForm, rating }); setReviewForm(null) } catch { /* Keep private draft open. */ }
  }
  const submitCycle = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await createPerformanceCycle(cycleForm); setShowCycle(false) } catch { /* Keep form open. */ } }
  const submitGoal = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await saveGoal(goalForm); setShowGoal(false); setGoalForm({ ...goalForm, title: '', description: '', progress: 0, dueDate: '' }) } catch { /* Keep form open. */ } }

  return <div className="page-stack">
    <SectionHeading eyebrow="Draft before disclosure" title="Performance & Growth" description="Run review cycles, save private drafts, publish intentionally, and maintain employee goals." actions={<><button className="button button-secondary" onClick={() => setShowCycle(true)}><CalendarDays />New cycle</button><button className="button button-secondary" onClick={() => setShowGoal(true)}><Target />Add goal</button><button className="button button-primary" onClick={() => openReview()}><Plus />New review</button></>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={CalendarCheck} label="Active cycles" value={data.performanceCycles.filter((item) => item.status === 'Active').length} tone="blue" /><StatCard icon={FileText} label="Draft reviews" value={data.performance.filter((item) => item.status === 'Draft').length} tone="amber" /><StatCard icon={TrendingUp} label="Active goals" value={data.goals.filter((item) => item.status === 'Active').length} tone="green" /></div>
    <section className="panel"><div className="panel-header"><div><h2>Review records</h2><p>Employees retrieve only Published records through RLS.</p></div></div>{data.performance.length ? <TableShell><thead><tr><th>Employee</th><th>Period</th><th>Score</th><th>Goal progress</th><th>Rating</th><th>Status / Action</th></tr></thead><tbody>{data.performance.map((review) => <tr key={review.id}><td><strong>{personName(data, review.employeeId)}</strong><small className="table-subtitle">{review.employeeId}</small></td><td>{review.period}</td><td><strong>{review.score}/100</strong></td><td>{review.goalProgress}%</td><td>{review.rating}</td><td><div className="table-actions"><Badge tone={statusTone(review.status)}>{review.status}</Badge><button className="mini-button" onClick={() => openReview(review)}>Edit</button>{review.status === 'Draft' && <button className="mini-button approve" onClick={() => void publishPerformance(review.id)}><Check />Publish</button>}</div></td></tr>)}</tbody></TableShell> : <EmptyState icon={Star} title="No performance reviews" text="Create a draft, review it, then publish it to the employee." />}</section>
    <section className="panel"><div className="panel-header"><div><h2>Employee goals</h2><p>Shared progress values for coaching conversations</p></div></div><div className="goal-admin-grid">{data.goals.map((goal) => <article key={goal.id}><div><Badge tone={statusTone(goal.status)}>{goal.status}</Badge><h3>{goal.title}</h3><p>{personName(data, goal.employeeId)} · {goal.category} · Due {formatDate(goal.dueDate)}</p></div><strong>{goal.progress}%</strong><ProgressBar value={goal.progress} label="Progress" /></article>)}</div></section>
    {reviewForm && <Modal title="Save performance review draft" onClose={() => setReviewForm(null)} size="large">
      <form className="rf-form" onSubmit={submitReview}>
        <FormIntro>Score the employee and add your comments. This is saved as a private draft. The employee sees nothing until an authorized administrator publishes the review.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            <div className="rf-grid">
              <Field label="Employee">{(control) => <select {...control} value={reviewForm.employeeId} onChange={(event) => setReviewForm({ ...reviewForm, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select>}</Field>
              <Field label="Cycle">{(control) => <select {...control} value={reviewForm.cycleId} onChange={(event) => { const cycle = data.performanceCycles.find((item) => item.id === Number(event.target.value)); setReviewForm({ ...reviewForm, cycleId: event.target.value, period: cycle?.period ?? reviewForm.period }) }}><option value="">No cycle</option>{data.performanceCycles.map((item) => <option value={item.id} key={item.id}>{item.period} · {item.status}</option>)}</select>}</Field>
            </div>
            {selectedReviewEmployee && <PersonCard name={`${selectedReviewEmployee.firstName} ${selectedReviewEmployee.lastName}`} meta={`${selectedReviewEmployee.position || 'Employee'} · ${selectedReviewEmployee.department || 'Organization'}`} badge={<Badge tone="info">{selectedReviewCycle?.title || 'Independent review'}</Badge>} />}
            <Field label="Review period" help="The employee and period together identify this draft.">{(control) => <input {...control} value={reviewForm.period} onChange={(event) => setReviewForm({ ...reviewForm, period: event.target.value })} required />}</Field>

            <fieldset className="rf-field">
              <legend className="rf-label">Scores from 0 to 100</legend>
              <div className="rf-scores">{reviewMetrics.map(({ key, label }) => <div className={`rf-score${key === 'score' ? ' rf-score--primary' : ''}`} key={key}>
                <label htmlFor={`review-${key}`}>{label}</label>
                <input id={`review-${key}`} type="number" min={0} max={100} value={reviewForm[key]} onChange={(event) => setReviewForm({ ...reviewForm, [key]: Number(event.target.value) })} required />
                <div className="rf-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, Number(reviewForm[key])))}%` }} /></div>
              </div>)}</div>
            </fieldset>

            <Field label="Comments" status={<span className="rf-status rf-status--editing">Private draft</span>} count={`${reviewForm.comments.length}/1000`} help="Keep it factual, specific, and actionable.">{(control) => <textarea {...control} rows={5} maxLength={1000} value={reviewForm.comments} onChange={(event) => setReviewForm({ ...reviewForm, comments: event.target.value })} placeholder="Achievements, evidence, and development priorities for the review conversation" />}</Field>
          </div>

          <aside className="rf-summary" aria-label="Review summary">
            <h3>Review summary</h3>
            <div className="rf-rating"><div><span>Calculated rating</span><h4>{calculatedReviewRating}</h4></div><strong>{reviewForm.score}<small>/100</small></strong></div>
            <div className="rf-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, Number(reviewForm.score)))}%` }} /></div>
            <SummaryList items={[
              ['Employee', selectedReviewEmployee ? `${selectedReviewEmployee.firstName} ${selectedReviewEmployee.lastName}` : 'Not selected'],
              ['Period', reviewForm.period || '—'],
              ...reviewMetrics.slice(1).map(({ key, label }) => [label, `${reviewForm[key]}/100`] as [string, string]),
            ]} />
            <Note icon={LockKeyhole}>Not visible to the employee. Saving creates or replaces a private draft; the employee is notified only after it is published.</Note>
          </aside>
        </div>

        <FormFooter icon={ShieldCheck} note="Check the scores and comments before saving this private draft.">
          <button type="button" className="button button-secondary" onClick={() => setReviewForm(null)}>Cancel</button>
          <button className="button button-primary"><Save aria-hidden="true" />Save private draft</button>
        </FormFooter>
      </form>
    </Modal>}
    {showCycle && <Modal title="Create performance cycle" onClose={() => setShowCycle(false)} size="large">
      <form className="rf-form" onSubmit={submitCycle}>
        <FormIntro>Name the review cycle, choose the stage it starts in, and optionally set the review window.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            <Field label="Cycle title" help="A name managers and employees will recognize.">{(control) => <input {...control} value={cycleForm.title} onChange={(event) => setCycleForm({ ...cycleForm, title: event.target.value })} placeholder="e.g. Quarterly Performance Cycle" required />}</Field>
            <Field label="Period label" help="Must be unique, for example “Q3 2026”.">{(control) => <input {...control} value={cycleForm.period} onChange={(event) => setCycleForm({ ...cycleForm, period: event.target.value })} placeholder="e.g. Q3 2026" required />}</Field>

            <fieldset className="rf-field rf-choices rf-choices--2">
              <legend className="rf-label">Starting status</legend>
              <div>{cycleStatuses.map(({ value, description }) => <label className={`rf-choice${cycleForm.status === value ? ' is-selected' : ''}`} key={value}><input aria-label={value} type="radio" name="performance-cycle-status" value={value} checked={cycleForm.status === value} onChange={(event) => setCycleForm({ ...cycleForm, status: event.target.value })} /><span><strong>{value}</strong><small>{description}</small></span></label>)}</div>
            </fieldset>

            <div className="rf-grid">
              <Field label="Start date" optional>{(control) => <input {...control} type="date" value={cycleForm.startDate} onChange={(event) => setCycleForm({ ...cycleForm, startDate: event.target.value })} />}</Field>
              <Field label="End date" optional>{(control) => <input {...control} type="date" min={cycleForm.startDate || undefined} value={cycleForm.endDate} onChange={(event) => setCycleForm({ ...cycleForm, endDate: event.target.value })} />}</Field>
            </div>
          </div>

          <aside className="rf-summary" aria-label="Cycle summary">
            <h3>Cycle summary</h3>
            <ol className="rf-stages" aria-label="Cycle stages">{cycleStatuses.map(({ value }, index) => <li className={index < selectedStatusIndex ? 'is-done' : index === selectedStatusIndex ? 'is-current' : ''} key={value}>{value}</li>)}</ol>
            <SummaryList items={[
              ['Title', cycleForm.title.trim() || 'Untitled cycle'],
              ['Period', cycleForm.period.trim() || '—'],
              ['Starts in', cycleForm.status],
              ['Start date', cycleForm.startDate ? formatDate(cycleForm.startDate) : 'Not set'],
              ['End date', cycleForm.endDate ? formatDate(cycleForm.endDate) : 'Not set'],
              ['Review window', cycleWindowDays ? `${cycleWindowDays} days` : 'Flexible'],
            ]} />
            <Note icon={ShieldCheck}>Only HR administrators can create cycles. Draft cycles stay private; other stages are visible to active HRMS users.</Note>
          </aside>
        </div>

        <FormFooter note="Check the period, starting stage, and dates before creating the cycle.">
          <button type="button" className="button button-secondary" onClick={() => setShowCycle(false)}>Cancel</button>
          <button className="button button-primary"><Plus aria-hidden="true" />Create cycle</button>
        </FormFooter>
      </form>
    </Modal>}
    {showGoal && <Modal title="Assign employee goal" onClose={() => setShowGoal(false)} size="large">
      <form className="rf-form" onSubmit={submitGoal}>
        <FormIntro>Choose the employee, describe the outcome you expect, and set a due date. The goal appears on the employee’s Goals &amp; Growth page.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            <Field label="Employee">{(control) => <select {...control} value={goalForm.employeeId} onChange={(event) => setGoalForm({ ...goalForm, employeeId: event.target.value })}>{goalEmployees.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select>}</Field>
            {selectedGoalEmployee && <PersonCard name={`${selectedGoalEmployee.firstName} ${selectedGoalEmployee.lastName}`} meta={`${selectedGoalEmployee.position || 'Employee'} · ${selectedGoalEmployee.department || 'Organization'}`} badge={<Badge tone="success">{selectedGoalEmployee.status}</Badge>} />}
            <Field label="Goal title" count={`${goalForm.title.length}/160`} help="Write it as a specific outcome.">{(control) => <input {...control} value={goalForm.title} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} placeholder="e.g. Lead the quarterly operations review" minLength={3} maxLength={160} required />}</Field>
            <div className="rf-grid">
              <Field label="Category">{(control) => <input {...control} value={goalForm.category} onChange={(event) => setGoalForm({ ...goalForm, category: event.target.value })} required />}</Field>
              <Field label="Due date">{(control) => <input {...control} type="date" value={goalForm.dueDate} onChange={(event) => setGoalForm({ ...goalForm, dueDate: event.target.value })} required />}</Field>
            </div>
            <div className="rf-chips" role="group" aria-label="Suggested goal categories">{goalCategories.map(({ value, icon: Icon }) => <button type="button" aria-pressed={goalForm.category === value} onClick={() => setGoalForm({ ...goalForm, category: value })} key={value}><Icon aria-hidden="true" />{value}</button>)}</div>
            <Field label="Description" status={<span className="rf-status rf-status--editing">Recommended</span>} count={`${goalForm.description.length} characters`} help="Include a measurable result and the employee’s next step.">{(control) => <textarea {...control} rows={5} value={goalForm.description} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} placeholder="The expected outcome, how success is measured, and the support available" />}</Field>
          </div>

          <aside className="rf-summary" aria-label="Goal preview">
            <h3>What the employee will see</h3>
            <article className="rf-preview"><span>{goalForm.category || 'Goal category'}</span><h4>{goalForm.title.trim() || 'Your goal title will appear here'}</h4><p>{goalForm.description.trim() || 'Add a short description so the employee understands the outcome and the next step.'}</p></article>
            <SummaryList items={[
              ['Assigned to', selectedGoalEmployee ? `${selectedGoalEmployee.firstName} ${selectedGoalEmployee.lastName}` : 'Not selected'],
              ['Due date', goalForm.dueDate ? formatDate(goalForm.dueDate) : 'Not set'],
              ['Starting progress', '0%'],
              ['Status', 'Active'],
            ]} />
            <Note icon={ShieldCheck}>Only the assigned employee and HR administrators can see this goal.</Note>
          </aside>
        </div>

        <FormFooter icon={Send} note="Check the employee, outcome, and due date before assigning.">
          <button type="button" className="button button-secondary" onClick={() => setShowGoal(false)}>Cancel</button>
          <button className="button button-primary"><Target aria-hidden="true" />Assign goal</button>
        </FormFooter>
      </form>
    </Modal>}
  </div>
}
