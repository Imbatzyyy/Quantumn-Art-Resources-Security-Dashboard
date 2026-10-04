import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthGrid, monthLabel, monthOf, shiftMonth } from '../utils/calendar.js'

export interface CalendarEvent {
  date: string
  label: string
  tone: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'neutral'
  detail?: string
}

interface MonthCalendarProps {
  /** YYYY-MM */
  month: string
  today: string
  events: CalendarEvent[]
  onMonthChange: (month: string) => void
  legend?: Array<{ tone: CalendarEvent['tone']; label: string }>
  caption?: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function MonthCalendar({ month, today, events, onMonthChange, legend, caption }: MonthCalendarProps) {
  const grid = monthGrid(month)
  const byDate = new Map<string, CalendarEvent[]>()
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event])
  const weeks = Array.from({ length: grid.length / 7 }, (_, index) => grid.slice(index * 7, index * 7 + 7))
  const label = monthLabel(month)

  return <div className="month-calendar">
    <div className="month-calendar-head">
      <strong aria-live="polite">{label}</strong>
      <div>
        <button type="button" className="icon-button" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
        <button type="button" className="button button-secondary button-small" onClick={() => onMonthChange(monthOf(today))} disabled={monthOf(today) === month}>Today</button>
        <button type="button" className="icon-button" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
      </div>
    </div>
    <table className="month-calendar-grid">
      <caption className="sr-only">{caption ? `${caption}, ${label}` : label}</caption>
      <thead><tr>{WEEKDAYS.map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
      <tbody>
        {weeks.map((week) => <tr key={week[0].date}>
          {week.map(({ date, inMonth }) => {
            const dayEvents = byDate.get(date) ?? []
            const dayNumber = Number(date.slice(8))
            const description = dayEvents.map((event) => `${event.label}${event.detail ? `, ${event.detail}` : ''}`).join('; ')
            return <td key={date} className={`${inMonth ? '' : 'is-outside'} ${date === today ? 'is-today' : ''}`.trim() || undefined}>
              <span className="month-calendar-day" aria-label={`${new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))}${date === today ? ', today' : ''}${description ? `: ${description}` : ''}`}>{dayNumber}</span>
              <div className="month-calendar-events" aria-hidden="true">
                {dayEvents.slice(0, 2).map((event, index) => <span key={`${event.label}-${index}`} className={`calendar-chip tone-${event.tone}`} title={event.detail ? `${event.label} · ${event.detail}` : event.label}>{event.label}</span>)}
                {dayEvents.length > 2 && <span className="calendar-more">+{dayEvents.length - 2} more</span>}
              </div>
            </td>
          })}
        </tr>)}
      </tbody>
    </table>
    {legend && <ul className="month-calendar-legend" aria-label="Calendar legend">{legend.map((item) => <li key={item.label}><i className={`tone-${item.tone}`} aria-hidden="true" />{item.label}</li>)}</ul>}
  </div>
}
