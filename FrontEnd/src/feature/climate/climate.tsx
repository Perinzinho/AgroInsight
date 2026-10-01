import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { climateContext } from '../../data/selectors'
import { humidityBand } from '../../data/alertRules'
import { colors } from '../../core/theme/colors'
import TrendChart from '../trendChart/trendChart'
import { Badge, Card, EmptyHint, SegmentedControl, Stat } from '../../core/components/ui'
import { formatDay, formatDayShort, formatNumber } from '../../core/utils/format'
import './climate.css'

/**
 * Clima da estacao do periodo.
 *
 * A base climatica tem 117 dias e nao cobre todo o intervalo de eventos, entao
 * a tela separaria "dia sem dado climatico" de "dia seco": zero de chuva e
 *ausencia de medicao nao sao o mesmo fato.
 */
export default function Climate() {
  const { data, filters } = useAgro()
  const [dayOrder, setDayOrder] = useState<'desc' | 'asc'>('desc')

  const view = useMemo(() => {
    if (!data) return null
    const inPeriod = data.climate.days.filter((day) => day.day >= filters.from && day.day <= filters.to)
    return {
      days: inPeriod,
      context: climateContext(data.climate.days, filters.from, filters.to),
    }
  }, [data, filters.from, filters.to])

  const tableDays = useMemo(() => {
    if (!view) return []
    return view.days
      .filter((day) =>
        day.hours > 0 &&
        (day.precipitation !== 0 ||
          day.evapotranspiration !== 0 ||
          [day.temperatureMean, day.temperatureMax, day.humidityMean, day.windMean, day.windGust].some(
            (value) => value !== null,
          )),
      )
      .sort((a, b) => (dayOrder === 'asc' ? a.day.localeCompare(b.day) : b.day.localeCompare(a.day)))
  }, [view, dayOrder])

  if (!data || !view) return null

  const labels = view.days.map((day) => formatDayShort(day.day))

  return (
    <div className="climate">
      <div className="climate__stats">
        <Stat
          label="Chuva acumulada"
          value={formatNumber(view.context.totalPrecipitation, 1)}
          note={`em ${view.days.length} dia(s) com serie`}
          tone="blue"
        />
        <Stat
          label="Balanco hidrico"
          value={formatNumber(view.context.waterBalance, 1)}
          note={view.context.waterBalance >= 0 ? 'chuva acima da demanda' : 'demanda acima da chuva'}
          tone={view.context.waterBalance >= 0 ? 'green' : 'yellow'}
        />
        <Stat
          label="Temperatura"
          value={
            view.context.meanTemperature === null ? null : formatNumber(view.context.meanTemperature, 1)
          }
          note={
            view.context.maxTemperature === null
              ? 'sem medicao no periodo'
              : `max ${formatNumber(view.context.maxTemperature, 1)} °C`
          }
          tone="neutral"
        />
        <Stat
          label="Rajada maxima"
          value={formatNumber(view.context.maxWindGust, 1)}
          note="km/h"
          tone={view.context.maxWindGust !== null && view.context.maxWindGust > 40 ? 'yellow' : 'neutral'}
        />
        <Stat
          label="Horas sem leitura"
          value={formatNumber(view.context.missingHours)}
          note="lacunas dentro dos dias com serie"
          tone={view.context.missingHours > 0 ? 'yellow' : 'green'}
        />
      </div>

      <Card
        title="Chuva e balanco hidrico"
        subtitle={`${formatDay(data.climate.range[0])} a ${formatDay(data.climate.range[1])} · apenas os dias com serie`}
      >
        {view.days.length === 0 ? (
          <EmptyHint>
            A base climatica vai de {formatDay(data.climate.range[0])} a {formatDay(data.climate.range[1])} e nao cobre o
            periodo selecionado.
          </EmptyHint>
        ) : (
          <TrendChart
            labels={labels}
            bars={{ label: 'Chuva (mm)', values: view.days.map((day) => day.precipitation), color: colors.blue.primary }}
            series={[
              {
                label: 'Balanco hidrico (mm)',
                values: view.days.map((day) => day.waterBalance),
                color: colors.green.primary,
              },
            ]}
            yLabel="mm"
            height={240}
          />
        )}
      </Card>

      <Card title="Temperatura e umidade" subtitle="Linhas da media diaria; buracos ficam como buracos">
        {view.days.length === 0 ? (
          <EmptyHint>Sem serie climatica no periodo.</EmptyHint>
        ) : (
          <TrendChart
            labels={labels}
            series={[
              {
                label: 'Temperatura media (°C)',
                values: view.days.map((day) => day.temperatureMean),
                color: colors.yellow.primary,
              },
              {
                label: 'Umidade media (%)',
                values: view.days.map((day) => day.humidityMean),
                color: colors.blue.dark,
              },
            ]}
            yLabel="°C / %"
            height={220}
          />
        )}
      </Card>

      <Card
        title="Dia a dia"
        subtitle="Dias com medicoes disponiveis no periodo"
        actions={
          <SegmentedControl<'desc' | 'asc'>
            label="Ordenar por dia"
            value={dayOrder}
            onChange={setDayOrder}
            options={[
              { value: 'desc', label: 'Mais recentes' },
              { value: 'asc', label: 'Mais antigos' },
            ]}
          />
        }
      >
        {tableDays.length === 0 ? (
          <EmptyHint>Sem dias com medicoes no periodo.</EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th className="is-number">Chuva</th>
                  <th className="is-number">ETo</th>
                  <th className="is-number">Balanco</th>
                  <th className="is-number">Temp. med/max</th>
                  <th className="is-number">Umidade med</th>
                  <th className="is-number">Vento med/gust</th>
                  <th className="is-number">Horas</th>
                </tr>
              </thead>
              <tbody>
                {tableDays.map((day) => (
                  <tr key={day.day}>
                    <td className="is-primary">{formatDay(day.day)}</td>
                    <td className="is-number">{formatNumber(day.precipitation, 1)}</td>
                    <td className="is-number">{formatNumber(day.evapotranspiration, 1)}</td>
                    <td className="is-number">{formatNumber(day.waterBalance, 1)}</td>
                    <td className="is-number">
                      {day.temperatureMean === null ? '—' : formatNumber(day.temperatureMean, 1)} /{' '}
                      {formatNumber(day.temperatureMax, 1)}
                    </td>
                    <td className="is-number">
                      {day.humidityMean === null ? (
                        '—'
                      ) : (
                        <>
                          {formatNumber(day.humidityMean, 0)} <Badge tone="blue">{humidityBand(day.humidityMean)}</Badge>
                        </>
                      )}
                    </td>
                    <td className="is-number">
                      {formatNumber(day.windMean, 1)} / {formatNumber(day.windGust, 1)}
                    </td>
                    <td className="is-number">
                      {day.hours}
                      {day.missingHours > 0 && (
                        <span className="climate__missing"> ({day.missingHours} sem leitura)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  )
}
