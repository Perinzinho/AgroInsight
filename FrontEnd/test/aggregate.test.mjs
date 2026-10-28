import { describe, expect, it } from 'vitest'
import {
  countBy,
  daysBetween,
  dedupeById,
  extent,
  mean,
  median,
  sumBy,
  toSlug,
  weightedMean,
  withoutRowNumber,
} from '../scripts/lib/aggregate.mjs'
import { DiscardLog } from '../scripts/lib/discardLog.mjs'

/**
 * As agregacoes montam os numeros que a interface mostra. O ponto critico e a
 * distincao entre zero e ausencia: media de lista vazia tem de ser `null`, senao
 * um conjunto sem dado vira "media 0" na tela.
 */
describe('aggregate: medias', () => {
  it('calcula media e mediana', () => {
    expect(mean([1, 2, 3])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('devolve null, e nao zero, quando nao ha valor nenhum', () => {
    expect(mean([])).toBeNull()
    expect(median([])).toBeNull()
  })

  it('ignora valores nulos em vez de contar como zero', () => {
    expect(mean([2, null, 4])).toBe(3)
    expect(mean([null, 3])).toBe(3)
  })

  it('preserva zero como valor valido', () => {
    expect(mean([0, 2])).toBe(1)
  })
})

describe('aggregate: extensao', () => {
  it('devolve minimo, maximo e quantas amostras faltavam', () => {
    expect(extent([3, 1, 2, null])).toEqual({ min: 1, max: 3, missing: 1 })
  })

  it('conta todas as amostras como ausentes em lista sem numeros', () => {
    expect(extent([null, undefined])).toEqual({ min: null, max: null, missing: 2 })
  })

  it('preserva zero como extremo valido', () => {
    expect(extent([0, 5])).toEqual({ min: 0, max: 5, missing: 0 })
  })
})

describe('aggregate: media ponderada', () => {
  it('divide pelo peso, e nao pela contagem de itens', () => {
    const items = [
      { value: 10, weight: 1 },
      { value: 20, weight: 3 },
    ]
    expect(weightedMean(items, (item) => item.value, (item) => item.weight)).toBe(17.5)
  })

  it('ignora item com peso zero ou ausente em vez de distorcer a media', () => {
    const items = [
      { value: 10, weight: 1 },
      { value: 999, weight: 0 },
      { value: 30, weight: null },
    ]
    expect(weightedMean(items, (item) => item.value, (item) => item.weight)).toBe(10)
  })

  it('devolve null quando o peso total e zero', () => {
    expect(weightedMean([{ value: 10, weight: 0 }], (item) => item.value, (item) => item.weight)).toBeNull()
  })
})

describe('aggregate: contagem e soma por chave', () => {
  const rows = [
    { type: 'IMAGE', value: 2 },
    { type: 'IMAGE', value: 3 },
    { type: 'PING', value: 5 },
    { type: null, value: 7 },
  ]

  it('conta por chave e devolve um mapa', () => {
    expect(Object.fromEntries(countBy(rows, (row) => row.type))).toEqual({ IMAGE: 2, PING: 1 })
  })

  it('soma por chave ignorando valores nao numericos', () => {
    expect(Object.fromEntries(sumBy(rows, (row) => row.type, (row) => row.value))).toEqual({ IMAGE: 5, PING: 5 })
  })
})

describe('aggregate: dias presentes', () => {
  it('devolve os dias distintos, ordenados', () => {
    expect(daysBetween(['2026-02-26T01:00:00Z', '2026-02-24T10:00:00Z', '2026-02-26T05:00:00Z'])).toEqual([
      '2026-02-24',
      '2026-02-26',
    ])
  })

  it('ignora valores que nao sao instante', () => {
    expect(daysBetween(['2026-02-24', null, 42])).toEqual(['2026-02-24'])
  })
})

describe('aggregate: deduplicacao', () => {
  it('mantem a primeira ocorrencia e registra as repetidas com linha de origem', () => {
    const log = new DiscardLog()
    const rows = [
      { alertId: 'a', value: 1, __rowNumber: 2 },
      { alertId: 'a', value: 9, __rowNumber: 3 },
      { alertId: 'b', value: 2, __rowNumber: 4 },
    ]

    const kept = dedupeById(
      rows,
      (row) => row.alertId,
      log,
      'alerts',
      'LAYER_MAP_PARAMETERIZED_ALERT.csv',
      'alerta repetido byte a byte',
    )

    expect(kept).toHaveLength(2)
    expect(kept.map((row) => row.value)).toEqual([1, 2])

    const discarded = log.toJSON()
    expect(discarded).toHaveLength(1)
    expect(discarded[0].count).toBe(1)
    expect(discarded[0].reason).toBe('alerta repetido byte a byte')
    expect(discarded[0].examples[0]).toContain('linha 3')
  })

  it('descarta registro sem chave e registra o motivo', () => {
    const log = new DiscardLog()
    const kept = dedupeById([{ id: null, __rowNumber: 7 }], (row) => row.id, log, 'pests', 'pest_list.csv', 'duplicada')

    expect(kept).toHaveLength(0)
    expect(log.toJSON()[0].reason).toContain('sem chave')
  })

  it('nao registra nada quando nao ha repeticao', () => {
    const log = new DiscardLog()
    const kept = dedupeById([{ id: 1 }, { id: 2 }], (row) => row.id, log, 'x', 'y', 'z')
    expect(kept).toHaveLength(2)
    expect(log.toJSON()).toHaveLength(0)
  })
})

describe('aggregate: auxiliares', () => {
  it('gera slug estavel para nome de arquivo', () => {
    expect(toSlug('Adubação de Cobertura')).toBe('adubacao-de-cobertura')
    expect(toSlug(null)).toBeNull()
  })

  it('remove o numero de linha sem mexer nos outros campos', () => {
    expect(withoutRowNumber({ a: '1', __rowNumber: 7 })).toEqual({ a: '1' })
  })
})