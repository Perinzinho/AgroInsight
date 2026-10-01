import type { PestGroup, PestVariant } from './types'
import type { Severity } from '../core/theme/colors'

/**
 * Motor de alertas.
 *
 * Regras deliberadamente simples e declarativas: o limiar vem de
 * `pest_list.csv` (por praga e cultura), a severidade sai da posicao em relacao
 * aos tres limiares e a acao vem da praga mais tudo que o arquivo permite
 * afirmar. Nada aqui estima dano, risco climatico nem resultado de safra: o que
 * o dado nao sustenta fica marcado como pendencia.
 */

export const LEVELS = ['below', 'alert', 'control', 'damage'] as const
export type AlertLevel = (typeof LEVELS)[number]

export const LEVEL_LABEL: Record<AlertLevel, string> = {
  below: 'Abaixo do limiar',
  alert: 'No limiar de alerta',
  control: 'No limiar de controle',
  damage: 'Acima da referencia de dano',
}

export const LEVEL_SEVERITY: Record<AlertLevel, Severity> = {
  below: 'ok',
  alert: 'medium',
  control: 'high',
  damage: 'critical',
}

/** Faixas semanticas do clima, derivadas dos campos que existem no arquivo. */
export const CLIMATE_BANDS = [
  { id: 'frost', label: 'Geada', test: (v: number) => v <= 0 },
  { id: 'cold', label: 'Frio', test: (v: number) => v > 0 && v < 10 },
  { id: 'mild', label: 'Agradavel', test: (v: number) => v >= 10 && v <= 30 },
  { id: 'hot', label: 'Calor', test: (v: number) => v > 30 && v <= 38 },
  { id: 'very-hot', label: 'Calor intenso', test: (v: number) => v > 38 },
] as const

export type ClimateBandId = (typeof CLIMATE_BANDS)[number]['id']

export function climateBand(temperature: number): ClimateBandId {
  return CLIMATE_BANDS.find((band) => band.test(temperature))?.id ?? 'mild'
}

export function climateBandLabel(temperature: number): string {
  const band = CLIMATE_BANDS.find((candidate) => candidate.test(temperature))
  return band ? band.label : 'Sem faixa'
}

/** Umidade relativa do ar em faixas de confortabilidade para o ciclo da planta. */
export const HUMIDITY_BANDS = [
  { id: 'very-dry', label: 'Muito seca', max: 30 },
  { id: 'dry', label: 'Seca', max: 50 },
  { id: 'ideal', label: 'Adequada', max: 80 },
  { id: 'humid', label: 'Umida', max: 90 },
  { id: 'very-humid', label: 'Muito umida', max: Infinity },
] as const

export type HumidityBandId = (typeof HUMIDITY_BANDS)[number]['id']

export function humidityBand(humidity: number): HumidityBandId {
  return HUMIDITY_BANDS.find((band) => humidity <= band.max)?.id ?? 'ideal'
}

/**
 * Nivel de uma contagem de deteccoes contra os limiares da praga.
 *
 * Os limiares sao comparados na ordem `damage > control > alert`: o primeiro
 * que a contagem alcanca define o nivel. `null` significa que o arquivo nao
 * traz o limiar, e nesse caso devolvemos `below` com `thresholdsMissing: true`
 * para que a interface possa avisar em vez de fingir que o nivel e zero.
 */
export interface LevelResult {
  level: AlertLevel
  severity: Severity
  label: string
  /** Limiar que a contagem alcancou, ou `null` se nenhum. */
  threshold: number | null
  /** Proximo limiar ainda nao alcancado, para texto de "faltam N". */
  nextThreshold: number | null
  nextLevel: AlertLevel | null
  /** `true` quando o limiar relevante nao existe no arquivo de origem. */
  thresholdsMissing: boolean
}

export function levelFor(count: number, thresholds: PestVariant['thresholds']): LevelResult {
  const ordered = (LEVELS.slice(1) as AlertLevel[]).map((level) => ({
    level,
    value: thresholds[level],
  }))

  const reached = [...ordered].reverse().find((entry) => entry.value !== null && count >= entry.value)
  const pending = ordered.find((entry) => entry.value !== null && count < entry.value)

  const level: AlertLevel = reached?.level ?? 'below'
  const relevant = relevantThresholdsMissing(thresholds)

  return {
    level,
    severity: LEVEL_SEVERITY[level],
    label: LEVEL_LABEL[level],
    threshold: reached?.value ?? null,
    nextThreshold: pending?.value ?? null,
    nextLevel: pending?.level ?? null,
    thresholdsMissing: relevant,
  }
}

function relevantThresholdsMissing(thresholds: PestVariant['thresholds']): boolean {
  return thresholds.alert === null && thresholds.control === null && thresholds.damage === null
}

/* ------------------------------------------------------------------ */
/* Variante por cultura                                               */
/* ------------------------------------------------------------------ */

export const MILHO = 'Milho'

/**
 * Escolhe a variante do catalogo para a cultura da armadilha.
 *
 * O catalogo tem variantes por cultura e, as vezes, varias por cultura com
 * limiares diferentes. Nao existe uma regra oficial de desempate nos arquivos de
 * origem, entao avaliamos o pior caso entre as variantes e devolvemos a lista
 * completa para a interface poder mostrar a divergencia em vez de esconder-la.
 */
export interface ThresholdDecision {
  variant: PestVariant
  /** Todas as variantes da mesma praga e cultura, com seus limiares. */
  candidates: PestVariant[]
  /** `true` quando as variantes da cultura divergem entre si. */
  conflicting: boolean
}

export function resolveVariant(group: PestGroup, culture: string | null): ThresholdDecision | null {
  if (group.variants.length === 0) return null
  const cultureKey = culture ?? ''
  const forCulture = group.variants.filter((variant) => variant.culture.toLowerCase() === cultureKey.toLowerCase())
  const scope = forCulture.length > 0 ? forCulture : group.variants
  const worst = scope.reduce((worstVariant, variant) => (severityRank(variant) > severityRank(worstVariant) ? variant : worstVariant))
  return {
    variant: worst,
    candidates: scope,
    conflicting: scope.length > 1 && new Set(scope.map((variant) => signature(variant))).size > 1,
  }
}

function signature(variant: PestVariant): string {
  const { alert, control, damage } = variant.thresholds
  return `${alert}|${control}|${damage}`
}

function severityRank(variant: PestVariant): number {
  const value = variant.thresholds.damage ?? variant.thresholds.control ?? variant.thresholds.alert ?? 0
  return Number.isFinite(value) ? value : 0
}

/* ------------------------------------------------------------------ */
/* Serie diaria por praga                                             */
/* ------------------------------------------------------------------ */

export interface DayPestStatus {
  day: string
  pestKey: string
  pestName: string
  culture: string | null
  /** Soma das caixas detectadas no dia. */
  detections: number
  captures: number
  meanConfidence: number | null
  level: AlertLevel
  severity: Severity
  levelLabel: string
  threshold: number | null
  nextThreshold: number | null
  nextLevel: AlertLevel | null
  thresholdsMissing: boolean
  /**
   * Variante efetivamente usada, como `Milho: 5/15/30`.
   * A interface mostra esse texto para que o limiar da tela possa ser conferido
   * contra `pest_list.csv`, em vez de ser apenas uma cor.
   */
  thresholdSummary: string | null
  /** `true` quando o catalogo traz mais de um limiar para a cultura. */
  variantsConflicting: boolean
  /** Motivo em texto para o card, sem leitura de campo. */
  note: string
  /** `true` quando a cultura da armadilha nao tem variante na praga. */
  cultureMismatch: boolean
}

/**
 * Avalia uma serie diaria de uma praga contra os limiares da cultura da
 * armadilha. `trapCulture` vem de `traps_data.csv`; quando a praga nao tem
 * variante para ela, usamos a variante de milho e marcamos `cultureMismatch`.
 */
export function evaluatePestDay(args: {
  day: string
  pestKey: string
  pestName: string
  detections: number
  captures: number
  meanConfidence: number | null
  group: PestGroup | undefined
  trapCulture: string | null
}): DayPestStatus {
  const { day, pestKey, pestName, detections, captures, meanConfidence, group, trapCulture } = args

  if (!group) {
    return {
      day,
      pestKey,
      pestName,
      culture: trapCulture,
      detections,
      captures,
      meanConfidence,
      level: 'below',
      severity: 'unknown',
      levelLabel: 'Sem limiar cadastrado',
      threshold: null,
      nextThreshold: null,
      nextLevel: null,
      thresholdsMissing: true,
      thresholdSummary: null,
      variantsConflicting: false,
      note: 'A praga nao tem entrada em pest_list.csv, entao nenhum limiar pode ser aplicado.',
      cultureMismatch: false,
    }
  }

  const decision = resolveVariant(group, trapCulture)
  if (!decision) {
    return {
      day,
      pestKey,
      pestName,
      culture: trapCulture,
      detections,
      captures,
      meanConfidence,
      level: 'below',
      severity: 'unknown',
      levelLabel: 'Sem limiar cadastrado',
      threshold: null,
      nextThreshold: null,
      nextLevel: null,
      thresholdsMissing: true,
      thresholdSummary: null,
      variantsConflicting: false,
      note: 'A praga nao tem variantes de limiar em pest_list.csv.',
      cultureMismatch: false,
    }
  }

  const result = levelFor(detections, decision.variant.thresholds)
  const cultureMismatch = !decision.candidates.some((variant) => variant.culture === trapCulture)

  const note = buildNote({ result, detections, decision, cultureMismatch, captures })

  return {
    day,
    pestKey,
    pestName,
    culture: decision.variant.culture,
    detections,
    captures,
    meanConfidence,
    level: result.level,
    severity: result.severity,
    levelLabel: result.label,
    threshold: result.threshold,
    nextThreshold: result.nextThreshold,
    nextLevel: result.nextLevel,
    thresholdsMissing: result.thresholdsMissing,
    thresholdSummary: `${decision.variant.culture}: ${describeThresholds(decision.variant)}`,
    variantsConflicting: decision.conflicting,
    note,
    cultureMismatch,
  }
}

function buildNote(args: {
  result: LevelResult
  detections: number
  decision: ThresholdDecision
  cultureMismatch: boolean
  captures: number
}): string {
  const { result, detections, decision, cultureMismatch, captures } = args
  const parts: string[] = []

  if (result.thresholdsMissing) {
    parts.push('pest_list.csv nao traz limiar para esta praga; a contagem aparece sem severidade.')
  } else if (result.nextThreshold !== null) {
    const faltam = result.nextThreshold - detections
    const proximo = LEVEL_LABEL[result.nextLevel ?? 'alert'].toLowerCase()
    parts.push(`Faltam ${faltam} para ${proximo}.`)
  } else {
    parts.push('Todos os limiares de pest_list.csv foram alcancados.')
  }

  if (decision.conflicting) {
    const list = decision.candidates
      .map((candidate) => `${candidate.culture}: ${describeThresholds(candidate)}`)
      .join(' | ')
    const chosen = `${decision.variant.culture}: ${describeThresholds(decision.variant)}`
    parts.push(
      `O catalogo traz ${decision.candidates.length} limiares divergentes (${list}) e usamos o mais alto, "${chosen}".`,
    )
  }
  if (cultureMismatch) {
    parts.push(
      `A armadilha informa a cultura "${decision.variant.culture}" porque nao ha variante cadastrada para a cultura informada na leitura.`,
    )
  }
  if (captures === 0 && detections > 0) {
    parts.push('As caixas vieram de registros sem captura associada.')
  }

  return parts.join(' ')
}

/** `alerta/controle/dano`, com os limiares ausentes marcados como "-". */
export function describeThresholds(variant: PestVariant): string {
  const { alert, control, damage } = variant.thresholds
  return `${alert ?? '-'}/${control ?? '-'}/${damage ?? '-'}`
}