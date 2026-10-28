import { describe, expect, it } from 'vitest'
import {
  climateContext,
  countSeries,
  dailySeries,
  detectAnomalies,
  detectionsByPest,
  filterSeries,
  previousPeriod,
  resolveCulture,
  trapRanking,
  variation,
} from './selectors'
import type { ClimateDay, PestGroup, Trap, TrapSeriesRow } from './types'

function row(overrides: Partial<TrapSeriesRow> & { trapCode: string; day: string }): TrapSeriesRow {
  return {
    trapType: 'Fotossensivel',
    captures: 1,
    detections: 0,
    images: 1,
    pings: 2,
    batteryReadings: 1,
    batteryVoltageMean: 3.9,
    divergentEvents: 0,
    pests: [],
    ...overrides,
  }
}

function pestRow(overrides: Partial<TrapSeriesRow> & { trapCode: string; day: string }) {
  return row({
    detections: 10,
    pests: [
      { pestKey: 'lagarta', pestName: 'Lagarta', pestId: 16, captures: 1, detections: 10, meanConfidence: 0.86 },
    ],
    ...overrides,
  })
}

const series: TrapSeriesRow[] = [
  pestRow({ trapCode: 'A', day: '2026-01-26' }),
  pestRow({ trapCode: 'B', day: '2026-01-26' }),
  pestRow({ trapCode: 'A', day: '2026-01-27', detections: 30, pests: [{ pestKey: 'lagarta', pestName: 'Lagarta', pestId: 16, captures: 1, detections: 30, meanConfidence: 0.55 }] }),
  row({ trapCode: 'A', day: '2026-01-28', captures: 0, images: 0, detections: 0, batteryVoltageMean: null }),
]

describe('filterSeries', () => {
  const base = { from: '2026-01-26', to: '2026-01-27', trapCodes: [], pestKeys: [] as string[] }

  it('mantem tudo sem filtro de armadilha nem de praga', () => {
    expect(filterSeries({ rows: series, filters: base })).toHaveLength(3)
  })

  it('filtra por periodo no fuso da propriedade', () => {
    expect(filterSeries({ rows: series, filters: { ...base, to: '2026-01-26' } })).toHaveLength(2)
  })

  it('filtra por armadilha selecionada', () => {
    const rows = filterSeries({ rows: series, filters: { ...base, to: '2026-01-28', trapCodes: ['A'] } })

    expect(rows.map((entry) => entry.day)).toEqual(['2026-01-26', '2026-01-27', '2026-01-28'])
  })

  it('filtra por praga usando as linhas que possuem aquela praga', () => {
    const rows = filterSeries({ rows: series, filters: { ...base, pestKeys: ['lagarta'] } })

    expect(rows).toHaveLength(3)
    expect(rows.every((entry) => entry.pests.some((pest) => pest.pestKey === 'lagarta'))).toBe(true)
  })
})

describe('countSeries', () => {
  it('soma capturas, caixas e armadilhas distintas', () => {
    const counts = countSeries(series)

    expect(counts.captures).toBe(3)
    expect(counts.detections).toBe(50)
    expect(counts.traps).toBe(2)
    expect(counts.pestKeys).toEqual(['lagarta'])
  })

  it('recalcula as caixas apenas com as pragas selecionadas', () => {
    const rows = [
      row({
        trapCode: 'A',
        day: '2026-01-26',
        detections: 10,
        pests: [
          { pestKey: 'lagarta', pestName: 'Lagarta', pestId: 16, captures: 1, detections: 7, meanConfidence: 0.9 },
          { pestKey: 'percevejo', pestName: 'Percevejo', pestId: 20, captures: 1, detections: 3, meanConfidence: 0.8 },
        ],
      }),
    ]

    expect(countSeries(rows, ['lagarta']).detections).toBe(7)
    expect(countSeries(rows, ['percevejo']).detections).toBe(3)
    expect(countSeries(rows, ['lagarta', 'percevejo']).detections).toBe(10)
  })
})

describe('detectionsByPest', () => {
  it('ordena por deteccoes e calcula a confianca media', () => {
    const rows = [
      row({
        trapCode: 'A',
        day: '2026-01-26',
        pests: [
          { pestKey: 'a', pestName: 'A', pestId: 1, captures: 1, detections: 2, meanConfidence: 0.8 },
          { pestKey: 'b', pestName: 'B', pestId: 2, captures: 2, detections: 9, meanConfidence: 0.6 },
        ],
      }),
    ]

    const totals = detectionsByPest(rows)

    expect(totals[0].pestKey).toBe('b')
    expect(totals[0].detections).toBe(9)
    expect(totals[0].meanConfidence).toBeCloseTo(0.6)
    expect(totals[1].pestKey).toBe('a')
  })
})

describe('variation', () => {
  it('calcula a variacao percentual', () => {
    expect(variation(150, 100, true).percent).toBe(50)
    expect(variation(50, 100, true).direction).toBe('down')
    expect(variation(100, 100, true).direction).toBe('flat')
  })

  it('nao divide por periodo anterior vazio', () => {
    const result = variation(20, 0, true)

    expect(result.percent).toBeNull()
    expect(result.direction).toBe('unknown')
  })

  it('nao calcula variacao sem dado no periodo anterior', () => {
    expect(variation(20, 0, false).percent).toBeNull()
  })
})

describe('previousPeriod', () => {
  it('devolve a janela anterior com a mesma duracao, sem sobrepor', () => {
    expect(previousPeriod('2026-01-26', '2026-02-01')).toEqual({ from: '2026-01-19', to: '2026-01-25' })
  })

  it('trata janela de um dia', () => {
    expect(previousPeriod('2026-01-26', '2026-01-26')).toEqual({ from: '2026-01-25', to: '2026-01-25' })
  })
})

describe('resolveCulture', () => {
  const trap = (trapCode: string, cultures: string[]): Trap =>
    ({
      trapCode,
      cultures,
      trapIds: [],
      latitude: null,
      longitude: null,
      type: null,
      status: null,
      radius: null,
      plotId: null,
      requestGps: null,
      photoProgrammedAt: null,
      secondPhotoTime: null,
      photoWeekdays: [],
      installationDate: null,
      lastAdhesiveFloorReplacement: null,
      lastPheromoneExchange: null,
      sources: [],
      history: [],
      latest: null,
      statusesSeen: [],
      infestationsSeen: [],
      primaryPestsSeen: [],
      readingsFromUnknownTrapId: 0,
    }) as Trap

  it('devolve a cultura declarada pelas armadilhas selecionadas', () => {
    expect(resolveCulture([trap('A', ['Milho']), trap('B', ['Milho'])], [])).toBe('Milho')
    expect(resolveCulture([trap('A', ['Milho']), trap('B', ['Milho']), trap('C', ['Soja'])], ['C'])).toBe('Soja')
  })

  it('devolve null quando nao ha cultura alguma', () => {
    expect(resolveCulture([trap('A', [])], [])).toBeNull()
  })

  it('devolve null em empate entre culturas diferentes', () => {
    expect(resolveCulture([trap('A', ['Milho']), trap('B', ['Soja'])], [])).toBeNull()
  })
})

describe('dailySeries', () => {
  it('preenche os dias sem dado com zero', () => {
    const points = dailySeries(series, ['2026-01-26', '2026-01-27', '2026-01-29'])

    expect(points).toHaveLength(3)
    expect(points.map((point) => point.detections)).toEqual([20, 30, 0])
  })

  it('restringe as caixas as pragas selecionadas', () => {
    const points = dailySeries(series, ['2026-01-27'], ['lagarta'])
    expect(points[0].detections).toBe(30)
  })
})

const groups: PestGroup[] = [
  {
    key: 'lagarta',
    popularName: 'Lagarta',
    scientificNames: [],
    detectionNames: ['Lagarta spp.'],
    classification: 'Inseto',
    cultures: ['Milho'],
    hasDocumentation: true,
    hasReferencePhotos: false,
    variants: [
      {
        pestId: 16,
        popularName: 'Lagarta',
        scientificName: null,
        detectionName: 'Lagarta spp.',
        classification: 'Inseto',
        culture: 'Milho',
        pheromones: null,
        thresholds: { alert: 5, control: 10, damage: 20 },
        description: null,
        symptoms: null,
        intervalDays: { adhesiveFloor: null, pheromone: null },
        referencePhotoTime: null,
        referencePhotos: [],
      },
    ],
  },
]

describe('trapRanking', () => {
  it('ordena armadilhas por caixas e expoe a praga dominante', () => {
    const ranking = trapRanking(series, groups, 'Milho')

    expect(ranking[0].trapCode).toBe('A')
    expect(ranking[0].detections).toBe(40)
    expect(ranking[0].topPest).toBe('Lagarta')
  })

  it('marca severidade pela pior praga da armadilha', () => {
    const ranking = trapRanking(series, groups, 'Milho')

    // A soma 40 caixas contra limiar de dano 20.
    expect(ranking[0].severity).toBe('critical')
    // B tem 10 caixas, exatamente o limiar de controle.
    expect(ranking[1].severity).toBe('high')
  })

  it('sem limiar cadastrado a severidade fica desconhecida em vez de "ok"', () => {
    const ranking = trapRanking(series, [], 'Milho')

    expect(ranking[0].severity).toBe('unknown')
  })
})

describe('detectAnomalies', () => {
  it('aponta pico acima de dois desvios com volume suficiente', () => {
    const rows = [
      row({ trapCode: 'A', day: '2026-01-25', detections: 10 }),
      row({ trapCode: 'A', day: '2026-01-26', detections: 10 }),
      row({ trapCode: 'A', day: '2026-01-27', detections: 10 }),
      row({ trapCode: 'A', day: '2026-01-28', detections: 10 }),
      row({ trapCode: 'A', day: '2026-01-29', detections: 10 }),
      row({ trapCode: 'A', day: '2026-01-30', detections: 120 }),
    ]

    const spikes = detectAnomalies(rows).filter((anomaly) => anomaly.kind === 'pico')

    expect(spikes).toHaveLength(1)
    expect(spikes[0].day).toBe('2026-01-30')
  })

  it('nao aponta pico com contagem baixa, para nao reagir a ruido', () => {
    const rows = [
      row({ trapCode: 'A', day: '2026-01-26', detections: 4 }),
      row({ trapCode: 'A', day: '2026-01-27', detections: 4 }),
      row({ trapCode: 'A', day: '2026-01-28', detections: 4 }),
      row({ trapCode: 'A', day: '2026-01-29', detections: 9 }),
    ]

    expect(detectAnomalies(rows).filter((anomaly) => anomaly.kind === 'pico')).toHaveLength(0)
  })

  it('aponta dia sem captura quando a armadilha costuma capturar', () => {
    const rows = [
      row({ trapCode: 'A', day: '2026-01-26', captures: 1 }),
      row({ trapCode: 'A', day: '2026-01-27', captures: 1 }),
      row({ trapCode: 'A', day: '2026-01-28', captures: 1 }),
      row({ trapCode: 'A', day: '2026-01-29', captures: 0, images: 0 }),
    ]

    const gaps = detectAnomalies(rows).filter((anomaly) => anomaly.kind === 'ausencia')

    expect(gaps).toHaveLength(1)
    expect(gaps[0].day).toBe('2026-01-29')
  })

  it('aponta confianca media abaixo de 60%', () => {
    const rows = [
      pestRow({ trapCode: 'A', day: '2026-01-26', pests: [{ pestKey: 'lagarta', pestName: 'Lagarta', pestId: 16, captures: 1, detections: 5, meanConfidence: 0.41 }] }),
      pestRow({ trapCode: 'A', day: '2026-01-27' }),
      pestRow({ trapCode: 'A', day: '2026-01-28' }),
      pestRow({ trapCode: 'A', day: '2026-01-29' }),
    ]

    expect(detectAnomalies(rows).filter((anomaly) => anomaly.kind === 'confianca')).toHaveLength(1)
  })

  it('ignora armadilhas com menos de quatro dias de serie', () => {
    expect(detectAnomalies(series.slice(0, 2))).toHaveLength(0)
  })
})

describe('climateContext', () => {
  const climate: ClimateDay[] = [
    climateDay('2026-01-26', { precipitation: 0, evapotranspiration: 5, temperatureMean: 24, temperatureMax: 29, humidityMean: 70, windGust: 12 }),
    climateDay('2026-01-27', { precipitation: 10, evapotranspiration: 3, temperatureMean: 26, temperatureMax: 31, humidityMean: 90, windGust: 22 }),
    climateDay('2026-02-01', { precipitation: 99, evapotranspiration: 99, temperatureMean: 99, temperatureMax: 99, humidityMean: 99, windGust: 99 }),
  ]

  it('agrega apenas os dias dentro do periodo', () => {
    const context = climateContext(climate, '2026-01-26', '2026-01-27')

    expect(context.days).toHaveLength(2)
    expect(context.totalPrecipitation).toBe(10)
    expect(context.totalEvapotranspiration).toBe(8)
    expect(context.waterBalance).toBe(2)
    expect(context.rainyDays).toBe(1)
  })

  it('resume temperatura, umidade e rajada', () => {
    const context = climateContext(climate, '2026-01-26', '2026-01-27')

    expect(context.meanTemperature).toBe(25)
    expect(context.maxTemperature).toBe(31)
    expect(context.maxWindGust).toBe(22)
    expect(context.meanHumidity).toBe(80)
  })

  it('devolve nulos quando o periodo nao tem dado climatico', () => {
    const context = climateContext(climate, '2025-01-01', '2025-01-07')

    expect(context.days).toHaveLength(0)
    expect(context.meanTemperature).toBeNull()
    expect(context.waterBalance).toBe(0)
  })
})

function climateDay(day: string, overrides: Partial<ClimateDay>): ClimateDay {
  return {
    day,
    hours: 24,
    precipitation: 0,
    evapotranspiration: 0,
    waterBalance: 0,
    temperatureMin: null,
    temperatureMean: null,
    temperatureMax: null,
    humidityMin: null,
    humidityMean: null,
    humidityMax: null,
    windMean: null,
    windGust: null,
    solarRadiation: null,
    missingHours: 0,
    ...overrides,
  }
}