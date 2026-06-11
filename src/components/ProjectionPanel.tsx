import { useMemo } from 'react'
import type { DayActivity } from '../types/account'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import {
  computeProgressProjection,
  projectionCurvePoints,
  PROJECTION_HORIZONS,
  type StreakKind,
} from '../lib/projection'

interface Props {
  activities: DayActivity[]
  startBalance: number
  asOfDate: string
  t: Translations['projection']
}

function streakLabel(kind: StreakKind, days: number, t: Translations['projection']): string {
  if (kind === 'win') return t.streakWin.replace('{days}', String(days))
  if (kind === 'loss') return t.streakLoss.replace('{days}', String(days))
  return t.streakFlat
}

function ScopeTable({
  scope,
  streakKind,
  t,
}: {
  scope: ReturnType<typeof computeProgressProjection>['month']
  streakKind: StreakKind
  t: Translations['projection']
}) {
  const rateLabel =
    streakKind === 'win'
      ? t.rateWinDays
      : streakKind === 'loss'
        ? t.rateLossDays
        : t.rateAllDays

  return (
    <section className="panel projection-scope">
      <div className="panel-head">
        <h3>{scope.label}</h3>
        <span className="muted-hint">
          {rateLabel}: <strong className={pnlClass(scope.dailyRate)}>{formatMoney(scope.dailyRate)}</strong>
          /{t.dayUnit}
        </span>
      </div>

      {scope.sampleNote === 'noWinDays' && (
        <p className="projection-note">{t.fallbackNoWinDays}</p>
      )}
      {scope.sampleNote === 'noLossDays' && (
        <p className="projection-note">{t.fallbackNoLossDays}</p>
      )}
      {scope.sampleNote === 'noDays' && <p className="projection-note">{t.fallbackNoDays}</p>}

      <div className="projection-stats">
        <div className="projection-stat">
          <span className="label">{t.winDays}</span>
          <span className="val positive">
            {scope.averages.winDays} · {formatMoney(scope.averages.avgWinDayPnl)}
          </span>
        </div>
        <div className="projection-stat">
          <span className="label">{t.lossDays}</span>
          <span className="val negative">
            {scope.averages.lossDays} · {formatMoney(scope.averages.avgLossDayPnl)}
          </span>
        </div>
        <div className="projection-stat">
          <span className="label">{t.periodPnl}</span>
          <span className={`val ${pnlClass(scope.averages.totalPnl)}`}>
            {formatMoney(scope.averages.totalPnl)}
          </span>
        </div>
      </div>

      <table className="data-table projection-table">
        <thead>
          <tr>
            <th>{t.horizon}</th>
            <th>{t.projectedPnl}</th>
            <th>{t.projectedBalance}</th>
          </tr>
        </thead>
        <tbody>
          {scope.horizons.map((h) => (
            <tr key={h.days}>
              <td>{t.days.replace('{n}', String(h.days))}</td>
              <td className={pnlClass(h.projectedPnl)}>{formatMoney(h.projectedPnl)}</td>
              <td>{formatMoney(h.projectedBalance).replace('+', '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ProjectionChart({
  startBalance,
  monthRate,
  allRate,
  t,
}: {
  startBalance: number
  monthRate: number
  allRate: number
  t: Translations['projection']
}) {
  const maxDays = PROJECTION_HORIZONS[PROJECTION_HORIZONS.length - 1]
  const monthPts = projectionCurvePoints(startBalance, monthRate, maxDays)
  const allPts = projectionCurvePoints(startBalance, allRate, maxDays)
  const balances = [...monthPts, ...allPts].map((p) => p.balance)
  const min = Math.min(...balances)
  const max = Math.max(...balances)
  const range = max - min || 1
  const h = 120
  const w = 100
  const pad = 6

  const toPath = (pts: typeof monthPts) =>
    pts
      .map((p, i) => {
        const x = pad + (p.day / maxDays) * (w - pad * 2)
        const y = pad + (1 - (p.balance - min) / range) * (h - pad * 2)
        return `${i === 0 ? 'M' : 'L'}${x},${y}`
      })
      .join(' ')

  return (
    <div className="projection-chart-wrap">
      <h4>{t.chartTitle}</h4>
      <svg viewBox={`0 0 ${w} ${h}`} className="projection-chart" preserveAspectRatio="none">
        <path d={toPath(allPts)} className="proj-line all" fill="none" strokeWidth="1.5" />
        <path d={toPath(monthPts)} className="proj-line month" fill="none" strokeWidth="1.5" />
      </svg>
      <div className="projection-legend">
        <span className="leg month">{t.scopeMonth}</span>
        <span className="leg all">{t.scopeAll}</span>
      </div>
    </div>
  )
}

export function ProjectionPanel({ activities, startBalance, asOfDate, t }: Props) {
  const projection = useMemo(
    () => computeProgressProjection(activities, startBalance, asOfDate),
    [activities, startBalance, asOfDate],
  )

  const { streak, month, all } = projection

  return (
    <div className="projection-panel">
      <section className="panel projection-intro">
        <h2>{t.title}</h2>
        <p className="welcome-lead">{t.subtitle}</p>

        <div className="projection-hero">
          <div className={`projection-hero-card ${streak.kind === 'loss' ? 'loss' : streak.kind === 'win' ? 'win' : ''}`}>
            <span className="label">{t.currentStreak}</span>
            <span className="val">{streakLabel(streak.kind, streak.days, t)}</span>
            <span className="sub">
              {t.todayPnl}: <strong className={pnlClass(streak.todayPnl)}>{formatMoney(streak.todayPnl)}</strong>
            </span>
          </div>
          <div className="projection-hero-card">
            <span className="label">{t.startBalance}</span>
            <span className="val">{formatMoney(startBalance).replace('+', '')}</span>
            <span className="sub">{t.asOf.replace('{date}', asOfDate)}</span>
          </div>
        </div>

        <p className="projection-disclaimer">{t.disclaimer}</p>
      </section>

      <ProjectionChart
        startBalance={startBalance}
        monthRate={month.dailyRate}
        allRate={all.dailyRate}
        t={t}
      />

      <div className="projection-scopes">
        <ScopeTable
          scope={{ ...month, label: t.scopeMonth.replace('{month}', projection.monthKey) }}
          streakKind={streak.kind}
          t={t}
        />
        <ScopeTable scope={{ ...all, label: t.scopeAll }} streakKind={streak.kind} t={t} />
      </div>
    </div>
  )
}
