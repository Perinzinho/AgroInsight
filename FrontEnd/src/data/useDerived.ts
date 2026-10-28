import { useMemo } from 'react'
import { useAgro } from './agroContext'
import {
  buildEvidence,
  countSeries,
  detectionsByPest,
  filterSeries,
  previousPeriod,
  resolveCulture,
  trapRanking,
  trapsWithLoad,
} from './selectors'
import { daysBetween } from '../core/utils/format'
import type { TrapWithLoad } from './selectors'

/**
 * Derivacoes compartilhadas pelas telas.
 *
 * Todas sao funcoes puras de `selectors`, entao ficam memoizadas aqui uma vez
 * por combinacao de filtros em vez de se repetirem em cada view.
 */
export interface DerivedView {
  days: string[]
  rows: ReturnType<typeof filterSeries>
  previousRows: ReturnType<typeof filterSeries>
  previousWindow: { from: string; to: string }
  pestKeys: string[]
  trapCodes: string[]
  trapCulture: string | null
  counts: ReturnType<typeof countSeries>
  byPest: ReturnType<typeof detectionsByPest>
  ranking: ReturnType<typeof trapRanking>
  traps: TrapWithLoad[]
  evidence: ReturnType<typeof buildEvidence>
  machineAlertDays: Map<string, number>
  operationsByDay: { day: string; operation: string; serviceOrder: string }[]
}

export function useDerived(): DerivedView | null {
  const { data, filters } = useAgro()

  return useMemo(() => {
    if (!data) return null

    const days = daysBetween(filters.from, filters.to)
    const previousWindow = previousPeriod(filters.from, filters.to)
    const rows = filterSeries({ rows: data.series.rows, filters })
    const previousRows = filterSeries({
      rows: data.series.rows,
      filters: { ...previousWindow, trapCodes: filters.trapCodes, pestKeys: filters.pestKeys },
    })

    const machineAlertDays = new Map<string, number>()
    for (const alert of data.machineAlerts.alerts) {
      machineAlertDays.set(alert.day, (machineAlertDays.get(alert.day) ?? 0) + 1)
    }

    const operationsByDay = [
      ...data.fertilization.operations.flatMap((operation) =>
        operation.days.map((day) => ({ day, operation: operation.operation, serviceOrder: operation.serviceOrder })),
      ),
      ...data.spray.operations.flatMap((operation) =>
        operation.days.map((day) => ({ day, operation: operation.operation, serviceOrder: operation.serviceOrder })),
      ),
    ]

    const trapCulture = resolveCulture(data.traps.traps, filters.trapCodes)

    return {
      days,
      rows,
      previousRows,
      previousWindow,
      pestKeys: filters.pestKeys,
      trapCodes: filters.trapCodes,
      trapCulture,
      counts: countSeries(rows, filters.pestKeys),
      byPest: detectionsByPest(rows, filters.pestKeys),
      ranking: trapRanking(rows, data.pests.groups, trapCulture),
      traps: trapsWithLoad(data.traps.traps, rows, data.pests.groups, trapCulture),
      evidence: buildEvidence({
        days,
        byPest: detectionsByPest(rows, filters.pestKeys),
        groups: data.pests.groups,
        trapCulture,
        climate: data.climate.days,
        operations: operationsByDay,
        machineAlertDays,
        pestKeys: filters.pestKeys,
      }),
      machineAlertDays,
      operationsByDay,
    }
  }, [data, filters])
}

/** Mapa de severidade para as classes de cor dos componentes. */
export const TONE_BY_SEVERITY = {
  critical: 'red',
  high: 'yellow',
  medium: 'yellow',
  low: 'blue',
  ok: 'green',
  unknown: 'neutral',
} as const