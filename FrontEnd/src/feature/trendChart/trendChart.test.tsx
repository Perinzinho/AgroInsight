import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartConfigurationCustomTypesPerDataset } from 'chart.js'
import TrendChart from './trendChart'

const recorded = vi.hoisted(() => ({ configs: [] as ChartConfigurationCustomTypesPerDataset<'line' | 'bar', (number | null)[], string>[] }))
vi.mock('chart.js', async () => {
  const actual = await vi.importActual<typeof import('chart.js')>('chart.js')
  class ChartMock {
    static defaults = actual.Chart.defaults
    static register() {}
    constructor(_canvas: HTMLCanvasElement, config: typeof recorded.configs[number]) { recorded.configs.push(config) }
    destroy() {}
  }
  return { ...actual, Chart: ChartMock }
})
afterEach(() => { cleanup(); recorded.configs.length = 0 })

describe('gráfico com muitas séries', () => {
  it('reserva o espaço do comparador e mantém medições isoladas visíveis', () => {
    const labels = Array.from({ length: 45 }, (_, index) => String(index))
    const series = Array.from({ length: 14 }, (_, index) => ({ label: `Armadilha ${index}`, color: '#2A6B4B', pointRadius: 3, tension: 0, values: labels.map((_, day) => day === 20 ? index : null) }))
    const { getByRole } = render(<TrendChart labels={labels} series={series} height={360} showLegend={false} interactionMode="nearest" ariaLabel="Comparação por armadilha" />)
    const config = recorded.configs.at(-1)!
    expect(config.data.datasets).toHaveLength(14)
    expect(config.options).toMatchObject({ plugins: { legend: { display: false } }, interaction: { mode: 'nearest' } })
    expect(config.data.datasets.every((dataset) => dataset.type === 'line' && dataset.pointRadius === 3 && dataset.spanGaps === false)).toBe(true)
    expect(getByRole('img', { name: 'Comparação por armadilha' }).parentElement).toHaveStyle({ height: '360px' })
  })
  it('mantém a legenda das outras telas por padrão', () => {
    render(<TrendChart labels={['01/02']} series={[{ label: 'A', color: '#2A6B4B', values: [1] }, { label: 'B', color: '#4C8190', values: [2] }]} />)
    expect(recorded.configs.at(-1)!.options).toMatchObject({ plugins: { legend: { display: true } }, interaction: { mode: 'index' } })
  })
})
