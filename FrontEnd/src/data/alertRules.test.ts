import { describe, expect, it } from 'vitest'
import {
  LEVEL_SEVERITY,
  climateBand,
  describeThresholds,
  humidityBand,
  levelFor,
  resolveVariant,
} from './alertRules'
import type { PestGroup, PestVariant } from './types'

function variant(overrides: Partial<PestVariant> = {}): PestVariant {
  return {
    pestId: 1,
    popularName: 'Lagarta',
    scientificName: null,
    detectionName: 'Lagarta spp.',
    classification: 'Inseto',
    culture: 'Milho',
    pheromones: null,
    thresholds: { alert: 1, control: 2, damage: 3 },
    description: null,
    symptoms: null,
    intervalDays: { adhesiveFloor: null, pheromone: null },
    referencePhotoTime: null,
    referencePhotos: [],
    ...overrides,
  }
}

function group(variants: PestVariant[]): PestGroup {
  return {
    key: 'lagarta',
    popularName: 'Lagarta',
    scientificNames: [],
    detectionNames: ['Lagarta spp.'],
    classification: 'Inseto',
    cultures: [...new Set(variants.map((entry) => entry.culture))],
    hasDocumentation: true,
    hasReferencePhotos: false,
    variants,
  }
}

describe('levelFor', () => {
  it('classifica pela posicao em relacao aos tres limiares', () => {
    const thresholds = { alert: 1, control: 2, damage: 3 }

    expect(levelFor(0, thresholds).level).toBe('below')
    expect(levelFor(1, thresholds).level).toBe('alert')
    expect(levelFor(2, thresholds).level).toBe('control')
    expect(levelFor(3, thresholds).level).toBe('damage')
    expect(levelFor(99, thresholds).level).toBe('damage')
  })

  it('escolhe o severidade mais alta que a contagem alcancou', () => {
    expect(levelFor(2, { alert: 1, control: 2, damage: 3 }).severity).toBe(LEVEL_SEVERITY.control)
    expect(levelFor(3, { alert: 1, control: 2, damage: 3 }).severity).toBe(LEVEL_SEVERITY.damage)
  })

  it('informa quantas caixas faltam para o proximo limiar', () => {
    const result = levelFor(0, { alert: 2, control: 5, damage: 8 })

    expect(result.nextThreshold).toBe(2)
    expect(result.nextLevel).toBe('alert')
    expect(result.threshold).toBeNull()
  })

  it('marca limiar ausente em vez de tratar como zero', () => {
    const result = levelFor(12, { alert: null, control: null, damage: null })

    expect(result.level).toBe('below')
    expect(result.thresholdsMissing).toBe(true)
    expect(result.nextThreshold).toBeNull()
  })

  it('avalia um limiar isolado sem inventar os outros', () => {
    const result = levelFor(4, { alert: null, control: null, damage: 4 })

    expect(result.level).toBe('damage')
    expect(result.thresholdsMissing).toBe(false)
  })
})

describe('resolveVariant', () => {
  it('escolhe a variante da cultura informada', () => {
    const decision = resolveVariant(
      group([variant({ culture: 'Milho' }), variant({ culture: 'Soja', thresholds: { alert: 5, control: 9, damage: 12 } })]),
      'Soja',
    )

    expect(decision?.variant.culture).toBe('Soja')
    expect(decision?.conflicting).toBe(false)
  })

  it('cai para a variante disponivel e sinaliza a divergencia de cultura', () => {
    const decision = resolveVariant(group([variant({ culture: 'Milho' })]), 'Algodao')

    expect(decision?.variant.culture).toBe('Milho')
  })

  it('usa o pior caso quando a mesma praga tem limiares conflitantes na cultura', () => {
    const decision = resolveVariant(
      group([
        variant({ thresholds: { alert: 1, control: 2, damage: 3 } }),
        variant({ thresholds: { alert: 4, control: 8, damage: 10 } }),
      ]),
      'Milho',
    )

    expect(decision?.variant.thresholds.damage).toBe(10)
    expect(decision?.conflicting).toBe(true)
    expect(decision?.candidates).toHaveLength(2)
  })

  it('devolve null quando a praga nao tem variante alguma', () => {
    expect(resolveVariant(group([]), 'Milho')).toBeNull()
  })
})

describe('describeThresholds', () => {
  it('formata alerta/controle/dano e marca ausencia com guion', () => {
    expect(describeThresholds(variant())).toBe('1/2/3')
    expect(describeThresholds(variant({ thresholds: { alert: 1, control: null, damage: null } }))).toBe('1/-/-')
  })
})

describe('faixas de clima', () => {
  it('classifica temperatura nas faixas declaradas', () => {
    expect(climateBand(0)).toBe('frost')
    expect(climateBand(-2)).toBe('frost')
    expect(climateBand(5)).toBe('cold')
    expect(climateBand(26)).toBe('mild')
    expect(climateBand(35)).toBe('hot')
    expect(climateBand(41)).toBe('very-hot')
  })

  it('classifica umidade relativa', () => {
    expect(humidityBand(20)).toBe('very-dry')
    expect(humidityBand(45)).toBe('dry')
    expect(humidityBand(65)).toBe('ideal')
    expect(humidityBand(85)).toBe('humid')
    expect(humidityBand(95)).toBe('very-humid')
  })
})