import { beforeAll, describe, expect, it } from 'vitest'
import type { Dataset } from '../../src/shared/agroContracts'
import { createQueries } from '../ai/queries'
import { createToolContext } from '../ai/context'
import { EvidenceRegistry } from '../data/evidenceRegistry'
import { loadData } from './helpers'

let data: Dataset
beforeAll(async () => { data = await loadData() })
const filters = { from: '2025-08-01', to: '2026-02-25', trapCodes: [], pestKeys: [] }
function withoutFilters(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutFilters)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'effectiveFilters').map(([key, item]) => [key, withoutFilters(item)]))
}

describe('contexto compacto de ferramentas', () => {
  it('preserva todos os valores, fontes, períodos, amostras e limitações nas cinco consultas', () => {
    const q = createQueries(data, filters, new EvidenceRegistry())
    const outputs = [q.consultarResumo(), q.consultarPragas(), q.consultarClima(), q.consultarOperacoes('both'), q.consultarAlertasMaquina()]
    const pack = createToolContext()
    const sources = new Map<string, Record<string, unknown>>()
    const evidence = new Map<string, Record<string, unknown>>()
    const packed = outputs.map(pack)
    expect(packed.join('').length).toBeLessThan(JSON.stringify(outputs).length)
    for (const [index, serialized] of packed.entries()) {
      const result = JSON.parse(serialized)
      for (const { id, ...metadata } of result.evidenceContexts ?? []) sources.set(id, metadata)
      function restore(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(restore)
        if (!value || typeof value !== 'object') return value
        return Object.fromEntries(Object.entries(value).map(([key, item]) => {
          if (key !== 'evidence' || !Array.isArray(item)) return [key, restore(item)]
          return [key, item.map((entry) => {
            if (entry.previouslyProvided) {
              expect(evidence.has(entry.id)).toBe(true)
              return evidence.get(entry.id)
            }
            const { context, ...fact } = entry
            expect(sources.has(context)).toBe(true)
            const restored = { ...fact, ...sources.get(context) }
            evidence.set(entry.id, restored)
            return restored
          })]
        }))
      }
      expect(restore(result.data)).toEqual(withoutFilters(outputs[index]))
    }
  })
  it('mantém evidências e referências isoladas entre análises', () => {
    const result = createQueries(data, filters, new EvidenceRegistry()).consultarResumo()
    const first = createToolContext()
    const second = createToolContext()
    const initial = first(result)
    expect(first(result)).toContain('previouslyProvided')
    expect(second(result)).toBe(initial)
    expect(initial).not.toContain('previouslyProvided')
  })
})
