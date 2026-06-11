import type { EquityPoint } from '../types/journal'

interface Props {
  points: EquityPoint[]
  height?: number
}

type Pt = { x: number; y: number }

function formatLabel(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}k`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`
  return `${sign}$${Math.round(abs)}`
}

function formatEndLabel(value: number): string {
  const base = formatLabel(value)
  if (value > 0) return `+${base}`
  return base
}

/** Monotone cubic — suave sin overshoot (mockup B) */
function monotonePath(points: Pt[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  const n = points.length
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    slopes.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx)
  }

  const tangents: number[] = [slopes[0]]
  for (let i = 1; i < n - 1; i++) {
    const s0 = slopes[i - 1]
    const s1 = slopes[i]
    if (s0 * s1 <= 0) tangents.push(0)
    else tangents.push((s0 + s1) / 2)
  }
  tangents.push(slopes[n - 2])

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const dx = (p1.x - p0.x) / 3
    const cp1x = p0.x + dx
    const cp1y = p0.y + tangents[i] * dx
    const cp2x = p1.x - dx
    const cp2y = p1.y - tangents[i + 1] * dx
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`
  }
  return d
}

function areaPath(points: Pt[], baseY: number): string {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${monotonePath(points)} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`
}

export function EquityCurve({ points, height = 112 }: Props) {
  if (points.length < 2) {
    return <p className="empty chart-empty">—</p>
  }

  const w = 360
  const h = height
  const pad = { t: 12, r: 8, b: 8, l: 8 }
  const plotW = w - pad.l - pad.r
  const plotH = h - pad.t - pad.b
  const baseY = h - pad.b

  const values = points.map((p) => p.balance)
  const startVal = values[0]
  const endVal = values[values.length - 1]
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const span = dataMax - dataMin || Math.max(Math.abs(endVal), 1) * 0.08 || 1
  const yMin = dataMin - span * 0.1
  const yMax = dataMax + span * 0.1
  const yRange = yMax - yMin

  const xy: Pt[] = points.map((p, i) => ({
    x: pad.l + (i / (points.length - 1)) * plotW,
    y: pad.t + (1 - (p.balance - yMin) / yRange) * plotH,
  }))

  const last = xy[xy.length - 1]
  const trend = endVal >= startVal ? 'up' : 'down'
  const lineD = monotonePath(xy)
  const areaD = areaPath(xy, baseY)

  return (
    <div className="equity-curve-wrap">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={`equity-curve equity-curve-premium ${trend}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Equity curve"
      >
        <path className="eq-area" d={areaD} />
        <path
          className="eq-stroke"
          d={lineD}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="eq-dot-ring" cx={last.x} cy={last.y} r="5" />
        <circle className="eq-dot" cx={last.x} cy={last.y} r="2.25" />
      </svg>
      <div className="equity-labels">
        <span>{formatLabel(startVal)}</span>
        <span className="eq-label-end">{formatEndLabel(endVal)}</span>
      </div>
    </div>
  )
}
