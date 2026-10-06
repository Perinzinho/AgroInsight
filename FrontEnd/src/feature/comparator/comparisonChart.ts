import { dailySeries } from '../../data/selectors'
import type { TrapSeriesRow } from '../../data/types'
import { formatDayShort } from '../../core/utils/format'
import { colors } from '../../core/theme/colors'
import type { SeriesSpec } from '../trendChart/trendChart'

export function buildComparisonChart({ rows, days, coverage, dimension, options, pestKeys }: {
  rows: TrapSeriesRow[]
  days: string[]
  coverage: [string, string]
  dimension: 'traps' | 'pests'
  options: { value: string; label: string }[]
  pestKeys: string[]
}) {
  // O filtro Total cobre outros conjuntos, mas as capturas so existem nesta faixa.
  const chartDays = days.filter((day) => day >= coverage[0] && day <= coverage[1])
  const series: SeriesSpec[] = options.map((option, index) => {
    const points = dailySeries(
      dimension === 'traps' ? rows.filter((row) => row.trapCode === option.value) : rows,
      chartDays,
      dimension === 'traps' ? pestKeys : [option.value],
    )
    return {
      label: option.label,
      values: points.map((point) => point.captures === 0 ? null : point.detections),
      color: colors.chart[index % colors.chart.length],
      dash: index >= colors.chart.length ? [5, 3] : [],
      pointRadius: 3,
      tension: 0,
    }
  })
  return { days: chartDays, labels: chartDays.map(formatDayShort), series }
}
