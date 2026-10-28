import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  loadClimateDaily,
  loadEventsIndex,
  loadFertilization,
  loadMachineAlerts,
  loadManifest,
  loadPests,
  loadSpray,
  loadStopReasons,
  loadTrapSeries,
  loadTraps,
} from './api'
import { AgroContext } from './agroContext'
import type { AgroContextValue, Dataset, Filters, LoadStatus } from './agroContext'
import type { Manifest } from './types'

/**
 * Menor intervalo que ja traz dado de armadilha. O periodo inicial da aplicacao
 * e o do plano: os ultimos 7 dias com captura, para o primeiro acesso nao abrir
 * em um range quase vazio.
 */
const DEFAULT_WINDOW_DAYS = 7

/** Intervalo que cobre todos os conjuntos, na ordem UTC ja normalizada. */
function overallRange(manifest: Manifest): { from: string; to: string } {
  const ranges = [
    manifest.coverage.events.range,
    manifest.coverage.climate.range,
    manifest.coverage.fertilization.range,
    manifest.coverage.spray.range,
    manifest.coverage.machineAlerts.range,
  ].filter(([start, end]) => start !== null && end !== null) as [string, string][]

  if (ranges.length === 0) return { from: '', to: '' }

  return {
    from: ranges.reduce((min, [start]) => (start < min ? start : min), ranges[0][0]),
    to: ranges.reduce((max, [, end]) => (end > max ? end : max), ranges[0][1]),
  }
}

/** Subtrai dias de uma chave `aaaa-mm-dd` sem depender do fuso da maquina. */
function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, date + delta))
  return shifted.toISOString().slice(0, 10)
}

/** Janela inicial: os ultimos dias do intervalo de eventos, nao do conjunto todo. */
function initialFilters(manifest: Manifest): Filters {
  const [firstDay, lastDay] = manifest.coverage.events.range
  if (!firstDay || !lastDay) {
    const range = overallRange(manifest)
    return { from: range.from, to: range.to, trapCodes: [], pestKeys: [] }
  }
  return {
    from: shiftDay(lastDay, -(DEFAULT_WINDOW_DAYS - 1)),
    to: lastDay,
    trapCodes: [],
    pestKeys: [],
  }
}

async function loadDataset(): Promise<Dataset> {
  const [
    manifest,
    traps,
    pests,
    series,
    events,
    climate,
    fertilization,
    spray,
    machineAlerts,
    stopReasons,
  ] = await Promise.all([
    loadManifest(),
    loadTraps(),
    loadPests(),
    loadTrapSeries(),
    loadEventsIndex(),
    loadClimateDaily(),
    loadFertilization(),
    loadSpray(),
    loadMachineAlerts(),
    loadStopReasons(),
  ])

  return {
    manifest,
    traps,
    pests,
    series,
    events,
    climate,
    fertilization,
    spray,
    machineAlerts,
    stopReasons,
  }
}

/** Filtros neutros enquanto o manifesto nao carregou. Objeto unico e imutavel. */
const EMPTY_FILTERS: Filters = { from: '', to: '', trapCodes: [], pestKeys: [] }

export default function AgroProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [filters, setFilters] = useState<Filters | null>(null)

  useEffect(() => {
    let cancelled = false

    // Nenhum `setState` sincrono aqui: o effect so publica o resultado da
    // promessa, para nao provocar render em cascata. O reset para "carregando"
    // acontece no `reload`, que e um evento, e o estado inicial ja comeca assim.
    loadDataset()
      .then((loaded) => {
        if (cancelled) return
        setData(loaded)
        setFilters((current) => current ?? initialFilters(loaded.manifest))
        setStatus('ready')
        setError(null)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : String(cause))
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setError(null)
    setAttempt((value) => value + 1)
  }, [])

  const availableRange = useMemo(
    () => (data ? overallRange(data.manifest) : { from: '', to: '' }),
    [data],
  )

  const setPeriod = useCallback(
    (from: string, to: string) => {
      // Periodo invertido nao faz sentido: mantemos a ordem do filtro anterior.
      const [first, last] = from <= to ? [from, to] : [to, from]
      setFilters((current) => (current ? { ...current, from: first, to: last } : current))
    },
    [],
  )

  const toggleTrap = useCallback((trapCode: string) => {
    setFilters((current) =>
      current
        ? {
            ...current,
            trapCodes: current.trapCodes.includes(trapCode)
              ? current.trapCodes.filter((code) => code !== trapCode)
              : [...current.trapCodes, trapCode],
          }
        : current,
    )
  }, [])

  const togglePest = useCallback((pestKey: string) => {
    setFilters((current) =>
      current
        ? {
            ...current,
            pestKeys: current.pestKeys.includes(pestKey)
              ? current.pestKeys.filter((key) => key !== pestKey)
              : [...current.pestKeys, pestKey],
          }
        : current,
    )
  }, [])

  const resetFilters = useCallback(() => {
    setFilters((current) =>
      current
        ? {
            from: shiftDay(current.to, -(DEFAULT_WINDOW_DAYS - 1)),
            to: current.to,
            trapCodes: [],
            pestKeys: [],
          }
        : current,
    )
  }, [])

  const isFiltered = Boolean(filters && (filters.trapCodes.length > 0 || filters.pestKeys.length > 0))

  /*
   * O contexto e sempre preenchido, mesmo antes do primeiro dado chegar ou
   * depois de uma falha. `useAgro` lancaria com `null` e derrubaria a arvore
   * inteira — foi exatamente o que aconteceu: a tela branca aparecia durante o
   * carregamento e tambem no caminho de erro, que e justamente quando o usuario
   * mais precisa da mensagem e do botao de tentar de novo.
   *
   * Os filtros sao reais assim que o manifesto carrega; antes disso ficam
   * vazios, e as telas ja tratam `data === null` pelo `DataState`.
   */
  const value: AgroContextValue = {
    status,
    error,
    data,
    filters: filters ?? EMPTY_FILTERS,
    availableRange,
    isFiltered,
    reload,
    setPeriod,
    toggleTrap,
    togglePest,
    resetFilters,
  }

  return <AgroContext.Provider value={value}>{children}</AgroContext.Provider>
}