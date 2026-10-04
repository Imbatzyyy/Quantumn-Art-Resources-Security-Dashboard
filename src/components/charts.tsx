import type { ReactNode } from 'react'

export interface ChartDatum {
  label: string
  value: number
  detail?: string
}

interface BarListProps {
  data: ChartDatum[]
  format?: (value: number) => string
  empty?: string
  label: string
  tone?: 'blue' | 'green' | 'amber' | 'purple' | 'red'
}

/** Horizontal bars with exact values beside each label (no reading values off an axis). */
export function BarList({ data, format = (value) => value.toLocaleString(), empty = 'No data for this period.', label, tone = 'blue' }: BarListProps) {
  const max = Math.max(1, ...data.map((item) => item.value))
  if (!data.length) return <p className="chart-empty">{empty}</p>
  return <ul className={`bar-list tone-${tone}`} aria-label={label}>
    {data.map((item) => <li key={item.label}>
      <div className="bar-list-text"><span>{item.label}</span><strong>{format(item.value)}</strong></div>
      <div className="bar-list-track" aria-hidden="true"><span style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (item.value / max) * 100)}%` }} /></div>
      {item.detail && <small>{item.detail}</small>}
    </li>)}
  </ul>
}

interface ColumnChartProps {
  data: Array<{ label: string; values: number[] }>
  series: Array<{ name: string; tone: 'blue' | 'amber' | 'green' | 'red' | 'purple' }>
  label: string
  empty?: string
  format?: (value: number) => string
}

/** Grouped columns for a short time series, with a data table for exact values. */
export function ColumnChart({ data, series, label, empty = 'No data for this period.', format = (value) => value.toLocaleString() }: ColumnChartProps) {
  const max = Math.max(1, ...data.flatMap((item) => item.values))
  const total = data.reduce((sum, item) => sum + item.values.reduce((inner, value) => inner + value, 0), 0)
  if (!data.length || total === 0) return <p className="chart-empty">{empty}</p>
  return <figure className="column-chart">
    <div className="column-chart-plot" role="img" aria-label={`${label}. Exact values are in the table below the chart.`}>
      {data.map((item, index) => <div key={item.label} className="column-chart-group">
        <div className="column-chart-bars">{item.values.map((value, seriesIndex) => <span key={series[seriesIndex].name} className={`tone-${series[seriesIndex].tone}`} style={{ height: `${(value / max) * 100}%` }} title={`${item.label} · ${series[seriesIndex].name}: ${format(value)}`} />)}</div>
        <small aria-hidden="true">{data.length > 8 && index % 2 === 1 ? '\u00a0' : item.label}</small>
      </div>)}
    </div>
    <figcaption className="column-chart-legend">{series.map((item) => <span key={item.name}><i className={`tone-${item.tone}`} aria-hidden="true" />{item.name}</span>)}</figcaption>
    <details className="chart-data">
      <summary>Show exact values</summary>
      <div className="table-shell"><table><caption className="sr-only">{label}</caption><thead><tr><th scope="col">Period</th>{series.map((item) => <th scope="col" key={item.name}>{item.name}</th>)}</tr></thead><tbody>{data.map((item) => <tr key={item.label}><th scope="row">{item.label}</th>{item.values.map((value, index) => <td key={series[index].name}>{format(value)}</td>)}</tr>)}</tbody></table></div>
    </details>
  </figure>
}

export function ChartPanel({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="panel chart-panel">
    <div className="panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>
    <div className="chart-panel-body">{children}</div>
  </section>
}

export function KeyFigure({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return <div className="key-figure"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}
