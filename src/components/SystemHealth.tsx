import type { Translations } from '../i18n/types'
import { interpolate } from '../i18n'

export interface HealthCheck {
  id: string
  label: string
  ok: boolean
  detail: string
}

interface Props {
  checks: HealthCheck[]
  onRefresh: () => void
  refreshing?: boolean
  health: Translations['health']
}

export function SystemHealthPanel({ checks, onRefresh, refreshing, health }: Props) {
  const tf = interpolate
  const failed = checks.filter((c) => !c.ok)
  const allOk = failed.length === 0

  return (
    <details className={`health-panel ${allOk ? 'ok' : 'warn'}`} open={!allOk}>
      <summary className="health-summary">
        <span className="health-summary-title">{health.title}</span>
        <span className={`health-badge ${allOk ? 'on' : 'off'}`}>
          {allOk ? health.ok : tf(health.warnings, { count: failed.length })}
        </span>
      </summary>
      <ul className="health-list">
        {checks.map((c) => (
          <li key={c.id} className={c.ok ? 'ok' : 'bad'}>
            <span className="health-dot" />
            <span className="health-label">{c.label}</span>
            <span className="health-detail">{c.detail}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn-secondary health-btn"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? health.verifying : health.syncNow}
      </button>
    </details>
  )
}
