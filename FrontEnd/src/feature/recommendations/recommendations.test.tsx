import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AgroContext } from '../../data/agroContext'
import type { AgroContextValue, Dataset, Filters } from '../../data/agroContext'
import { countSeries, filterSeries } from '../../data/selectors'
import { formatNumber } from '../../core/utils/format'
import Shell from '../shell/shell'
import { buildRecommendationAnalysis } from './recommendationMessages'

const readData = (file: string) => JSON.parse(readFileSync(resolve(`public/data/${file}.json`), 'utf8'))
const data: Dataset = {
  manifest: readData('manifest'), traps: readData('traps'), pests: readData('pests'),
  series: readData('trap-series'), events: readData('events/index'), climate: readData('climate/daily'),
  fertilization: readData('operations/fertilization'), spray: readData('operations/spray'),
  machineAlerts: readData('machine-alerts'), stopReasons: readData('stop-reasons'),
}
const filters: Filters = { from: '2025-08-01', to: '2026-02-25', trapCodes: [], pestKeys: [] }
const item = (analysis: ReturnType<typeof buildRecommendationAnalysis>, id: string) => analysis.recommendations.find((entry) => entry.id === id)!

afterEach(() => { vi.restoreAllMocks(); window.location.hash = '' })

describe('Recomendação (IA)', () => {
  it('abre no menu com apenas os cards de ações fundamentadas, sem sorteio', () => {
    window.location.hash = '#/recomendacao-ia'
    const context: AgroContextValue = {
      data, filters, status: 'ready', error: null, isFiltered: false,
      availableRange: { from: filters.from, to: filters.to },
      reload: vi.fn(), setPeriod: vi.fn(), toggleTrap: vi.fn(), togglePest: vi.fn(), resetFilters: vi.fn(),
    }
    const { container, rerender } = render(<AgroContext.Provider value={context}><Shell /></AgroContext.Provider>)
    const links = within(screen.getByRole('navigation', { name: 'Navegacao principal' })).getAllByRole('link')
    expect(links.at(-1)).toHaveTextContent('Recomendação (IA)')
    expect(links.at(-1)).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Recomendações' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Resumo da safra' })).not.toBeInTheDocument()
    expect(screen.queryByText('Modo demonstrativo')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gerar novas recomendações' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('.recommendations__metric')).toHaveLength(0)
    const actions = Array.from(container.querySelectorAll('.recommendations__item'), (node) => node.textContent)
    expect(actions).toHaveLength(6)
    expect(screen.getAllByRole('link', { name: /Consultar dados/ })).toHaveLength(6)
    rerender(<AgroContext.Provider value={{ ...context, filters: { ...filters } }}><Shell /></AgroContext.Provider>)
    expect(Array.from(container.querySelectorAll('.recommendations__item'), (node) => node.textContent)).toEqual(actions)
  })

  it('calcula sinais com os totais reais e não transforma pressão zero em diagnóstico', () => {
    const analysis = buildRecommendationAnalysis(data, filters)
    const zeroPressure = data.spray.operations.reduce((sum, operation) => sum + operation.zeroPressureSegments, 0)
    const belowDose = data.fertilization.operations.reduce((sum, operation) => sum + operation.belowConfiguredSegments, 0)
    const rain = data.climate.days.reduce((sum, day) => sum + day.precipitation, 0)
    const et = data.climate.days.reduce((sum, day) => sum + day.evapotranspiration, 0)
    expect(analysis.metrics.find((metric) => metric.id === 'pressure')?.value).toBe(formatNumber(zeroPressure))
    expect(analysis.metrics.find((metric) => metric.id === 'dose')?.value).toBe(formatNumber(belowDose))
    expect(analysis.metrics.find((metric) => metric.id === 'water')?.value).toBe(`${formatNumber(rain - et, 1)} mm`)
    expect(item(analysis, 'spray').priority).toBe(1)
    expect(item(analysis, 'spray').action).toContain('não comprova falha')
    expect(analysis.recommendations.map((entry) => entry.priority)).toEqual([1, 1, 2, 2, 2, 2])
    expect(item(analysis, 'quality').action).toContain('não trazem produtividade nem perda financeira')
  })

  it('respeita os filtros de período, armadilha e praga nas detecções', () => {
    const row = data.series.rows.find((entry) => entry.captures > 0 && entry.pests.some((pest) => pest.detections > 0))!
    const pest = row.pests.find((entry) => entry.detections > 0)!
    const selected = { ...filters, from: row.day, to: row.day, trapCodes: [row.trapCode], pestKeys: [pest.pestKey] }
    const analysis = buildRecommendationAnalysis(data, selected)
    const counts = countSeries(filterSeries({ rows: data.series.rows, filters: selected }), selected.pestKeys)
    expect(analysis.metrics[0].value).toBe(formatNumber(counts.detections))
    expect(item(analysis, 'pests').evidence).toContain(pest.pestName)
    expect(item(analysis, 'pests').evidence).toContain(row.trapCode)
  })

  it('informa ausência de cobertura sem substituir dados ausentes por zero', () => {
    const analysis = buildRecommendationAnalysis(data, { ...filters, from: '1900-01-01', to: '1900-01-07' })
    expect(analysis.metrics.every((metric) => metric.value === null)).toBe(true)
    expect(analysis.recommendations.every((entry) => entry.priority === 3)).toBe(true)
    expect(item(analysis, 'pests').evidence).toBe('Sem capturas nos filtros selecionados.')
    expect(item(analysis, 'climate').evidence).toBe('A série climática não cobre o período selecionado.')
    expect(item(analysis, 'machine').evidence).toContain('0 alertas')
  })

  it('não seleciona OS em lacunas e identifica totais de OS parcialmente cobertas', () => {
    const operation = { ...data.fertilization.operations[0], days: ['2025-08-22', '2025-08-24'] }
    const isolated = { ...data, fertilization: { ...data.fertilization, operations: [operation] }, spray: { ...data.spray, operations: [] } }
    const gap = buildRecommendationAnalysis(isolated, { ...filters, from: '2025-08-23', to: '2025-08-23' })
    expect(gap.metrics.find((metric) => metric.id === 'dose')?.value).toBeNull()
    const partial = buildRecommendationAnalysis(isolated, { ...filters, from: '2025-08-22', to: '2025-08-22' })
    expect(partial.partialOperations).toBe(true)
    expect(item(partial, 'fertilization').evidence).toContain('Totais completos das ordens de serviço')
  })
})
