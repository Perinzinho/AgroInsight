import { beforeAll, describe, expect, it } from 'vitest'
import type { Dataset, Filters } from '../../src/shared/agroContracts'
import { countSeries, filterSeries, variation } from '../../src/data/selectors'
import { toLocalDayKey } from '../../scripts/lib/parse.mjs'
import { EvidenceRegistry } from '../data/evidenceRegistry'
import { createQueries } from '../ai/queries'
import { datasetSchema, warningSeveritySchema } from '../data/schemas'
import { loadData, readRaw } from './helpers'

let data: Dataset
const filters: Filters = { from: '2025-08-22', to: '2026-02-25', trapCodes: [], pestKeys: [] }
const query = (f = filters, d = data) => createQueries(d, f, new EvidenceRegistry())
beforeAll(async () => { data = await loadData() })

describe('consultas sobre os JSONs reais', () => {
  it('valida o snapshot inteiro e normaliza severidades conhecidas', async () => {
    expect(data.manifest.warnings.every((w) => ['info', 'atencao', 'critico'].includes(w.severity))).toBe(true)
    expect(warningSeveritySchema.parse('attention')).toBe('atencao')
    expect(warningSeveritySchema.parse('critical')).toBe('critico')
    expect(warningSeveritySchema.safeParse('invented').success).toBe(false)
    const manifest = await readRaw('manifest.json')
    expect(datasetSchema.safeParse({ ...data, manifest: { ...manifest, generatedAt: 'bad' } }).success).toBe(false)
    expect(datasetSchema.safeParse({ ...data, climate: { ...data.climate, days: [{ ...data.climate.days[0], precipitation: null }] } }).success).toBe(false)
  })
  it('iguala contagens aos seletores sem incluir telemetria', () => {
    const result = query().consultarPragas()
    expect(result.counts).toEqual(countSeries(filterSeries({ rows: data.series.rows, filters })))
    expect(result.counts.detections).toBe(data.events.totalDetections)
    expect(result.counts.captures).toBe(data.events.totalCaptures)
    expect(result.daily.total).toBeGreaterThan(result.daily.items.length)
    expect(result.daily.truncated).toBe(true)
  })
  it('recalcula praga e armadilha sem restringir clima', () => {
    const row = data.series.rows.find((r) => r.captures > 0 && r.pests.length > 1)!
    const f = { ...filters, from: row.day, to: row.day, trapCodes: [row.trapCode], pestKeys: [row.pests[0].pestKey] }
    const result = query(f).consultarPragas()
    expect(result.counts).toEqual(countSeries(filterSeries({ rows: data.series.rows, filters: f }), f.pestKeys))
    expect(result.byPest.items.every((p) => p.pestKey === f.pestKeys[0])).toBe(true)
    expect(result.ranking.items.every((r) => r.trapCode === row.trapCode)).toBe(true)
    expect(query(f).consultarClima().evidence).toEqual(query({ ...f, trapCodes: [], pestKeys: [] }).consultarClima().evidence)
  })
  it('não transforma período sem cobertura em zero medido', () => {
    const q = query({ ...filters, from: '1900-01-01', to: '1900-01-07' })
    expect(q.consultarPragas().status).toBe('no_coverage')
    expect(q.consultarPragas().evidence.find((e) => e.id === 'pests-detections')?.value).toBeNull()
    expect(q.consultarClima().status).toBe('no_coverage')
    expect(q.consultarClima().evidence.find((e) => e.id === 'climate-rain')?.value).toBeNull()
    expect(q.consultarAlertasMaquina().status).toBe('no_coverage')
  })
  it('diferencia zero medido de ausência de registro dentro da cobertura', () => {
    const day = data.climate.days[0]
    const d = { ...data, climate: { ...data.climate, days: [{ ...day, precipitation: 0, hours: 24, missingHours: 0 }] } }
    expect(query({ ...filters, from: day.day, to: day.day }, d).consultarClima().evidence[0].value).toBe(0)
    const row = data.series.rows.find((r) => r.captures > 0)!
    const absentPest = data.pests.groups.find((g) => !row.pests.some((p) => p.pestKey === g.key))!
    expect(query({ ...filters, from: row.day, to: row.day, trapCodes: [row.trapCode], pestKeys: [absentPest.key] }).consultarPragas().status).toBe('no_records')
  })
  it('não inventa variação com base anterior zero ou ausente', () => {
    expect(variation(20, 0, true).percent).toBeNull()
    expect(variation(20, 10, false).percent).toBeNull()
    expect(query({ ...filters, from: '1900-01-01', to: '1900-01-07' }).consultarPragas().variation.percent).toBeNull()
  })
  it('preserva o dia local em fronteiras UTC', () => {
    expect(toLocalDayKey('2026-02-20T02:59:59.000Z')).toBe('2026-02-19')
    expect(toLocalDayKey('2026-02-20T03:00:00.000Z')).toBe('2026-02-20')
    const result = query({ ...filters, from: '2026-02-19', to: '2026-02-19' }).consultarPragas()
    expect(result.daily.items.every((row) => row.day === '2026-02-19')).toBe(true)
  })
  it('seleciona OS pelos dias e preserva totais completos em filtro parcial', () => {
    const os = { ...data.fertilization.operations[0], days: ['2025-08-22', '2025-08-24'] }
    const d = { ...data, fertilization: { ...data.fertilization, operations: [os] } }
    const gap = query({ ...filters, from: '2025-08-23', to: '2025-08-23' }, d).consultarOperacoes('fertilization').domains[0]
    expect(gap.observations).toBe(0)
    const partial = query({ ...filters, from: '2025-08-22', to: '2025-08-22' }, d).consultarOperacoes('fertilization')
    expect(partial.domains[0].partialOperations).toBe(true)
    expect(partial.domains[0].orders.items[0].segments).toBe(os.segments)
    expect(partial.domains[0].evidence[1].from).toBe('2025-08-22')
    expect(partial.domains[0].evidence[1].to).toBe('2025-08-24')
    expect(partial.scope).toContain('Totais completos')
  })
  it('preserva pressão zero como registro, sem diagnóstico, e mantém doses por OS', () => {
    const result = query().consultarOperacoes('both')
    expect(result.domains.find((d) => d.kind === 'spray')?.evidence.find((e) => e.id === 'spray-zeroPressureSegments')?.value)
      .toBe(data.spray.operations.reduce((sum, os) => sum + os.zeroPressureSegments, 0))
    expect(result.limitations.join(' ')).toContain('não comprova falha')
    expect(result.domains[0].orders.items[0].appliedDoseKgHaWeighted).toBe(data.fertilization.operations[0].appliedDoseKgHaWeighted)
  })
  it('mantém flags de ausência, cultura e divergência do motor diário', () => {
    const statuses = query().consultarPragas().dailyThresholds.items
    for (const status of statuses) {
      expect(status).toHaveProperty('thresholdsMissing')
      expect(status).toHaveProperty('cultureMismatch')
      expect(status).toHaveProperty('variantsConflicting')
      expect(status).toHaveProperty('thresholdSummary')
      expect(status).toHaveProperty('note')
    }
  })
  it('omite pessoas, geometrias e imagens, e explica limites organizacionais', () => {
    const q = query()
    const machine = q.consultarAlertasMaquina()
    expect(machine.evidence[0].value).toBe(data.machineAlerts.alerts.length)
    expect(machine.limitations[0]).toContain('sem causa confirmada')
    expect(machine.limitations[0]).toContain('não representam horas')
    const result = JSON.stringify([q.consultarResumo(), q.consultarOperacoes('both'), machine])
    expect(result).not.toMatch(/"operator"|"coordinates"|"imageUrl"/)
  })
})
