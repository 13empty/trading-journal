type Mt5LinkState = 'connected' | 'waiting' | 'offline'

interface Props {
  bridgeOnline: boolean
  mt5Connected: boolean
  onOpenSync: () => void
  label: string
  titles: {
    connected: string
    waiting: string
    offline: string
  }
}

function resolveState(bridgeOnline: boolean, mt5Connected: boolean): Mt5LinkState {
  if (!bridgeOnline) return 'offline'
  if (mt5Connected) return 'connected'
  return 'waiting'
}

/** Compact colored status chip → opens Sync tab. */
export function Mt5StatusButton({
  bridgeOnline,
  mt5Connected,
  onOpenSync,
  label,
  titles,
}: Props) {
  const state = resolveState(bridgeOnline, mt5Connected)
  return (
    <button
      type="button"
      className={`mt5-status-btn mt5-status-btn-${state}`}
      onClick={onOpenSync}
      title={titles[state]}
      aria-label={`${label}: ${titles[state]}`}
    >
      <span className="mt5-status-btn-dot" aria-hidden="true" />
      <span className="mt5-status-btn-label">{label}</span>
    </button>
  )
}

export type { Mt5LinkState }
