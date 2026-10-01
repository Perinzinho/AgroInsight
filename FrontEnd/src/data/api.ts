import type {
  ClimateDailyPayload,
  ClimateHourlyPayload,
  EventsIndex,
  MachineAlertsPayload,
  Manifest,
  OperationDetailPayload,
  OperationsIndexPayload,
  PestsPayload,
  StopReasonsPayload,
  TrapEventsPayload,
  TrapSeriesPayload,
  TrapsPayload,
} from './types'

/**
 * Raiz dos JSONs derivados. Os arquivos ficam em `public/data` e sao gerados por
 * `npm run data:build` antes do build do Vite, entao nao usam `import` (o que os
 * embutiria no bundle) e sim `fetch`, permitindo carregar sob demanda.
 */
export const DATA_ROOT = 'data'

export class DataLoadError extends Error {
  readonly file: string
  readonly cause: unknown

  constructor(file: string, cause: unknown) {
    super(`Falha ao carregar "${file}". Rode "npm run data:build" para gerar os JSONs.`)
    this.name = 'DataLoadError'
    this.file = file
    this.cause = cause
  }
}

/**
 * Cache de promessa por caminho: dois componentes que pedem o mesmo arquivo
 * compartilham uma unica requisicao, e uma falha nao fica presa para sempre.
 */
const cache = new Map<string, Promise<unknown>>()

function fetchJson<T>(file: string): Promise<T> {
  const cached = cache.get(file)
  if (cached) return cached as Promise<T>

  const request = fetch(`${DATA_ROOT}/${file}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} em ${file}`)
      return (await response.json()) as T
    })
    .catch((error: unknown) => {
      cache.delete(file)
      throw new DataLoadError(file, error)
    })

  cache.set(file, request)
  return request
}

/** Usado nos testes para nao vazar requisicao entre casos. */
export function clearDataCache(): void {
  cache.clear()
}

export const loadManifest = () => fetchJson<Manifest>('manifest.json')
export const loadTraps = () => fetchJson<TrapsPayload>('traps.json')
export const loadPests = () => fetchJson<PestsPayload>('pests.json')
export const loadTrapSeries = () => fetchJson<TrapSeriesPayload>('trap-series.json')
export const loadEventsIndex = () => fetchJson<EventsIndex>('events/index.json')
export const loadTrapEvents = (file: string) => fetchJson<TrapEventsPayload>(`events/${file}`)
export const loadClimateDaily = () => fetchJson<ClimateDailyPayload>('climate/daily.json')
export const loadClimateHourly = () => fetchJson<ClimateHourlyPayload>('climate/hourly.json')
export const loadFertilization = () => fetchJson<OperationsIndexPayload>('operations/fertilization.json')
export const loadSpray = () => fetchJson<OperationsIndexPayload>('operations/spray.json')
export const loadOperationDetail = (file: string) => fetchJson<OperationDetailPayload>(file)
export const loadMachineAlerts = () => fetchJson<MachineAlertsPayload>('machine-alerts.json')
export const loadStopReasons = () => fetchJson<StopReasonsPayload>('stop-reasons.json')