import { useEffect, useRef } from 'react'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { colors } from '../../core/theme/colors'

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
)

Chart.defaults.color = colors.text.secondary
Chart.defaults.borderColor = colors.border.default
Chart.defaults.font.family = "'Segoe UI', Arial, sans-serif"

export interface SeriesSpec {
  label: string
  values: (number | null)[]
  color: string
  /** `true` desenha uma area sob a linha. */
  fill?: boolean
  /** Mantem pontos isolados visiveis, mesmo em intervalos longos. */
  pointRadius?: number
  tension?: number
  dash?: number[]
}

export interface BarsSpec {
  label: string
  values: (number | null)[]
  color: string
}

/**
 * Grafico de linha multi-serie com barra sobreposta opcional.
 *
 * A escala e sempre comecando em zero: o produto compara contagens e precisa que
 * a altura da linha represente a proporcao real, sem cortes que exagerem
 * diferencas. Series com `null` viram buracos, e nao zero, porque zero seria
 * uma medicao que o arquivo nao tem.
 *
 * `series`, `bars` e `labels` precisam ser estaveis entre renders (useMemo no
 * chamador): o efeito usa a identidade deles para nao recriar o grafico a cada
 * digitacao ou re-render do pai.
 */
export default function TrendChart({
  labels,
  series,
  bars,
  height = 240,
  yLabel,
  showLegend = true,
  interactionMode = 'index',
  ariaLabel = 'Gráfico de série temporal',
}: {
  labels: string[]
  series: SeriesSpec[]
  bars?: BarsSpec
  height?: number
  yLabel?: string
  showLegend?: boolean
  interactionMode?: 'index' | 'nearest'
  ariaLabel?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    chartRef.current?.destroy()

    chartRef.current = new Chart(canvas, {
      data: {
        labels,
        datasets: [
          ...series.map((entry, index) => ({
            type: 'line' as const,
            label: entry.label,
            data: entry.values,
            borderColor: entry.color,
            backgroundColor: entry.fill ? `${entry.color}22` : entry.color,
            fill: entry.fill ?? false,
            tension: entry.tension ?? 0.28,
            borderDash: entry.dash ?? [],
            pointRadius: entry.pointRadius ?? (entry.values.length > 40 ? 0 : 2.5),
            pointHoverRadius: 5,
            borderWidth: 2,
            spanGaps: false,
            order: index + 1,
          })),
          ...(bars
            ? [
                {
                  type: 'bar' as const,
                  label: bars.label,
                  data: bars.values,
                  backgroundColor: `${bars.color}55`,
                  borderColor: bars.color,
                  borderWidth: 1,
                  order: 0,
                  barPercentage: 0.85,
                  categoryPercentage: 0.9,
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: interactionMode, intersect: false },
        plugins: {
          legend: {
            display: showLegend && series.length + (bars ? 1 : 0) > 1,
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 12 },
          },
          tooltip: {
            backgroundColor: colors.background.surfaceElevated,
            borderColor: colors.border.strong,
            borderWidth: 1,
            titleColor: colors.text.primary,
            bodyColor: colors.text.secondary,
            padding: 10,
            callbacks: {
              label: (context) =>
                ` ${context.dataset.label}: ${
                  typeof context.parsed.y === 'number' ? context.parsed.y.toLocaleString('pt-BR') : 'sem dado'
                }`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 14, font: { size: 10 } } },
          y: {
            beginAtZero: true,
            title: yLabel ? { display: true, text: yLabel, font: { size: 10 } } : undefined,
            ticks: { precision: 0, font: { size: 10 } },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [labels, series, bars, yLabel, showLegend, interactionMode])

  return (
    <div style={{ position: 'relative', height, minWidth: 0, width: '100%' }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  )
}
