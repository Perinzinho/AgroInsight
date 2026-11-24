import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { useDerived } from '../../data/useDerived'
import { buildKpis, climateContext, dailySeries } from '../../data/selectors'
import { Card, EmptyHint, Notice, SegmentedControl, Stat } from '../../core/components/ui'
import { formatDay, formatDayShort, formatNumber, formatPercent } from '../../core/utils/format'
import { colors } from '../../core/theme/colors'
import AgroIcon, { type AgroIconName } from '../../core/components/agroIcon'
import TrendChart from '../trendChart/trendChart'
import './overview.css'

const KPI_PRESENTATION: Record<string, { label: string; icon: AgroIconName }> = {
  detections: { label: 'Detecções no período', icon: 'pests' },
  'pests-at-level': { label: 'Pragas em nível de alerta', icon: 'machine' },
  'trap-coverage': { label: 'Armadilhas com registros', icon: 'trap' },
}

export default function Overview() {
  const agro = useAgro()
  const derived = useDerived()
  const [chartMode, setChartMode] = useState<'detections' | 'captures'>('detections')

  const kpis = useMemo(() => {
    if (!agro.data || !derived) return []
    return buildKpis({
      rows: derived.rows,
      previousRows: derived.previousRows,
      pestKeys: derived.pestKeys,
      groups: agro.data.pests.groups,
      captures: derived.counts.captures,
      images: derived.counts.images,
      divergentEvents: derived.counts.divergentEvents,
      trapCulture: derived.trapCulture,
    }).filter((kpi) => kpi.id in KPI_PRESENTATION)
  }, [agro.data, derived])

  const chart = useMemo(() => {
    if (!derived) return null
    const points = dailySeries(derived.rows, derived.days, derived.pestKeys)
    return {
      labels: points.map((point) => formatDayShort(point.day)),
      series: [{
        label: chartMode === 'detections' ? 'Detecções' : 'Capturas de imagem',
        values: points.map((point) => point.captures === 0 && point.detections === 0 ? null : point[chartMode]),
        color: colors.green.primary,
        fill: true,
        tension: .32,
      }],
    }
  }, [derived, chartMode])

  const weather = useMemo(() => agro.data
    ? climateContext(agro.data.climate.days, agro.filters.from, agro.filters.to)
    : null, [agro.data, agro.filters.from, agro.filters.to])

  if (!agro.data || !derived || !chart || !weather) return null
  const topTraps = derived.ranking.slice(0, 5)
  const highestLoad = topTraps[0]?.detections ?? 0

  return (
    <div className="overview">
      <section aria-label="Indicadores">
        <div className="overview__section-heading">
          <h2>O período em números</h2>
          <span>Comparado ao período anterior</span>
        </div>
        <div className="overview__stats" aria-live="polite" aria-atomic="true">
          {kpis.map((kpi) => (
            <Stat
              key={kpi.id}
              label={KPI_PRESENTATION[kpi.id].label}
              icon={<AgroIcon name={KPI_PRESENTATION[kpi.id].icon} />}
              value={kpi.value}
              note={kpi.note}
              tone={kpi.tone}
              delta={kpi.delta?.percent == null ? null : `${kpi.delta.direction === 'up' ? '+' : ''}${formatPercent(kpi.delta.percent, 0)} vs. anterior`}
            />
          ))}
        </div>
        {derived.previousRows.length === 0 && (
          <Notice tone="info" title="Sem dados para comparação">
            Não há registros entre {formatDay(derived.previousWindow.from)} e {formatDay(derived.previousWindow.to)}.
            Os indicadores mostram apenas o período selecionado.
          </Notice>
        )}
      </section>

      <div className="overview__analysis">
        <Card
          title="O ritmo do campo"
          subtitle="Evolução diária nas armadilhas monitoradas"
          actions={<SegmentedControl<'detections' | 'captures'> label="Indicador do gráfico" value={chartMode} onChange={setChartMode} options={[{ value: 'detections', label: 'Detecções' }, { value: 'captures', label: 'Capturas' }]} />}
        >
          {derived.rows.length === 0 ? <EmptyHint>Não há registros de armadilhas neste período. Selecione outro intervalo para consultar o histórico.</EmptyHint> : (
            <TrendChart labels={chart.labels} series={chart.series} height={215} showLegend={false} ariaLabel={`${chartMode === 'detections' ? 'Detecções' : 'Capturas de imagem'} por dia no período selecionado`} />
          )}
          <div className="overview__chart-footer"><span><i />{chartMode === 'detections' ? 'Caixas detectadas por dia' : 'Capturas de imagem por dia'}</span><a href="#/tendencias">Ver tendências <AgroIcon name="arrowUpRight" width="14" height="14" /></a></div>
        </Card>
        <section className="overview__weather" aria-labelledby="weather-title">
          <header className="overview__weather-head"><h2 id="weather-title">Clima no período</h2><AgroIcon name="climate" width="25" height="25" /></header>
          {weather.days.length === 0 ? <EmptyHint>A estação não tem medições neste período. Consulte a cobertura na tela de clima.</EmptyHint> : <>
            <div className="overview__temperature"><AgroIcon name="sun" width="38" height="38" /><div><strong>{formatNumber(weather.meanTemperature, 1)}<span> °C</span></strong><p>Temperatura média</p></div></div>
            <dl className="overview__weather-values">
              <div><dt><AgroIcon name="rain" width="17" height="17" /> Chuva acumulada</dt><dd>{formatNumber(weather.totalPrecipitation, 1)} <span>mm</span></dd></div>
              <div><dt><AgroIcon name="droplet" width="17" height="17" /> Umidade média</dt><dd>{formatNumber(weather.meanHumidity, 0)} <span>%</span></dd></div>
              <div><dt><AgroIcon name="wind" width="17" height="17" /> Rajada máxima</dt><dd>{formatNumber(weather.maxWindGust, 1)} <span>km/h</span></dd></div>
            </dl>
          </>}
          <a className="overview__weather-link" href="#/clima">Consultar condições climáticas <AgroIcon name="arrowUpRight" width="15" height="15" /></a>
        </section>
      </div>

      <section className="overview__monitoring" aria-labelledby="monitoring-title">
        <div className="overview__section-heading"><div><h2 id="monitoring-title">De olho nas armadilhas</h2><p>Os cinco pontos com mais detecções no período.</p></div><a className="overview__text-link" href="#/armadilha">Todas as armadilhas <AgroIcon name="arrowUpRight" width="15" height="15" /></a></div>
        {topTraps.length === 0 ? <Notice title="Nenhuma armadilha com registros">Experimente ampliar o período para consultar as detecções da propriedade.</Notice> : <div className="overview__ranking table-wrap">
          <table className="data-table">
            <thead><tr><th>Armadilha</th><th>Praga mais frequente</th><th className="is-number">Detecções</th><th><span className="overview__sr-only">Investigar</span></th></tr></thead>
            <tbody>{topTraps.map((trap) => <tr key={trap.trapCode}>
              <td className="is-primary"><a className="overview__trap-link" href={`#/armadilha/${encodeURIComponent(trap.trapCode)}`}><span className="overview__trap-icon"><AgroIcon name="trap" width="16" height="16" /></span><span>{trap.trapCode}<small className="overview__mobile-pest">{trap.topPest ?? 'Sem detecções'}</small></span></a></td>
              <td>{trap.topPest ?? 'Sem detecções'}</td>
              <td className="is-number"><div className="overview__load"><span className="overview__load-track" aria-hidden="true"><span style={{ width: `${highestLoad > 0 ? trap.detections / highestLoad * 100 : 0}%` }} /></span><strong>{formatNumber(trap.detections)}</strong></div></td>
              <td><a className="overview__investigate" href={`#/armadilha/${encodeURIComponent(trap.trapCode)}`} aria-label={`Investigar armadilha ${trap.trapCode}`}><AgroIcon name="arrowUpRight" width="17" height="17" /></a></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      <a href="#/recomendacao-ia" className="overview__recommendation"><span className="overview__recommendation-icon"><AgroIcon name="recommendations" width="25" height="25" /></span><div><strong>Transforme a leitura em próximos passos.</strong><p>Consulte as recomendações com base nos indicadores da propriedade.</p></div><span className="overview__recommendation-action">Ver recomendações <AgroIcon name="arrowUpRight" width="19" height="19" /></span></a>
      <nav className="overview__explore" aria-label="Explorar análises"><a href="#/tendencias"><AgroIcon name="trends" />Histórico de detecções<AgroIcon name="chevron" width="14" height="14" /></a><a href="#/mapa"><AgroIcon name="map" />Mapa de armadilhas<AgroIcon name="chevron" width="14" height="14" /></a><a href="#/clima"><AgroIcon name="climate" />Condições climáticas<AgroIcon name="chevron" width="14" height="14" /></a></nav>
    </div>
  )
}
