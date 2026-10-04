import { useState, type FormEvent } from 'react'
import { Award, BriefcaseBusiness, CalendarCheck, CalendarDays, FileText, GraduationCap, LockKeyhole, Plus, Save, Send, ShieldCheck, Star, Target, TrendingUp } from 'lucide-react'
import { Badge, ConfirmDialog, Modal, SectionHeading, StatCard, Tabs } from '../components/ui.js'
import { tabPanelProps } from '../components/tabPanel.js'
import { DataTable, type DataColumn } from '../components/DataTable.js'
import { Field, FormFooter, FormIntro, Note, PersonCard, SummaryList } from '../components/readable.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, statusTone } from '../utils/format.js'
import type { GoalInput, GoalRecord, HrmsSnapshot, PerformanceCycleInput, PerformanceRecord, PerformanceReviewInput } from '../types/hrms.js'

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
  const [view, setView] = useState<'reviews' | 'goals'>('reviews')
  const [publishing, setPublishing] = useState<PerformanceRecord | null>(null)
  const [manualScore, setManualScore] = useState(false)
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
  

  const averageOf = (form: Pick<PerformanceReviewInput, 'goalProgress' | 'quality' | 'productivity' | 'teamwork'>) => Math.round((Number(form.goalProgress) + Number(form.quality) + Number(form.productivity) + Number(form.teamwork)) / 4)
  const openReview = (review?: PerformanceRecord) => {
    const next = review ? { ...review, comments: review.comments ?? '', cycleId: review.cycleId ?? '' } : { employeeId: defaultEmployee, cycleId: defaultCycle?.id ?? '', period: defaultCycle?.period ?? `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`, score: 80, goalProgress: 80, quality: 80, productivity: 80, teamwork: 80, comments: '' }
    setManualScore(Boolean(review) && Number(next.score) !== averageOf(next))
    setReviewForm(next)
  }
  const openGoal = (goal?: GoalRecord) => {
    setGoalForm(goal ? { ...goal, dueDate: goal.dueDate ?? '' } : { employeeId: defaultEmployee, title: '', description: '', category: 'Growth', progress: 0, status: 'Active', dueDate: '' })
    setShowGoal(true)
  }
  const effectiveScore = reviewForm ? (manualScore ? Number(reviewForm.score) : averageOf(reviewForm)) : 0
  const reviewColumns: DataColumn<PerformanceRecord>[] = [
    { id: 'employee', header: 'Employee', primary: true, cell: (review) => <span className="cell-stack"><strong>{personName(data, review.employeeId)}</strong><small>{review.employeeId}</small></span>, sortValue: (review) => personName(data, review.employeeId) },
    { id: 'period', header: 'Period', cell: (review) => review.period, sortValue: (review) => review.period },
    { id: 'score', header: 'Score', align: 'end', cell: (review) => <strong>{review.score}/100</strong>, sortValue: (review) => review.score },
    { id: 'rating', header: 'Rating', cell: (review) => review.rating, sortValue: (review) => review.rating },
    { id: 'status', header: 'Status', cell: (review) => <Badge tone={statusTone(review.status)}>{review.status === 'Draft' ? 'Private draft' : review.status}</Badge>, sortValue: (review) => review.status },
    { id: 'actions', header: '', align: 'end', cell: (review) => review.status === 'Draft' ? <button type="button" className="mini-button approve" onClick={() => setPublishing(review)}><Send aria-hidden="true" />Publish</button> : null },
  ]
  const goalColumns: DataColumn<GoalRecord>[] = [
    { id: 'title', header: 'Goal', primary: true, cell: (goal) => <span className="cell-stack"><strong>{goal.title}</strong><small>{goal.category}</small></span>, sortValue: (goal) => goal.title },
    { id: 'employee', header: 'Employee', cell: (goal) => personName(data, goal.employeeId), sortValue: (goal) => personName(data, goal.employeeId) },
    { id: 'progress', header: 'Progress', cell: (goal) => <span className="inline-progress"><progress value={goal.progress} max={100} aria-hidden="true" />{goal.progress}%</span>, sortValue: (goal) => goal.progress },
    { id: 'due', header: 'Due', cell: (goal) => { const overdue = goal.status === 'Active' && goal.dueDate && goal.dueDate < new Date().toISOString().slice(0, 10); return <span className={overdue ? 'text-danger' : undefined}>{formatDate(goal.dueDate)}{overdue ? ' · overdue' : ''}</span> }, sortValue: (goal) => goal.dueDate ?? '' },
    { id: 'status', header: 'Status', cell: (goal) => <Badge tone={statusTone(goal.status)}>{goal.status}</Badge>, sortValue: (goal) => goal.status },
  ]
  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reviewForm) return
    const score = effectiveScore
    const rating = ratingForScore(score)
    try { await savePerformance({ ...reviewForm, score, rating }); setReviewForm(null) } catch { /* Keep private draft open. */ }
  }
  const submitCycle = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await createPerformanceCycle(cycleForm); setShowCycle(false) } catch { /* Keep form open. */ } }
  const submitGoal = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); try { await saveGoal(goalForm); setShowGoal(false); setGoalForm({ employeeId: goalForm.employeeId, title: '', description: '', category: 'Growth', progress: 0, status: 'Active', dueDate: '' }) } catch { /* Keep form open. */ } }

  return <div className="page-stack">
    <SectionHeading title="Performance" description="Run review cycles, write reviews as private drafts, publish them, and manage goals." actions={<><button className="button button-secondary" onClick={() => setShowCycle(true)}><CalendarDays aria-hidden="true" />New cycle</button><button className="button button-secondary" onClick={() => openGoal()}><Target aria-hidden="true" />Add goal</button><button className="button button-primary" onClick={() => openReview()}><Plus aria-hidden="true" />New review</button></>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={CalendarCheck} label="Active cycles" value={data.performanceCycles.filter((item) => item.status === 'Active').length} detail={data.performanceCycles.find((item) => item.status === 'Active')?.title} tone="blue" /><StatCard icon={FileText} label="Draft reviews" value={data.performance.filter((item) => item.status === 'Draft').length} detail="Not yet visible to employees" tone="amber" /><StatCard icon={TrendingUp} label="Active goals" value={data.goals.filter((item) => item.status === 'Active').length} detail={`${data.goals.filter((item) => item.status === 'Active' && item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10)).length} overdue`} tone="green" /></div>
    <section className="panel">
      <div className="panel-header panel-header-tabs"><Tabs idPrefix="performance" label="Performance views" tabs={[{ id: 'reviews', label: 'Reviews', icon: Star, count: data.performance.length }, { id: 'goals', label: 'Goals', icon: Target, count: data.goals.length }]} active={view} onChange={setView} /></div>
      <div {...tabPanelProps('performance', view)} className="tab-panel">
        {view === 'reviews' && <DataTable
          rows={data.performance}
          columns={reviewColumns}
          getRowId={(review) => review.id}
          caption="Performance reviews"
          count={{ singular: 'review', plural: 'reviews' }}
          search={{ placeholder: 'Search by employee', text: (review) => `${personName(data, review.employeeId)} ${review.employeeId} ${review.period}` }}
          filters={[{ id: 'period', label: 'Periods', value: (review) => review.period }, { id: 'status', label: 'Statuses', value: (review) => review.status }, { id: 'rating', label: 'Ratings', value: (review) => review.rating }]}
          initialSort={{ column: 'employee', direction: 'asc' }}
          exportName="performance-reviews"
          onRowClick={(review) => openReview(review)}
          rowActionLabel={(review) => `Edit review for ${personName(data, review.employeeId)}`}
          empty={{ icon: Star, title: 'No performance reviews', text: 'Write a review as a private draft, then publish it to the employee.', action: <button type="button" className="button button-primary button-small" onClick={() => openReview()}><Plus aria-hidden="true" />New review</button> }}
        />}
        {view === 'goals' && <DataTable
          rows={data.goals}
          columns={goalColumns}
          getRowId={(goal) => goal.id}
          caption="Employee goals"
          count={{ singular: 'goal', plural: 'goals' }}
          search={{ placeholder: 'Search goals', text: (goal) => `${goal.title} ${personName(data, goal.employeeId)} ${goal.category}` }}
          filters={[{ id: 'status', label: 'Statuses', value: (goal) => goal.status }, { id: 'category', label: 'Categories', value: (goal) => goal.category }]}
          initialSort={{ column: 'due', direction: 'asc' }}
          exportName="employee-goals"
          onRowClick={(goal) => openGoal(goal)}
          rowActionLabel={(goal) => `Edit goal ${goal.title}`}
          empty={{ icon: Target, title: 'No goals yet', text: 'Assign a goal so the employee can track progress.', action: <button type="button" className="button button-primary button-small" onClick={() => openGoal()}><Target aria-hidden="true" />Add goal</button> }}
        />}
      </div>
    </section>
    {publishing && <ConfirmDialog
      title="Publish review"
      icon={Send}
      heading={`Publish ${personName(data, publishing.employeeId)}’s ${publishing.period} review?`}
      message={<p>The employee can see the score, rating, and comments right away and is notified. Published reviews can still be edited.</p>}
      confirmLabel="Publish review"
      busyLabel="Publishing…"
      onCancel={() => setPublishing(null)}
      onConfirm={async () => { await publishPerformance(publishing.id); setPublishing(null) }}
    />}
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
              <legend className="rf-label">Ratings from 0 to 100</legend>
              <div className="rf-scores">{reviewMetrics.filter(({ key }) => key !== 'score').map(({ key, label }) => <div className="rf-score" key={key}>
                <label htmlFor={`review-${key}`}>{label}</label>
                <input id={`review-${key}`} type="number" min={0} max={100} value={reviewForm[key]} onChange={(event) => setReviewForm({ ...reviewForm, [key]: Number(event.target.value) })} required />
                <div className="rf-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, Number(reviewForm[key])))}%` }} /></div>
              </div>)}</div>
            </fieldset>
            <div className="rf-score rf-score--primary">
              <label htmlFor="review-score">Overall score</label>
              <input id="review-score" type="number" min={0} max={100} value={effectiveScore} onChange={(event) => setReviewForm({ ...reviewForm, score: Number(event.target.value) })} readOnly={!manualScore} aria-describedby="review-score-help" required />
              <p className="rf-help" id="review-score-help">{manualScore ? 'You are setting the overall score yourself.' : 'The average of the four ratings above.'}</p>
              <label className="rf-check"><input type="checkbox" checked={manualScore} onChange={(event) => { setManualScore(event.target.checked); if (event.target.checked) setReviewForm({ ...reviewForm, score: averageOf(reviewForm) }) }} />Adjust the overall score manually</label>
            </div>

            <Field label="Comments" status={<span className="rf-status rf-status--editing">Private draft</span>} count={`${reviewForm.comments.length}/1000`} help="Keep it factual, specific, and actionable.">{(control) => <textarea {...control} rows={5} maxLength={1000} value={reviewForm.comments} onChange={(event) => setReviewForm({ ...reviewForm, comments: event.target.value })} placeholder="Achievements, evidence, and development priorities for the review conversation" />}</Field>
          </div>

          <aside className="rf-summary" aria-label="Review summary">
            <h3>Review summary</h3>
            <div className="rf-rating"><div><span>Rating</span><h4>{ratingForScore(effectiveScore)}</h4></div><strong>{effectiveScore}<small>/100</small></strong></div>
            <div className="rf-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, effectiveScore))}%` }} /></div>
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
    {showGoal && <Modal title={goalForm.id ? 'Edit goal' : 'Assign employee goal'} onClose={() => setShowGoal(false)} size="large">
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
            {goalForm.id && <div className="rf-grid">
              <Field label="Status">{(control) => <select {...control} value={goalForm.status} onChange={(event) => setGoalForm({ ...goalForm, status: event.target.value })}>{['Active', 'At Risk', 'Completed', 'Archived'].map((status) => <option key={status}>{status}</option>)}</select>}</Field>
              <Field label="Progress (%)">{(control) => <input {...control} type="number" min={0} max={100} step={5} value={goalForm.progress} onChange={(event) => setGoalForm({ ...goalForm, progress: Number(event.target.value) })} required />}</Field>
            </div>}
            <Field label="Description" status={<span className="rf-status rf-status--editing">Recommended</span>} count={`${goalForm.description.length} characters`} help="Include a measurable result and the employee’s next step.">{(control) => <textarea {...control} rows={5} value={goalForm.description} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} placeholder="The expected outcome, how success is measured, and the support available" />}</Field>
          </div>

          <aside className="rf-summary" aria-label="Goal preview">
            <h3>What the employee will see</h3>
            <article className="rf-preview"><span>{goalForm.category || 'Goal category'}</span><h4>{goalForm.title.trim() || 'Your goal title will appear here'}</h4><p>{goalForm.description.trim() || 'Add a short description so the employee understands the outcome and the next step.'}</p></article>
            <SummaryList items={[
              ['Assigned to', selectedGoalEmployee ? `${selectedGoalEmployee.firstName} ${selectedGoalEmployee.lastName}` : 'Not selected'],
              ['Due date', goalForm.dueDate ? formatDate(goalForm.dueDate) : 'Not set'],
              [goalForm.id ? 'Progress' : 'Starting progress', `${goalForm.progress}%`],
              ['Status', goalForm.status],
            ]} />
            <Note icon={ShieldCheck}>Only the assigned employee and HR administrators can see this goal.</Note>
          </aside>
        </div>

        <FormFooter icon={Send} note={goalForm.id ? 'The employee sees your changes right away.' : 'Check the employee, outcome, and due date before assigning.'}>
          <button type="button" className="button button-secondary" onClick={() => setShowGoal(false)}>Cancel</button>
          <button className="button button-primary"><Target aria-hidden="true" />{goalForm.id ? 'Save goal' : 'Assign goal'}</button>
        </FormFooter>
      </form>
    </Modal>}
  </div>
}
