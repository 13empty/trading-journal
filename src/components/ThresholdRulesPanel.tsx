import type { ThresholdRuleState } from '../types/journal'
import { THRESHOLD_LABEL_KEYS } from '../lib/thresholdRules'
import type { Translations } from '../i18n/types'

interface Props {
  rules: ThresholdRuleState[]
  t: Translations['thresholds']
  compact?: boolean
}

function riskLevel(
  rules: ThresholdRuleState[],
): 'off' | 'low' | 'medium' | 'high' {
  const active = rules.filter((r) => r.status !== 'off')
  if (active.length === 0) return 'off'
  const warns = active.filter((r) => r.status === 'warn')
  if (warns.length >= 2) return 'high'
  if (warns.length === 1) return 'medium'
  const hot = active.some((r) => (r.progress ?? 0) >= 70)
  if (hot) return 'medium'
  return 'low'
}

export function ThresholdRulesPanel({ rules, t, compact = false }: Props) {
  const statusLabel = (status: ThresholdRuleState['status']) => {
    if (status === 'warn') return t.statusWarn
    if (status === 'ok') return t.statusOk
    return t.statusOff
  }

  const detailFor = (rule: ThresholdRuleState): string => {
    if (rule.status === 'off') return t.notConfigured
    if (!rule.detail) return '—'
    if (rule.id === 'revenge_risk') {
      if (rule.detail === 'open') return t.revengeOpenAfterLoss
      return t.revengeAfterLoss.replace('{minutes}', rule.detail)
    }
    return rule.detail
  }

  const warnCount = rules.filter((r) => r.status === 'warn').length
  const level = riskLevel(rules)
  const levelLabel =
    level === 'high'
      ? t.riskHigh
      : level === 'medium'
        ? t.riskMedium
        : level === 'low'
          ? t.riskLow
          : t.riskOff

  const visible = rules.filter((r) => r.status !== 'off' || !compact)

  return (
    <section
      className={`panel threshold-rules-panel${warnCount > 0 ? ' has-warn' : ''}${compact ? ' compact' : ''}`}
      aria-label={t.title}
    >
      {!compact && (
        <>
          <div className="threshold-rules-head">
            <div>
              <h3>{t.title}</h3>
              <p className="threshold-rules-sub">{t.subtitle}</p>
            </div>
            {level !== 'off' && (
              <span className={`risk-pill risk-pill-${level}`}>
                <i className="risk-pill-dot" aria-hidden="true" />
                {levelLabel}
              </span>
            )}
          </div>
        </>
      )}
      {compact && level !== 'off' && (
        <div className="threshold-rules-compact-head">
          <span className={`risk-pill risk-pill-${level}`}>
            <i className="risk-pill-dot" aria-hidden="true" />
            {levelLabel}
          </span>
        </div>
      )}
      <ul className="threshold-rules-list threshold-rules-bars">
        {visible.map((rule) => (
          <li key={rule.id} className={`threshold-rule threshold-${rule.status}`}>
            <div className="threshold-rule-top">
              <span className="threshold-rule-name">{t[THRESHOLD_LABEL_KEYS[rule.id]]}</span>
              <span className={`threshold-rule-status threshold-status-${rule.status}`}>
                {statusLabel(rule.status)}
              </span>
            </div>
            <span className="threshold-rule-detail">{detailFor(rule)}</span>
            {rule.status !== 'off' && rule.progress != null && (
              <div className="threshold-bar">
                <div
                  className={`threshold-fill threshold-fill-${rule.status}`}
                  style={{ width: `${Math.min(100, Math.max(0, rule.progress))}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
