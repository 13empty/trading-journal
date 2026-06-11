export interface BrokerPreset {
  id: string
  nameKey: string
  /** Horas a sumar al timestamp del servidor MT5 para obtener fecha local del calendario */
  offsetHours: number
}

export const BROKER_PRESETS: BrokerPreset[] = [
  { id: 'ic_markets', nameKey: 'icMarkets', offsetHours: 6 },
  { id: 'xm', nameKey: 'xm', offsetHours: 6 },
  { id: 'pepperstone', nameKey: 'pepperstone', offsetHours: 6 },
  { id: 'exness', nameKey: 'exness', offsetHours: 5 },
  { id: 'ftmo', nameKey: 'ftmo', offsetHours: 6 },
  { id: 'other', nameKey: 'other', offsetHours: 6 },
]

export function presetById(id: string | undefined): BrokerPreset {
  return BROKER_PRESETS.find((p) => p.id === id) ?? BROKER_PRESETS[0]
}
