import { beforeAll, describe, expect, it } from 'vitest'
import type { Dataset } from '../../src/shared/agroContracts'
import { buildAnalysisContext } from '../ai/analysisContext'
import { instructions } from '../ai/instructions'
import { estimateInputTokens } from '../ai/tokenBudget'
import { loadData } from './helpers'

let data: Dataset
beforeAll(async () => { data = await loadData() })
const filters = { from: '2025-08-22', to: '2026-02-25', trapCodes: [], pestKeys: [] }

describe('dossiê fundamentado da propriedade', () => {
  it('inclui os totais reais e fontes de todos os domínios sem exportar dados brutos', () => {
    const { packet, registry, minimumFindings } = buildAnalysisContext(data, filters, 'O que causou a queda da safra?', false)
    expect(minimumFindings).toBe(3)
    const facts = registry.all()
    expect(facts.find((e) => e.id === 'pest-ranking-0')).toMatchObject({ label: 'Cigarrinha', value: 7789, source: 'traps_events.csv' })
    expect(facts.find((e) => e.id === 'spray-zeroPressureSegments')?.value).toBe(12863)
    expect(facts.find((e) => e.id === 'fertilization-belowConfiguredSegments')?.value).toBe(13196)
    expect(facts.find((e) => e.id === 'climate-deficit-days')?.value).toBe(82)
    expect(packet.availableData.yieldMeasurements).toBe(false)
    expect(packet.temporalRelations.every((r) => r.overlappingCoverage === false)).toBe(true)
    expect(packet.coverage.find((c) => c.domain === 'pests')).toMatchObject({ status: 'partial', observations: 436 })
    expect(JSON.stringify(packet)).not.toMatch(/photoUrl|operatorName|coordinates|geometryAreaHa/)
    expect(estimateInputTokens({ instructions, input: [{ role: 'user', content: JSON.stringify(packet) }] })).toBeLessThan(6500)
  })
  it('ranking usa as mesmas contagens filtradas e mantém todos os IDs exibidos resolvíveis', () => {
    const { packet, registry } = buildAnalysisContext(data, filters, 'Quais pragas tiveram mais detecções?', false)
    expect(packet.details?.pestRanking?.map((p) => p.detections)).toEqual([7789, 848, 48, 21])
    expect(packet.questionFocus).toEqual(['pests'])
    expect(packet.signals.map((s) => s.id)).toEqual(['pests'])
    expect(() => registry.resolve(packet.signals.flatMap((s) => s.evidenceIds))).not.toThrow()
  })
  it('compacta detalhes sem excluir fatos e sinais necessários à investigação', () => {
    const compact = buildAnalysisContext(data, filters, 'Investigue a safra', false, true)
    expect(compact.packet.details).toBeUndefined()
    expect(compact.packet.signals.filter((s) => s.id !== 'quality')).toHaveLength(5)
    expect(compact.registry.all().some((e) => e.id === 'climate-deficit-days')).toBe(true)
  })
  it('intervalo sem cobertura não vira zero de chuva ou investigação de sinais inexistentes', () => {
    const { packet, registry, minimumFindings } = buildAnalysisContext(data, { ...filters, from: '1900-01-01', to: '1900-01-07' }, 'Investigue a safra', false)
    expect(packet.coverage.every((c) => c.status === 'no_coverage')).toBe(true)
    expect(registry.all().find((e) => e.id === 'climate-rain')?.value).toBeNull()
    expect(minimumFindings).toBe(0)
    expect(packet.signals.filter((s) => s.id !== 'quality')).toHaveLength(0)
  })
})
