import { useMemo } from 'react'
import { useAgro } from '../../data/agroContext'
import { useDerived } from '../../data/useDerived'
import { climateContext, dailySeries } from '../../data/selectors'
import { colors } from '../../core/theme/colors'
import TrendChart from '../trendChart/trendChart'
import type { SeriesSpec } from '../trendChart/trendChart'
import { Card, EmptyHint, Notice } from '../../core/components/ui'
import { formatDayShort, formatNumber } from '../../core/utils/format'
import './trends.css'

/**
 * Tendencias: como as contagens e o clima variam no periodo.
 *
 * As duas linhas pertencem a arquivos diferentes (armadilhas e estacao climatico)
 * e nao tem relacao causal entre si; elas aparecem juntas para permitir a
 * leitura comparada, e a interface diz isso explicitamente.
 */
export default function Trends() {
  const { data, filters } = useAgro()
  const derived = useDerived()

  const chart = useMemo(() => {
    if (!data || !derived) return null

    const points = dailySeries(derived.rows, derived.days, derived.pestKeys)
    const labels = points.map((point) => formatDayShort(point.day))

    // Um dia sem dado vira `null`, para a linha mostrar a lacuna em vez de cair a
    // zero como se a armadilha tivesse parado de detectar.
    const detections = points.map((point) => (point.captures === 0 && point.detections === 0 ? null : point.detections))

    const climateDays = data.climate.days.filter((day) => day.day >= filters.from && day.day <= filters.to)
    const climateByDay = new Map(climateDays.map((day) => [day.day, day]))
    const balance = derived.days.map((day) => climateByDay.get(day)?.waterBalance ?? null)
    const rain = derived.days.map((day) => climateByDay.get(day)?.precipitation ?? null)

    const series: SeriesSpec[] = [
      { label: 'Deteccoes', values: detections, color: colors.green.primary, fill: true },
      { label: 'Balanco hidrico (mm)', values: balance, color: colors.blue.primary },
    ]

    return { labels, series, rain, points, climateDays }
  }, [data, derived, filters.from, filters.to])

  const context = useMemo(() => {
    if (!data) return null
    return climateContext(data.climate.days, filters.from, filters.to)
  }, [data, filters.from, filters.to])

  if (!data || !derived || !chart) return null

  const coveredClimateDays = chart.climateDays.length
  const missingClimateDays = derived.days.length - coveredClimateDays

  return (
    <div className="trends">
      <Card
        title="Deteccoes e balanco hidrico"
        subtitle="Barras: chuva diaria. Linhas: caixas detectadas e saldo de agua do dia"
      >
        {derived.rows.length === 0 ? (
          <EmptyHint>Nenhuma serie de armadilha no periodo selecionado.</EmptyHint>
        ) : (
          <TrendChart
            labels={chart.labels}
            series={chart.series}
            bars={{ label: 'Chuva (mm)', values: chart.rain, color: colors.blue.dark }}
            yLabel="caixas / mm"
            height={280}
          />
        )}

        <Notice tone="info" title="Como ler este grafico">
          As caixas vem de <code>traps_events.csv</code> e o clima da estacao do arquivo climatico. Nao ha relacao causal
          declarada entre as duas series: usar o grafico para comparar contexto, nao para afirmar causa.
        </Notice>
      </Card>

      <Card title="Resumo do periodo" subtitle="Agregados calculados sobre os dias com serie climatesica">
        {coveredClimateDays === 0 ? (
          <EmptyHint>
            O arquivo climatico nao cobre o periodo selecionado. Ele vai de {formatDayShort(data.climate.range[0])} a{' '}
            {formatDayShort(data.climate.range[1])}.
          </EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Dias com serie climatesica</td>
                  <td className="is-number is-primary">
                    {coveredClimateDays}
                    {missingClimateDays > 0 && <span className="trends__gap"> ({missingClimateDays} sem dado)</span>}
                  </td>
                </tr>
                <tr>
                  <td>Chuva acumulada</td>
                  <td className="is-number is-primary">{formatNumber(context?.totalPrecipitation ?? null, 1)} mm</td>
                </tr>
                <tr>
                  <td>Evapotranspiracao</td>
                  <td className="is-number is-primary">{formatNumber(context?.totalEvapotranspiration ?? null, 1)} mm</td>
                </tr>
                <tr>
                  <td>Balanco hidrico do periodo</td>
                  <td className="is-number is-primary">
                    {formatNumber(context?.waterBalance ?? null, 1)} mm
                    <span className="trends__hint">
                      {(context?.waterBalance ?? 0) >= 0 ? ' (chuva acima da demanda)' : ' (demanda acima da chuva)'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Dias com chuva</td>
                  <td className="is-number is-primary">{formatNumber(context?.rainyDays ?? null)}</td>
                </tr>
                <tr>
                  <td>Temperatura media / maxima</td>
                  <td className="is-number is-primary">
                    {formatNumber(context?.meanTemperature ?? null, 1)} / {formatNumber(context?.maxTemperature ?? null, 1)} °C
                  </td>
                </tr>
                <tr>
                  <td>Rajada maxima de vento</td>
                  <td className="is-number is-primary">{formatNumber(context?.maxWindGust ?? null, 1)} km/h</td>
                </tr>
                <tr>
                  <td>Horas ausentes na estacao</td>
                  <td className="is-number is-primary">{formatNumber(context?.missingHours ?? null)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Totais por dia" subtitle="Cada dia do periodo filtrado, inclusive os que nao tiveram dado">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th className="is-number">Armadilhas</th>
                <th className="is-number">Capturas</th>
                <th className="is-number">Caixas</th>
              </tr>
            </thead>
            <tbody>
              {chart.points.map((point) => {
                const dayRows = derived.rows.filter((row) => row.day === point.day)
                return (
                  <tr key={point.day}>
                    <td className="is-primary">{formatDayShort(point.day)}</td>
                    <td className="is-number">{dayRows.length || '—'}</td>
                    <td className="is-number">{point.captures || '—'}</td>
                    <td className="is-number">{point.detections || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}