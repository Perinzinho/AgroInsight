import type { ClimateDailyPayload, EventsIndex, MachineAlertsPayload, Manifest, OperationsIndexPayload, PestsPayload, StopReasonsPayload, TrapSeriesPayload, TrapsPayload } from '../data/types'

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

export interface Filters {
  from: string
  to: string
  trapCodes: string[]
  pestKeys: string[]
}
