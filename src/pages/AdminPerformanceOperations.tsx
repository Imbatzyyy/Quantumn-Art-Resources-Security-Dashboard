import { useState, type FormEvent } from 'react'
import { Award, BookOpenCheck, BriefcaseBusiness, CalendarCheck, CalendarClock, CalendarDays, Check, CheckCircle2, Compass, FileText, Flag, GraduationCap, Layers3, Plus, Rocket, Send, ShieldCheck, Sparkles, Star, Target, TrendingUp, UserRound } from 'lucide-react'
import { Badge, EmptyState, Modal, ProgressBar, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { GoalInput, HrmsSnapshot, PerformanceCycleInput, PerformanceRecord, PerformanceReviewInput } from '../types/hrms.js'

const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}
const reviewMetrics: Array<[keyof Pick<PerformanceReviewInput, 'score' | 'goalProgress' | 'quality' | 'productivity' | 'teamwork'>, string]> = [
  ['score', 'Overall score'], ['goalProgress', 'Goal progress'], ['quality', 'Quality'], ['productivity', 'Productivity'], ['teamwork', 'Teamwork'],
]

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
    { value: 'Draft', description: 'Private planning', icon: FileText },
    { value: 'Active', description: 'Reviews in progress', icon: Rocket },
    { value: 'Review', description: 'Calibration stage', icon: Star },
    { value: 'Closed', description: 'Cycle completed', icon: CheckCircle2 },
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

  const openReview = (review?: PerformanceRecord) => setReviewForm(review ? { ...review, comments: review.comments ?? '', cycleId: review.cycleId ?? '' } : { employeeId: defaultEmployee, cycleId: defaultCycle?.id ?? '', period: defaultCycle?.period ?? `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`, score: 80, goalProgress: 80, quality: 80, productivity: 80, teamwork: 80, comments: '' })
  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reviewForm) return
    const score = Number(reviewForm.score)
    const rating = score >= 90 ? 'Outstanding' : score >= 80 ? 'Exceeds expectations' : score >= 70 ? 'Meets expectations' : 'Needs improvement'
    try { await savePerformance({ ...reviewForm, rating }); setReviewForm(null) } catch { /* Keep private draft open. */ }
  }
  const submitCycle = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await createPerformanceCycle(cycleForm); setShowCycle(false) } catch { /* Keep form open. */ } }
  const submitGoal = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await saveGoal(goalForm); setShowGoal(false); setGoalForm({ ...goalForm, title: '', description: '', progress: 0, dueDate: '' }) } catch { /* Keep form open. */ } }

  return <div className="page-stack">
    <SectionHeading eyebrow="Draft before disclosure" title="Performance & Growth" description="Run review cycles, save private drafts, publish intentionally, and maintain employee goals." actions={<><button className="button button-secondary" onClick={() => setShowCycle(true)}><CalendarDays />New cycle</button><button className="button button-secondary" onClick={() => setShowGoal(true)}><Target />Add goal</button><button className="button button-primary" onClick={() => openReview()}><Plus />New review</button></>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={CalendarCheck} label="Active cycles" value={data.performanceCycles.filter((item) => item.status === 'Active').length} tone="blue" /><StatCard icon={FileText} label="Draft reviews" value={data.performance.filter((item) => item.status === 'Draft').length} tone="amber" /><StatCard icon={TrendingUp} label="Active goals" value={data.goals.filter((item) => item.status === 'Active').length} tone="green" /></div>
    <section className="panel"><div className="panel-header"><div><h2>Review records</h2><p>Employees retrieve only Published records through RLS.</p></div></div>{data.performance.length ? <TableShell><thead><tr><th>Employee</th><th>Period</th><th>Score</th><th>Goal progress</th><th>Rating</th><th>Status / Action</th></tr></thead><tbody>{data.performance.map((review) => <tr key={review.id}><td><strong>{personName(data, review.employeeId)}</strong><small className="table-subtitle">{review.employeeId}</small></td><td>{review.period}</td><td><strong>{review.score}/100</strong></td><td>{review.goalProgress}%</td><td>{review.rating}</td><td><div className="table-actions"><Badge tone={statusTone(review.status)}>{review.status}</Badge><button className="mini-button" onClick={() => openReview(review)}>Edit</button>{review.status === 'Draft' && <button className="mini-button approve" onClick={() => void publishPerformance(review.id)}><Check />Publish</button>}</div></td></tr>)}</tbody></TableShell> : <EmptyState icon={Star} title="No performance reviews" text="Create a draft, review it, then publish it to the employee." />}</section>
    <section className="panel"><div className="panel-header"><div><h2>Employee goals</h2><p>Shared progress values for coaching conversations</p></div></div><div className="goal-admin-grid">{data.goals.map((goal) => <article key={goal.id}><div><Badge tone={statusTone(goal.status)}>{goal.status}</Badge><h3>{goal.title}</h3><p>{personName(data, goal.employeeId)} · {goal.category} · Due {formatDate(goal.dueDate)}</p></div><strong>{goal.progress}%</strong><ProgressBar value={goal.progress} label="Progress" /></article>)}</div></section>
    {reviewForm && <Modal title="Save performance review draft" onClose={() => setReviewForm(null)} size="large"><form className="form-grid" onSubmit={submitReview}><label>Employee<select value={reviewForm.employeeId} onChange={(event) => setReviewForm({ ...reviewForm, employeeId: event.target.value })}>{data.employees.filter((item) => item.role === 'employee').map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><label>Cycle<select value={reviewForm.cycleId} onChange={(event) => { const cycle = data.performanceCycles.find((item) => item.id === Number(event.target.value)); setReviewForm({ ...reviewForm, cycleId: event.target.value, period: cycle?.period ?? reviewForm.period }) }}><option value="">No cycle</option>{data.performanceCycles.map((item) => <option value={item.id} key={item.id}>{item.period} · {item.status}</option>)}</select></label><label className="span-2">Review period<input value={reviewForm.period} onChange={(event) => setReviewForm({ ...reviewForm, period: event.target.value })} required /></label>{reviewMetrics.map(([key, label]) => <label key={key}>{label}<input type="number" min={0} max={100} value={reviewForm[key]} onChange={(event) => setReviewForm({ ...reviewForm, [key]: Number(event.target.value) })} required /></label>)}<label className="span-2">Comments<textarea rows={4} maxLength={1000} value={reviewForm.comments} onChange={(event) => setReviewForm({ ...reviewForm, comments: event.target.value })} /></label><p className="form-note span-2">Saving creates a private draft. Use Publish only after the review is complete and approved for employee disclosure.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setReviewForm(null)}>Cancel</button><button className="button button-primary">Save private draft</button></div></form></Modal>}
    {showCycle && <Modal title="Create performance cycle" onClose={() => setShowCycle(false)} size="large">
      <form className="performance-cycle-shell" onSubmit={submitCycle}>
        <section className="performance-cycle-intro">
          <span className="performance-cycle-intro-icon"><CalendarCheck aria-hidden="true" /></span>
          <div><small>Performance program design</small><h3>Build a focused review cycle with a clear cadence</h3><p>Define the cycle identity, select its operating stage, and establish a review window before employees and managers participate.</p></div>
          <span className="performance-cycle-state"><Sparkles aria-hidden="true" />Live blueprint</span>
        </section>

        <div className="performance-cycle-content">
          <section className="performance-cycle-fields" aria-labelledby="performance-cycle-fields-title">
            <header className="performance-cycle-heading"><span><Layers3 aria-hidden="true" /></span><div><h4 id="performance-cycle-fields-title">Cycle foundations</h4><p>Create a recognizable review program with an unambiguous reporting period.</p></div></header>

            <label className="performance-cycle-field">Cycle title
              <span className="performance-cycle-input"><Flag aria-hidden="true" /><input aria-label="Cycle title" value={cycleForm.title} onChange={(event) => setCycleForm({ ...cycleForm, title: event.target.value })} placeholder="e.g. Quarterly Performance Cycle" required /></span>
              <small>Use a name managers and employees will immediately recognize.</small>
            </label>

            <label className="performance-cycle-field">Period label
              <span className="performance-cycle-input"><CalendarDays aria-hidden="true" /><input aria-label="Period label" value={cycleForm.period} onChange={(event) => setCycleForm({ ...cycleForm, period: event.target.value })} placeholder="e.g. Q3 2026" required /></span>
              <small>This reporting label must be unique in the performance register.</small>
            </label>

            <fieldset className="performance-status-picker">
              <legend>Starting status</legend>
              <div>{cycleStatuses.map(({ value, description, icon: Icon }) => <label className={cycleForm.status === value ? `active status-${value.toLowerCase()}` : ''} key={value}><input aria-label={value} type="radio" name="performance-cycle-status" value={value} checked={cycleForm.status === value} onChange={(event) => setCycleForm({ ...cycleForm, status: event.target.value })} /><span><Icon aria-hidden="true" /></span><div><strong>{value}</strong><small>{description}</small></div></label>)}</div>
            </fieldset>

            <div className="performance-cycle-date-grid">
              <label className="performance-cycle-field">Start date <em>Optional</em>
                <span className="performance-cycle-input"><CalendarClock aria-hidden="true" /><input aria-label="Start date" type="date" value={cycleForm.startDate} onChange={(event) => setCycleForm({ ...cycleForm, startDate: event.target.value })} /></span>
              </label>
              <label className="performance-cycle-field">End date <em>Optional</em>
                <span className="performance-cycle-input"><CalendarCheck aria-hidden="true" /><input aria-label="End date" type="date" min={cycleForm.startDate || undefined} value={cycleForm.endDate} onChange={(event) => setCycleForm({ ...cycleForm, endDate: event.target.value })} /></span>
              </label>
            </div>
          </section>

          <aside className="performance-cycle-preview" aria-labelledby="performance-cycle-preview-title">
            <header><div><small>Cycle blueprint</small><h4 id="performance-cycle-preview-title">Program readiness</h4></div><span><TrendingUp aria-hidden="true" /></span></header>
            <section className="performance-cycle-identity">
              <span><CalendarCheck aria-hidden="true" /></span>
              <div><small>{cycleForm.period.trim() || 'Reporting period'}</small><h5>{cycleForm.title.trim() || 'Untitled performance cycle'}</h5><p>Starts in <strong>{cycleForm.status}</strong></p></div>
            </section>

            <div className="performance-cycle-timeline" aria-label="Performance cycle stages">
              {cycleStatuses.map(({ value, description, icon: Icon }, index) => <article className={index < selectedStatusIndex ? 'complete' : index === selectedStatusIndex ? 'current' : ''} key={value}><span><Icon aria-hidden="true" /></span><div><strong>{value}</strong><small>{description}</small></div>{index < cycleStatuses.length - 1 && <i aria-hidden="true" />}</article>)}
            </div>

            <dl className="performance-cycle-window"><div><dt>Start</dt><dd>{cycleForm.startDate ? formatDate(cycleForm.startDate) : 'Open date'}</dd></div><div><dt>End</dt><dd>{cycleForm.endDate ? formatDate(cycleForm.endDate) : 'Open date'}</dd></div><div><dt>Window</dt><dd>{cycleWindowDays ? `${cycleWindowDays} days` : 'Flexible'}</dd></div></dl>

            <div className="performance-cycle-assurance"><ShieldCheck aria-hidden="true" /><div><strong>Governed performance workflow</strong><p>Only authorized HR administrators can create cycles. Draft cycles remain private; non-draft cycles become visible to active HRMS users through Supabase RLS.</p></div></div>
          </aside>
        </div>

        <footer className="performance-cycle-footer">
          <div><CalendarCheck aria-hidden="true" /><p><strong>Ready to establish the cycle.</strong> Confirm the unique period, starting stage, and optional review dates before creation.</p></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowCycle(false)}>Cancel</button><button className="button button-primary"><Plus aria-hidden="true" />Create cycle</button></div>
        </footer>
      </form>
    </Modal>}
    {showGoal && <Modal title="Assign employee goal" onClose={() => setShowGoal(false)} size="large">
      <form className="goal-assign-shell" onSubmit={submitGoal}>
        <section className="goal-assign-intro">
          <span className="goal-assign-intro-icon"><Target aria-hidden="true" /></span>
          <div><small>Growth plan creation</small><h3>Turn expectations into a focused development goal</h3><p>Choose the employee, define a meaningful outcome, and set a clear coaching horizon before the goal enters their workspace.</p></div>
          <span className="goal-assign-state"><Sparkles aria-hidden="true" />Live goal card</span>
        </section>

        <div className="goal-assign-content">
          <section className="goal-assign-fields" aria-labelledby="goal-assign-fields-title">
            <header className="goal-assign-heading"><span><Compass aria-hidden="true" /></span><div><h4 id="goal-assign-fields-title">Goal foundations</h4><p>Connect a specific employee with an outcome that is clear and coachable.</p></div></header>

            <label className="goal-premium-field">Employee
              <span className="goal-select-shell"><UserRound aria-hidden="true" /><select aria-label="Employee" value={goalForm.employeeId} onChange={(event) => setGoalForm({ ...goalForm, employeeId: event.target.value })}>{goalEmployees.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></span>
            </label>

            {selectedGoalEmployee && <div className="goal-employee-card"><span>{selectedGoalEmployee.firstName[0]}{selectedGoalEmployee.lastName[0]}</span><div><strong>{selectedGoalEmployee.firstName} {selectedGoalEmployee.lastName}</strong><p>{selectedGoalEmployee.position || 'Employee'} · {selectedGoalEmployee.department || 'Organization'}</p></div><Badge tone="success">{selectedGoalEmployee.status}</Badge></div>}

            <label className="goal-premium-field">Goal title
              <span className="goal-input-shell"><Target aria-hidden="true" /><input aria-label="Goal title" value={goalForm.title} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} placeholder="e.g. Lead the quarterly operations review" minLength={3} maxLength={160} required /></span>
              <small><span>Phrase the goal as a specific outcome.</span><strong>{goalForm.title.length}/160</strong></small>
            </label>

            <div className="goal-field-grid">
              <label className="goal-premium-field">Category
                <span className="goal-input-shell"><BookOpenCheck aria-hidden="true" /><input aria-label="Category" value={goalForm.category} onChange={(event) => setGoalForm({ ...goalForm, category: event.target.value })} required /></span>
              </label>
              <label className="goal-premium-field">Due date
                <span className="goal-input-shell"><CalendarClock aria-hidden="true" /><input aria-label="Due date" type="date" value={goalForm.dueDate} onChange={(event) => setGoalForm({ ...goalForm, dueDate: event.target.value })} required /></span>
              </label>
            </div>

            <div className="goal-category-suggestions" aria-label="Suggested goal categories">{goalCategories.map(({ value, icon: Icon }) => <button type="button" className={goalForm.category === value ? 'active' : ''} onClick={() => setGoalForm({ ...goalForm, category: value })} key={value}><Icon aria-hidden="true" />{value}</button>)}</div>

            <label className="goal-premium-field">Description <em>Recommended</em>
              <textarea aria-label="Description" rows={6} value={goalForm.description} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} placeholder="Describe the expected outcome, success measures, and the support available…" />
              <small><span>Include a measurable result and the employee’s next action.</span><strong>{goalForm.description.length} characters</strong></small>
            </label>
          </section>

          <aside className="goal-assign-preview" aria-labelledby="goal-assign-preview-title">
            <header><div><small>Employee view</small><h4 id="goal-assign-preview-title">Goal preview</h4></div><span><TrendingUp aria-hidden="true" /></span></header>

            <article className="goal-preview-card">
              <div className="goal-preview-owner"><span>{selectedGoalEmployee ? `${selectedGoalEmployee.firstName[0]}${selectedGoalEmployee.lastName[0]}` : '—'}</span><div><small>Assigned to</small><strong>{selectedGoalEmployee ? `${selectedGoalEmployee.firstName} ${selectedGoalEmployee.lastName}` : 'Select an employee'}</strong></div><Badge tone="success">Active</Badge></div>
              <span className="goal-preview-icon"><Target aria-hidden="true" /></span>
              <small className="goal-preview-category">{goalForm.category || 'Goal category'}</small>
              <h5>{goalForm.title.trim() || 'Your goal title will appear here'}</h5>
              <p>{goalForm.description.trim() || 'Add a concise description so the employee understands the outcome and the next step.'}</p>
              <div className="goal-preview-progress"><div><span>Starting progress</span><strong>0%</strong></div><i><span /></i></div>
              <dl><div><dt>Due date</dt><dd>{goalForm.dueDate ? formatDate(goalForm.dueDate) : 'Set a target date'}</dd></div><div><dt>Status</dt><dd>Active</dd></div></dl>
            </article>

            <div className="goal-coaching-note"><ShieldCheck aria-hidden="true" /><div><strong>Private, accountable coaching</strong><p>The assigned employee can read this goal through Supabase RLS. Only authorized HR administrators can create or update it.</p></div></div>
          </aside>
        </div>

        <footer className="goal-assign-footer">
          <div><Send aria-hidden="true" /><p><strong>Ready to create the growth plan.</strong> Confirm the employee, success outcome, and due date before assignment.</p></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowGoal(false)}>Cancel</button><button className="button button-primary"><Target aria-hidden="true" />Assign goal</button></div>
        </footer>
      </form>
    </Modal>}
  </div>
}
