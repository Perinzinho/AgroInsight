import { evaluatePestDay, resolveVariant } from './alertRules'
import type { AlertLevel } from './alertRules'
import type { Filters } from './agroContext'
import type {
  ClimateDay,
  PestGroup,
  SeriesPest,
  Trap,
  TrapSeriesRow,
} from './types'
import type { Severity } from '../core/theme/colors'

/**
 * Funcoes puras de derivacao sobre o pacote de dados.
 *
 * Ficam fora dos componentes de proposito: sao o nucleo testavel do produto e
 * nao dependem de React nem de rede.
 */

export const UNFILLED = 'Sem dado no arquivo'
export const UNCLASSIFIED = 'Sem classificacao'

/* ------------------------------------------------------------------ */
/* Filtragem                                                          */
/* ------------------------------------------------------------------ */

export interface SeriesFilterInput {
  rows: TrapSeriesRow[]
  filters: Pick<Filters, 'from' | 'to' | 'trapCodes' | 'pestKeys'>
}

export function filterSeries({ rows, filters }: SeriesFilterInput): TrapSeriesRow[] {
  const { from, to, trapCodes, pestKeys } = filters

  return rows.filter((row) => {
    if (row.day < from || row.day > to) return false
    if (trapCodes.length > 0 && !trapCodes.includes(row.trapCode)) return false
    if (pestKeys.length > 0 && !row.pests.some((pest) => pestKeys.includes(pest.pestKey))) return false
    return true
  })
}

/**
 * Contagens de uma serie ja filtrada. Quando o filtro de praga esta ativo, as
 * caixas sao recalculadas apenas com as pragas selecionadas, senao o cartao
 * continuaria mostrando o total de todas.
 */
export function countSeries(rows: TrapSeriesRow[], pestKeys: string[] = []) {
  let captures = 0
  let detections = 0
  let images = 0
  let divergentEvents = 0
  const pestKeysSeen = new Set<string>()

  for (const row of rows) {
    captures += row.captures
    images += row.images
    divergentEvents += row.divergentEvents
    detections += sumPestDetections(row.pests, pestKeys)
    for (const pest of row.pests) pestKeysSeen.add(pest.pestKey)
  }

  return {
    captures,
    detections,
    images,
    divergentEvents,
    traps: new Set(rows.map((row) => row.trapCode)).size,
    pestKeys: [...pestKeysSeen].sort(),
  }
}

export function sumPestDetections(pests: SeriesPest[], pestKeys: string[] = []): number {
  return pests.reduce(
    (sum, pest) => sum + (pestKeys.length === 0 || pestKeys.includes(pest.pestKey) ? pest.detections : 0),
    0,
  )
}

/** `true` quando o filtro de praga esta ativo e mudou o total. */
export function isPestFilterActive(pestKeys: string[]): boolean {
  return pestKeys.length > 0
}

/* ------------------------------------------------------------------ */
/* Comparacao com a janela anterior                                    */
/* ------------------------------------------------------------------ */

/**
 * Compara dois periodos de mesma duracao. Devolve `null` na variacao quando o
 * periodo anterior nao temSerie, para nao mostrar "cresceu 100%" a partir de um
 * zero absoluto.
 */
export interface Variation {
  current: number
  previous: number
  /** `null` quando nao ha periodo anterior com dado suficiente. */
  percent: number | null
  direction: 'up' | 'down' | 'flat' | 'unknown'
}

export function variation(current: number, previous: number, previousHasData: boolean): Variation {
  if (!previousHasData || previous === 0) {
    return { current, previous, percent: null, direction: 'unknown' }
  }
  const percent = ((current - previous) / previous) * 100
  return {
    current,
    previous,
    percent,
    direction: percent > 0.5 ? 'up' : percent < -0.5 ? 'down' : 'flat',
  }
}

/** Desloca o periodo corrente para tras, com a mesma duracao e sem sobrepor. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  void to
  const length = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  ) + 1
  return { from: shiftDay(from, -length), to: shiftDay(from, -1) }
}

function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* Indicadores                                                       */
/* ------------------------------------------------------------------ */

export type KpiTone = 'green' | 'yellow' | 'blue' | 'red' | 'neutral'

export interface Kpi {
  id: string
  label: string
  /** `null` quando o arquivo de origem nao traz o dado. */
  value: string | null
  note: string
  tone: KpiTone
  severity: Severity
  delta?: Variation
}

const toneForSeverity = (severity: Severity): KpiTone => {
  switch (severity) {
    case 'critical':
      return 'red'
    case 'high':
    case 'medium':
      return 'yellow'
    case 'ok':
      return 'green'
    case 'low':
      return 'blue'
    case 'unknown':
      return 'neutral'
  }
}

export interface KpiInput {
  rows: TrapSeriesRow[]
  previousRows: TrapSeriesRow[]
  pestKeys: string[]
  groups: PestGroup[]
  /** Cultura de referencia dos limiares; `null` quando nao ha cultura definida. */
  trapCulture: string | null
  captures: number
  images: number
  divergentEvents: number
}

/** Soma de deteccoes por praga em uma janela ja filtrada. */
export function detectionsByPest(rows: TrapSeriesRow[], pestKeys: string[] = []) {
  const totals = new Map<string, { pestKey: string; pestName: string; detections: number; captures: number; confidence: number[] }>()

  for (const row of rows) {
    for (const pest of row.pests) {
      const entry = totals.get(pest.pestKey) ?? {
        pestKey: pest.pestKey,
        pestName: pest.pestName,
        detections: 0,
        captures: 0,
        confidence: [],
      }
      entry.detections += pest.detections
      entry.captures += pest.captures
      if (pest.meanConfidence !== null) entry.confidence.push(pest.meanConfidence)
      totals.set(pest.pestKey, entry)
    }
  }

  return [...totals.values()]
    .filter((entry) => (pestKeys.length === 0 ? true : pestKeys.includes(entry.pestKey)))
    .map((entry) => ({
      ...entry,
      meanConfidence:
        entry.confidence.length > 0
          ? entry.confidence.reduce((sum, value) => sum + value, 0) / entry.confidence.length
          : null,
    }))
    .sort((a, b) => b.detections - a.detections)
}

/** Indicadores da Visao Geral. `days` entra pelo periodo ja resolvido. */
export function buildKpis(input: KpiInput): Kpi[] {
  const { rows, previousRows, pestKeys, groups, captures, images, divergentEvents, trapCulture } = input

  const counts = countSeries(rows, pestKeys)
  const previousCounts = countSeries(previousRows, pestKeys)

  const detectionsDelta = variation(counts.detections, previousCounts.detections, previousRows.length > 0)
  const capturesDelta = variation(counts.captures, previousCounts.captures, previousRows.length > 0)

  const byPest = detectionsByPest(rows, pestKeys)
  const worst = evaluateWorstPest(byPest, groups, trapCulture)

  const battery = batteryHealth(rows)

  return [
    {
      id: 'detections',
      label: 'Deteccoes no periodo',
      value: counts.detections.toLocaleString('pt-BR'),
      note:
        counts.detections === 0
          ? 'Nenhuma caixa detectada no periodo selecionado.'
          : `${counts.pestKeys.length} praga(s) em ${counts.traps} armadilha(s)`,
      tone: worst ? toneForSeverity(worst.severity) : 'neutral',
      severity: worst?.severity ?? 'unknown',
      delta: detectionsDelta,
    },
    {
      id: 'pests-at-level',
      label: 'Pragas em nivel de alerta',
      value: worst === null ? null : String(worst.aboveAlert),
      note:
        worst === null
          ? 'Nenhuma praga com contagem acima do limiar de alert.'
          : worst.aboveAlert === 0
            ? 'Nenhuma praga passou do limiar de alert.'
            : `${worst.names.join(', ')}`,
      tone: worst && worst.aboveAlert > 0 ? toneForSeverity(worst.severity) : 'green',
      severity: worst && worst.aboveAlert > 0 ? worst.severity : 'ok',
    },
    {
      id: 'captures',
      label: 'Capturas de imagem',
      value: captures.toLocaleString('pt-BR'),
      note: `${images.toLocaleString('pt-BR')} evento(s) com imagem no arquivo`,
      tone: 'blue',
      severity: 'low',
      delta: capturesDelta,
    },
    {
      id: 'trap-coverage',
      label: 'Armadilhas ativas',
      value: `${counts.traps}`,
      note: `de ${new Set(rows.length > 0 ? rows.map((row) => row.trapCode) : []).size} com dado no periodo`,
      tone: counts.traps === 0 ? 'neutral' : 'green',
      severity: counts.traps === 0 ? 'unknown' : 'ok',
    },
    {
      id: 'battery',
      label: 'Bateria das armadilhas',
      value: battery.mean === null ? null : `${battery.mean.toFixed(2)} V`,
      note:
        battery.mean === null
          ? 'traps_events.csv nao tem leitura de bateria no periodo.'
          : battery.lowest === null
            ? 'sem leitura de bateria asociada'
            : `menor leitura ${battery.lowest.toFixed(2)} V`,
      tone: battery.severity === 'unknown' ? 'neutral' : toneForSeverity(battery.severity),
      severity: battery.severity,
    },
    {
      id: 'count-agreement',
      label: 'pestCount x caixas',
      value: divergentEvents === 0 ? 'Confere' : `${divergentEvents} divergem`,
      note:
        divergentEvents === 0
          ? 'pestCount bate com a soma das caixas em todos os eventos.'
          : 'Eventos onde pestCount e a soma das caixas nao batem.',
      tone: divergentEvents === 0 ? 'green' : 'yellow',
      severity: divergentEvents === 0 ? 'ok' : 'medium',
    },
  ]
}

export interface WorstPestSummary {
  severity: Severity
  aboveAlert: number
  names: string[]
  level: AlertLevel
}

/** Praga com o nivel mais severo dentro da janela. */
export function evaluateWorstPest(
  byPest: { pestKey: string; pestName: string; detections: number }[],
  groups: PestGroup[],
  trapCulture: string | null,
): WorstPestSummary | null {
  const groupByKey = new Map(groups.map((group) => [group.key, group]))

  let worst: (WorstPestSummary & { rank: number }) | null = null

  for (const pest of byPest) {
    const group = groupByKey.get(pest.pestKey)
    const status = evaluatePestDay({
      day: '',
      pestKey: pest.pestKey,
      pestName: pest.pestName,
      detections: pest.detections,
      captures: 0,
      meanConfidence: null,
      group,
      trapCulture,
    })
    if (status.level === 'below' || status.thresholdsMissing) continue
    const rank = severityRankFor(status.severity)
    if (!worst || rank > worst.rank) {
      worst = {
        rank,
        severity: status.severity,
        aboveAlert: 1,
        names: [pest.pestName],
        level: status.level,
      }
    } else if (rank === worst.rank) {
      worst.aboveAlert += 1
      worst.names.push(pest.pestName)
    }
  }

  return worst
}

function severityRankFor(severity: Severity): number {
  const order: Record<Severity, number> = { unknown: -1, ok: 0, low: 1, medium: 2, high: 3, critical: 4 }
  return order[severity]
}

/**
 * Cultura de referencia para aplicar limiares de praga.
 *
 * A serie diaria nao repete a cultura e nao existe arquivo de cobertura por
 * talhao, entao usamos a cultura declarada em `traps_data.csv` para as
 * armadilhas selecionadas. Devolvemos `null` quando nao ha cultura alguma ou
 * quando ha empate entre culturas diferentes: nesse caso a interface mostra a
 * praga sem severidade em vez de escolher uma cultura por acaso.
 */
export function resolveCulture(traps: Trap[], trapCodes: string[]): string | null {
  const selected = trapCodes.length > 0 ? traps.filter((trap) => trapCodes.includes(trap.trapCode)) : traps
  const counts = new Map<string, number>()

  for (const trap of selected) {
    for (const culture of trap.cultures) counts.set(culture, (counts.get(culture) ?? 0) + 1)
  }

  if (counts.size === 0) return null

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [topCulture, topCount] = ranked[0]
  const tied = ranked.filter(([, count]) => count === topCount)

  return tied.length > 1 ? null : topCulture
}

/** Leitura de bateria: media e menor valor por armadilha/dia. */
export function batteryHealth(rows: TrapSeriesRow[]): {
  mean: number | null
  lowest: number | null
  severity: Severity
} {
  const values = rows
    .map((row) => row.batteryVoltageMean)
    .filter((value): value is number => value !== null)

  if (values.length === 0) return { mean: null, lowest: null, severity: 'unknown' }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const lowest = Math.min(...values)

  // Nao ha tensao minima oficial nos arquivos: sinalizamos apenas a queda
  // relativa dentro do proprio conjunto, sem chamar de "bateria fraca".
  const spread = mean - lowest
  if (spread > 0.5) return { mean, lowest, severity: 'medium' }
  return { mean, lowest, severity: 'ok' }
}

/* ------------------------------------------------------------------ */
/* Distribuicao por praga e por armadilha                              */
/* ------------------------------------------------------------------ */

export interface PestDistributionRow {
  pestKey: string
  pestName: string
  detections: number
  captures: number
  meanConfidence: number | null
  level: AlertLevel
  severity: Severity
  levelLabel: string
  thresholds: { alert: number | null; control: number | null; damage: number | null }
  culture: string | null
  cultureMismatch: boolean
  note: string
}

export function pestDistribution(
  byPest: { pestKey: string; pestName: string; detections: number; captures: number; meanConfidence: number | null }[],
  groups: PestGroup[],
  trapCulture: string | null,
): PestDistributionRow[] {
  const groupByKey = new Map(groups.map((group) => [group.key, group]))

  return byPest.map((pest) => {
    const group = groupByKey.get(pest.pestKey)
    const status = evaluatePestDay({
      day: '',
      pestKey: pest.pestKey,
      pestName: pest.pestName,
      detections: pest.detections,
      captures: pest.captures,
      meanConfidence: pest.meanConfidence,
      group,
      trapCulture,
    })
    const decision = group ? resolveVariant(group, trapCulture) : null

    return {
      pestKey: pest.pestKey,
      pestName: pest.pestName,
      detections: pest.detections,
      captures: pest.captures,
      meanConfidence: pest.meanConfidence,
      level: status.level,
      severity: status.severity,
      levelLabel: status.levelLabel,
      thresholds: decision?.variant.thresholds ?? { alert: null, control: null, damage: null },
      culture: decision?.variant.culture ?? null,
      cultureMismatch: status.cultureMismatch,
      note: status.note,
    }
  })
}

export interface TrapRankingRow {
  trapCode: string
  trapType: string | null
  detections: number
  captures: number
  days: number
  meanPerDay: number
  topPest: string | null
  topPestCount: number
  level: AlertLevel
  severity: Severity
}

export function trapRanking(
  rows: TrapSeriesRow[],
  groups: PestGroup[],
  trapCulture: string | null,
): TrapRankingRow[] {
  const groupByKey = new Map(groups.map((group) => [group.key, group]))
  const byTrap = new Map<string, TrapSeriesRow[]>()

  for (const row of rows) {
    const list = byTrap.get(row.trapCode) ?? []
    list.push(row)
    byTrap.set(row.trapCode, list)
  }

  return [...byTrap.entries()]
    .map(([trapCode, trapRows]) => {
      const detections = trapRows.reduce((sum, row) => sum + row.detections, 0)
      const captures = trapRows.reduce((sum, row) => sum + row.captures, 0)
      const pests = detectionsByPest(trapRows)

      return {
        trapCode,
        trapType: trapRows[0]?.trapType ?? null,
        detections,
        captures,
        days: trapRows.length,
        meanPerDay: trapRows.length > 0 ? detections / trapRows.length : 0,
        topPest: pests[0]?.pestName ?? null,
        topPestCount: pests[0]?.detections ?? 0,
        level: 'below' as AlertLevel,
        severity: evaluateTrapSeverity(pests, groupByKey, trapCulture),
      }
    })
    .sort((a, b) => b.detections - a.detections)
}

/**
 * Severidade da armadilha = pior praga dela na janela.
 *
 * Comeca em `unknown`, nao em `ok`: uma armadilha cujas pragas nao tem
 * limiar cadastrado nao pode aparecer como "estava tudo bem", e a ausencia de
 * informacao precisa ser visivel na interface.
 */
function evaluateTrapSeverity(
  pests: { pestKey: string; pestName: string; detections: number }[],
  groupByKey: Map<string, PestGroup>,
  trapCulture: string | null,
): Severity {
  let severity: Severity = 'unknown'
  for (const pest of pests) {
    const status = evaluatePestDay({
      day: '',
      pestKey: pest.pestKey,
      pestName: pest.pestName,
      detections: pest.detections,
      captures: 0,
      meanConfidence: null,
      group: groupByKey.get(pest.pestKey),
      trapCulture,
    })
    if (severityRankFor(status.severity) > severityRankFor(severity)) severity = status.severity
  }
  return severity
}

/* ------------------------------------------------------------------ */
/* Serie temporal para graficos                                        */
/* ------------------------------------------------------------------ */

export interface DailyPoint {
  day: string
  detections: number
  captures: number
  pests: { pestKey: string; detections: number }[]
}

export function dailySeries(rows: TrapSeriesRow[], days: string[], pestKeys: string[] = []): DailyPoint[] {
  const byDay = new Map<string, TrapSeriesRow[]>()
  for (const row of rows) {
    const list = byDay.get(row.day) ?? []
    list.push(row)
    byDay.set(row.day, list)
  }

  return days.map((day) => {
    const dayRows = byDay.get(day) ?? []
    const pests = detectionsByPest(dayRows, pestKeys).map((pest) => ({
      pestKey: pest.pestKey,
      detections: pest.detections,
    }))
    return {
      day,
      detections: dayRows.reduce((sum, row) => sum + sumPestDetections(row.pests, pestKeys), 0),
      captures: dayRows.reduce((sum, row) => sum + row.captures, 0),
      pests,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Prova em tres camadas                                              */
/* ------------------------------------------------------------------ */

export type EvidenceLayerId = 'captura' | 'contagem' | 'contexto'

export interface EvidenceLayer {
  id: EvidenceLayerId
  label: string
  summary: string
  severity: Severity
  /** `false` quando o dado necessario para a camada nao existe. */
  available: boolean
  detail: string
}

export interface PestEvidence {
  pestKey: string
  pestName: string
  layer: EvidenceLayerId
  severity: Severity
  title: string
  layers: EvidenceLayer[]
}

/**
 * Monta a prova em tres camadas de um alerta de praga:
 * 1. captura — existe foto da armadilha no periodo;
 * 2. contagem — as caixas passam do limiar de pest_list.csv;
 * 3. contexto — clima, operacoes e alertas de maquina proximos no tempo.
 *
 * Cada camada declara se esta disponivel, para que a interface nunca apresente
 * uma camada ausente como se estivesse vazia.
 */
export function buildEvidence(input: {
  days: string[]
  byPest: { pestKey: string; pestName: string; detections: number; captures: number }[]
  groups: PestGroup[]
  trapCulture: string | null
  climate: ClimateDay[]
  operations: { day: string; operation: string; serviceOrder: string }[]
  machineAlertDays: Map<string, number>
  pestKeys: string[]
}): PestEvidence[] {
  const { byPest, groups, trapCulture, climate, operations, machineAlertDays, pestKeys } = input
  const groupByKey = new Map(groups.map((group) => [group.key, group]))

  const climateByDay = new Map(climate.map((day) => [day.day, day]))
  const operationsByDay = new Map<string, { day: string; operation: string; serviceOrder: string }[]>()
  for (const operation of operations) {
    const list = operationsByDay.get(operation.day) ?? []
    list.push(operation)
    operationsByDay.set(operation.day, list)
  }

  return byPest
    .filter((pest) => (pestKeys.length === 0 ? true : pestKeys.includes(pest.pestKey)))
    .map((pest) => {
      const status = evaluatePestDay({
        day: '',
        pestKey: pest.pestKey,
        pestName: pest.pestName,
        detections: pest.detections,
        captures: pest.captures,
        meanConfidence: null,
        group: groupByKey.get(pest.pestKey),
        trapCulture,
      })

      const captureLayer: EvidenceLayer = {
        id: 'captura',
        label: 'Captura',
        summary: pest.captures === 0 ? 'Sem captura' : `${pest.captures} captura(s)`,
        severity: pest.captures === 0 ? 'unknown' : 'ok',
        available: pest.captures > 0,
        detail:
          pest.captures > 0
            ? 'As caixas vem de eventos IMAGE, que sao a unica fonte de contagem aceita.'
            : 'traps_events.csv nao tem evento IMAGE associado a estas caixas.',
      }

      const countLayer: EvidenceLayer = {
        id: 'contagem',
        label: 'Contagem',
        summary: `${pest.detections} caixa(s) — ${status.levelLabel}`,
        severity: status.severity,
        available: !status.thresholdsMissing,
        detail: [
          status.thresholdSummary ? `Variante usada: ${status.thresholdSummary}.` : null,
          status.note,
        ]
          .filter((part): part is string => part !== null)
          .join(' '),
      }

      const climateInPeriod = input.days
        .map((day) => climateByDay.get(day))
        .filter((day): day is ClimateDay => day !== undefined)
      const rainyDays = climateInPeriod.filter((day) => day.precipitation > 0).length
      const operationsInPeriod = input.days.flatMap((day) => operationsByDay.get(day) ?? [])
      const alertsInPeriod = input.days.reduce((sum, day) => sum + (machineAlertDays.get(day) ?? 0), 0)

      const contextParts: string[] = []
      if (climateInPeriod.length === 0) {
        contextParts.push('Sem serie climatica cobrindo o periodo.')
      } else {
        contextParts.push(
          `${rainyDays} de ${climateInPeriod.length} dia(s) com chuva (max ${Math.max(...climateInPeriod.map((day) => day.temperatureMax ?? 0)).toFixed(1)} °C).`,
        )
      }
      contextParts.push(
        operationsInPeriod.length === 0
          ? 'Nenhuma operacao de maquina no periodo.'
          : `Operacoes: ${operationsInPeriod.map((operation) => `${operation.operation} (OS ${operation.serviceOrder})`).join(', ')}.`,
      )
      contextParts.push(alertsInPeriod === 0 ? 'Nenhum alerta de maquina no periodo.' : `${alertsInPeriod} alerta(s) de maquina no periodo.`)

      const contextLayer: EvidenceLayer = {
        id: 'contexto',
        label: 'Contexto',
        summary: climateInPeriod.length === 0 ? 'Sem contexto' : `${climateInPeriod.length} dia(s) com clima`,
        severity: 'low',
        available: climateInPeriod.length > 0,
        detail: contextParts.join(' '),
      }

      const layers = [captureLayer, countLayer, contextLayer]
      const severity = layers.reduce<Severity>(
        (worst, entry) => (severityRankFor(entry.severity) > severityRankFor(worst) ? entry.severity : worst),
        'unknown',
      )
      const firstAvailable = layers.findIndex((entry) => entry.available)

      return {
        pestKey: pest.pestKey,
        pestName: pest.pestName,
        layer: layers[Math.max(0, firstAvailable)].id,
        severity,
        title: `${pest.pestName}: ${pest.detections} caixa(s) em ${pest.captures} captura(s)`,
        layers,
      }
    })
    .filter((evidence) => evidence.severity === 'critical' || evidence.severity === 'high' || evidence.severity === 'medium')
    .sort((a, b) => severityRankFor(b.severity) - severityRankFor(a.severity))
}

/* ------------------------------------------------------------------ */
/* Anomalia descritiva (P1)                                           */
/* ------------------------------------------------------------------ */

export interface Anomaly {
  id: string
  trapCode: string
  day: string
  pestName: string
  kind: 'pico' | 'ausencia' | 'confianca'
  description: string
  severity: Severity
}

/**
 * Deteccao descritiva de anomalias, sem modelo: compara cada dia com a media e
 * o desvio da propria armadilha e marca tres situacoes que o plano pede.
 * Nao estima praga futura nem risco — apenas aponta o que fugiu do padrao.
 */
export function detectAnomalies(rows: TrapSeriesRow[]): Anomaly[] {
  const byTrap = new Map<string, TrapSeriesRow[]>()
  for (const row of rows) {
    const list = byTrap.get(row.trapCode) ?? []
    list.push(row)
    byTrap.set(row.trapCode, list)
  }

  const anomalies: Anomaly[] = []

  for (const [trapCode, trapRows] of byTrap) {
    if (trapRows.length < 4) continue

    // 1. Pico: mais de dois desvios acima da media da propria armadilha, com
    //    minimo de 10 caixas para nao reagir a ruido de contagem baixa.
    const total = trapRows.reduce((sum, row) => sum + row.detections, 0)
    const mean = total / trapRows.length
    const deviation = standardDeviation(trapRows.map((row) => row.detections))

    if (mean > 0 && deviation > 0) {
      for (const row of trapRows) {
        const z = (row.detections - mean) / deviation
        if (z < 2 || row.detections < 10) continue
        const top = [...row.pests].sort((a, b) => b.detections - a.detections)[0]
        anomalies.push({
          id: `pico-${trapCode}-${row.day}`,
          trapCode,
          day: row.day,
          pestName: top?.pestName ?? '—',
          kind: 'pico',
          description: `${row.detections} caixas contra media de ${mean.toFixed(1)} por dia na mesma armadilha (${z.toFixed(1)} desvios).`,
          severity: z >= 3 ? 'high' : 'medium',
        })
      }
    }

    // 2. Ausencia: dia sem captura quando a armadilha costuma capturar.
    const captureDays = trapRows.filter((row) => row.captures > 0).length
    if (captureDays >= trapRows.length * 0.6) {
      for (const row of trapRows) {
        if (row.captures === 0) {
          anomalies.push({
            id: `ausencia-${trapCode}-${row.day}`,
            trapCode,
            day: row.day,
            pestName: '—',
            kind: 'ausencia',
            description: `Sem captura em um dia em que a armadilha captura em ${captureDays} de ${trapRows.length} dias.`,
            severity: 'medium',
          })
        }
      }
    }

    // 3. Confianca: caixas com confianca media abaixo de 60% pedem revisao.
    for (const row of trapRows) {
      if (row.pests.length === 0) continue
      const lowest = row.pests.reduce<number | null>(
        (min, pest) =>
          pest.meanConfidence !== null && (min === null || pest.meanConfidence < min)
            ? pest.meanConfidence
            : min,
        null,
      )
      if (lowest === null || lowest >= 0.6) continue
      const top = [...row.pests].sort((a, b) => (a.meanConfidence ?? 1) - (b.meanConfidence ?? 1))[0]
      anomalies.push({
        id: `confianca-${trapCode}-${row.day}-${top.pestKey}`,
        trapCode,
        day: row.day,
        pestName: top.pestName,
        kind: 'confianca',
        description: `Confianca media de ${(lowest * 100).toFixed(0)}% na deteccao de ${top.pestName}; abaixo de 60% a identification pede revisao.`,
        severity: 'low',
      })
    }
  }

  return anomalies.sort((a, b) => severityRankFor(b.severity) - severityRankFor(a.severity))
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/* ------------------------------------------------------------------ */
/* Series de clima e derivados                                        */
/* ------------------------------------------------------------------ */

export interface ClimateContext {
  days: ClimateDay[]
  totalPrecipitation: number
  totalEvapotranspiration: number
  waterBalance: number
  meanTemperature: number | null
  maxTemperature: number | null
  maxWindGust: number | null
  meanHumidity: number | null
  /** Dias com chuva, no mesmo periodo. */
  rainyDays: number
  missingHours: number
}

export function climateContext(climate: ClimateDay[], from: string, to: string): ClimateContext {
  const days = climate.filter((day) => day.day >= from && day.day <= to)

  const totalPrecipitation = days.reduce((sum, day) => sum + day.precipitation, 0)
  const totalEvapotranspiration = days.reduce((sum, day) => sum + day.evapotranspiration, 0)
  const temperatures = days.map((day) => day.temperatureMean).filter((value): value is number => value !== null)
  const humidities = days.map((day) => day.humidityMean).filter((value): value is number => value !== null)
  const gusts = days.map((day) => day.windGust).filter((value): value is number => value !== null)
  const maxima = days.map((day) => day.temperatureMax).filter((value): value is number => value !== null)

  return {
    days,
    totalPrecipitation,
    totalEvapotranspiration,
    waterBalance: totalPrecipitation - totalEvapotranspiration,
    meanTemperature: temperatures.length > 0 ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : null,
    maxTemperature: maxima.length > 0 ? Math.max(...maxima) : null,
    maxWindGust: gusts.length > 0 ? Math.max(...gusts) : null,
    meanHumidity: humidities.length > 0 ? humidities.reduce((sum, value) => sum + value, 0) / humidities.length : null,
    rainyDays: days.filter((day) => day.precipitation > 0).length,
    missingHours: days.reduce((sum, day) => sum + day.missingHours, 0),
  }
}

/* ------------------------------------------------------------------ */
/* Armadilhas                                                         */
/* ------------------------------------------------------------------ */

export interface TrapWithLoad {
  trap: Trap
  detections: number
  captures: number
  days: number
  severity: Severity
  topPest: string | null
}

/** Junta o cadastro com o que a janela filtrada tem para cada armadilha. */
export function trapsWithLoad(traps: Trap[], rows: TrapSeriesRow[], groups: PestGroup[], trapCulture: string | null): TrapWithLoad[] {
  const ranking = new Map(trapRanking(rows, groups, trapCulture).map((row) => [row.trapCode, row]))

  return traps.map((trap) => {
    const row = ranking.get(trap.trapCode)
    return {
      trap,
      detections: row?.detections ?? 0,
      captures: row?.captures ?? 0,
      days: row?.days ?? 0,
      severity: row?.severity ?? 'unknown',
      topPest: row?.topPest ?? null,
    }
  })
}