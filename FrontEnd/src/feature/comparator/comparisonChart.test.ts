import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { daysBetween } from '../../core/utils/format'
import { detectionsByPest, filterSeries } from '../../data/selectors'
import type { Manifest, TrapSeriesPayload, TrapSeriesRow } from '../../data/types'
import { buildComparisonChart } from './comparisonChart'

const dataset = JSON.parse(readFileSync(resolve('public/data/trap-series.json'), 'utf8')) as TrapSeriesPayload
const manifest = JSON.parse(readFileSync(resolve('public/data/manifest.json'), 'utf8')) as Manifest
const coverage = manifest.coverage.events.range

describe('comparador com todas as séries', () => {
  it.each([7, 14, 30, 'total'] as const)('preserva as contagens reais no período %s', (period) => {
    const to = coverage[1]
    const from = period === 'total' ? '2025-08-22' : new Date(Date.parse(`${to}T00:00:00Z`) - (period - 1) * 86400000).toISOString().slice(0, 10)
    const rows = filterSeries({ rows: dataset.rows, filters: { from, to, trapCodes: [], pestKeys: [] } })
    const expectedTotal = rows.reduce((total, row) => total + row.detections, 0)
    for (const dimension of ['traps', 'pests'] as const) {
      const options = dimension === 'traps'
        ? [...new Set(rows.map((row) => row.trapCode))].map((value) => ({ value, label: value }))
        : detectionsByPest(rows).map((pest) => ({ value: pest.pestKey, label: pest.pestName }))
      const chart = buildComparisonChart({ rows, days: daysBetween(from, to), coverage, dimension, options, pestKeys: [] })
      expect(chart.series).toHaveLength(options.length)
      expect(chart.series.flatMap((series) => series.values).reduce<number>((total, value) => total + (value ?? 0), 0)).toBe(expectedTotal)
      expect(chart.days.every((day) => day >= coverage[0] && day <= coverage[1])).toBe(true)
      expect(chart.series.every((series) => series.values.length === chart.labels.length && series.pointRadius! > 0)).toBe(true)
      if (period === 'total') {
        expect(chart.days).toHaveLength(31)
        expect(expectedTotal).toBe(manifest.coverage.events.totalDetections)
        expect(chart.series).toHaveLength(dimension === 'traps' ? 14 : 4)
      }
    }
  })

  it('distingue uma captura sem detecções de um dia sem captura', () => {
    const row = { ...dataset.rows[0], trapCode: 'A', day: '2026-02-01', captures: 1, detections: 0, pests: [] } as TrapSeriesRow
    const chart = buildComparisonChart({ rows: [row], days: ['2026-02-01', '2026-02-02'], coverage, dimension: 'traps', options: [{ value: 'A', label: 'A' }], pestKeys: [] })
    expect(chart.series[0].values).toEqual([0, null])
  })

  it('mantém a soma das capturas e das pragas coerente com a origem', () => {
    expect(dataset.rows.reduce((total, row) => total + row.captures, 0)).toBe(manifest.coverage.events.totalCaptures)
    for (const row of dataset.rows) {
      expect(row.detections).toBe(row.pests.reduce((total, pest) => total + pest.detections, 0))
      expect(Number.isFinite(row.detections) && row.detections >= 0).toBe(true)
    }
  })
})
