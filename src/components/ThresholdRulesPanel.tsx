import type { ThresholdRuleState } from '../types/journal'
import type { Translations } from '../i18n/types'

interface Props {
  rules: ThresholdRuleState[]
  t: Translations['thresholds']
  compact?: boolean
}

const LABEL_KEY: Record<ThresholdRuleState['id'], keyof Translations['thresholds']> = {
  daily_loss: 'dailyLoss',
  max_trades: 'maxTrades',
  revenge_risk: 'revengeRisk',
  drawdown_peak: 'drawdownPeak',
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

  return (
    <section
      className={`panel threshold-rules-panel${warnCount > 0 ? ' has-warn' : ''}${compact ? ' compact' : ''}`}
      aria-label={t.title}
    >
      {!compact && (
        <>
          <h3>{t.title}</h3>
          <p className="threshold-rules-sub">{t.subtitle}</p>
        </>
      )}
      <ul className="threshold-rules-list">
        {rules.map((rule) => (
          <li key={rule.id} className={`threshold-rule threshold-${rule.status}`}>
            <span className="threshold-rule-name">{t[LABEL_KEY[rule.id]]}</span>
            <span className={`threshold-rule-status threshold-status-${rule.status}`}>
              {statusLabel(rule.status)}
            </span>
            <span className="threshold-rule-detail">{detailFor(rule)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
