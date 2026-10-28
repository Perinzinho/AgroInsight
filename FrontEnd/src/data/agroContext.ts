import { createContext, useContext } from 'react'
import type {
  ClimateDailyPayload,
  EventsIndex,
  MachineAlertsPayload,
  Manifest,
  OperationsIndexPayload,
  PestsPayload,
  StopReasonsPayload,
  TrapSeriesPayload,
  TrapsPayload,
} from './types'

/** Pacote base do conjunto: tudo que a Visao Geral precisa. */
export interface Dataset {
  manifest: Manifest
  traps: TrapsPayload
  pests: PestsPayload
  series: TrapSeriesPayload
  events: EventsIndex
  climate: ClimateDailyPayload
  fertilization: OperationsIndexPayload
  spray: OperationsIndexPayload
  machineAlerts: MachineAlertsPayload
  stopReasons: StopReasonsPayload
}

export type LoadStatus = 'loading' | 'ready' | 'error'

/** Filtros globais. Listas vazias significam "todos". */
export interface Filters {
  /** `aaaa-mm-dd` no fuso da propriedade. */
  from: string
  to: string
  trapCodes: string[]
  pestKeys: string[]
}

export interface AgroContextValue {
  status: LoadStatus
  error: string | null
  data: Dataset | null
  filters: Filters
  /** Intervalo completo disponivel, independente do filtro atual. */
  availableRange: { from: string; to: string }
  isFiltered: boolean
  reload: () => void
  setPeriod: (from: string, to: string) => void
  toggleTrap: (trapCode: string) => void
  togglePest: (pestKey: string) => void
  resetFilters: () => void
}

export const AgroContext = createContext<AgroContextValue | null>(null)

export function useAgro(): AgroContextValue {
  const value = useContext(AgroContext)
  if (!value) throw new Error('useAgro precisa estar dentro de <AgroProvider>.')
  return value
}