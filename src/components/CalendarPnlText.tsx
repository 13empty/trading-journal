import type { CalendarPnlDisplay } from '../types/account'
import { formatCompactPercent, formatCompactPnl } from '../lib/calendarPnl'
import { pnlClass } from '../lib/aggregations'

interface Props {
  mode: CalendarPnlDisplay
  pnl: number
  pct: number | null
  isLive?: boolean
  compact?: boolean
  className?: string
}

export function CalendarPnlText({
  mode,
  pnl,
  pct,
  isLive = false,
  compact = false,
  className = '',
}: Props) {
  const cls = `cal-pnl ${pnlClass(pnl)}${compact ? ' cal-pnl-compact' : ''}${className ? ` ${className}` : ''}`
  const star = isLive ? <span className="cal-live-star">*</span> : null
  const dollar = pnl === 0 ? '0' : formatCompactPnl(pnl)
  const percent = pct == null ? '—' : formatCompactPercent(pct)

  if (mode === 'dollar') {
    return (
      <span className={cls}>
        <span className="cal-pnl-line">{dollar}</span>
        {star}
      </span>
    )
  }

  if (mode === 'percent') {
    return (
      <span className={cls}>
        <span className="cal-pnl-line">{percent}</span>
        {star}
      </span>
    )
  }

  return (
    <span className={`${cls} cal-pnl-dual`}>
      <span className="cal-pnl-line cal-pnl-dollar">{dollar}</span>
      <span className="cal-pnl-line cal-pnl-pct">{percent}</span>
      {star}
    </span>
  )
}
