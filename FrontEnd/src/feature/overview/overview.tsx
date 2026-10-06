import { useMemo } from 'react'
import { useAgro } from '../../data/agroContext'
import { useDerived } from '../../data/useDerived'
import { buildKpis } from '../../data/selectors'
import { Notice, Stat } from '../../core/components/ui'
import { formatDay, formatPercent } from '../../core/utils/format'
import AgroIcon from '../../core/components/agroIcon'
import './overview.css'

export default function Overview() {
  const agro = useAgro()
  const derived = useDerived()

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
    }).filter((kpi) => !['captures', 'battery', 'count-agreement'].includes(kpi.id))
  }, [agro.data, derived])

  return (
    <div className="overview">
      <section aria-label="Indicadores">
        <div className="overview__section-heading">
          <h2>Resumo do período</h2>
          <p>Comparação com o período anterior</p>
        </div>
        <div className="overview__stats">
          {kpis.map((kpi) => (
            <Stat
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              note={kpi.note}
              tone={kpi.tone}
              delta={
                kpi.delta?.percent === null || kpi.delta === undefined
                  ? null
                  : `${kpi.delta.direction === 'up' ? '▲' : kpi.delta.direction === 'down' ? '▼' : '='} ${formatPercent(kpi.delta.percent ?? 0, 0)}`
              }
            />
          ))}
        </div>
        {derived && derived.previousRows.length === 0 && (
          <Notice tone="info" title="Sem dados para comparação">
            Não há registros entre {formatDay(derived.previousWindow.from)} e {formatDay(derived.previousWindow.to)}.
            Os indicadores mostram apenas o período selecionado.
          </Notice>
        )}
      </section>
      <section className="overview__explore" aria-label="Explorar análises">
        <div className="overview__section-heading">
          <h2>Acompanhamento do campo</h2>
        </div>
        <div className="overview__explore-grid">
          <a href="#/tendencias" className="overview__explore-card"><span className="overview__explore-icon"><AgroIcon name="trends" /></span><strong>Tendências</strong><p>Detecções por dia e variação das populações de pragas.</p><small>Consultar histórico</small></a>
          <a href="#/mapa" className="overview__explore-card"><span className="overview__explore-icon"><AgroIcon name="map" /></span><strong>Mapa de armadilhas</strong><p>Localização dos pontos de monitoramento e seus alertas.</p><small>Ver mapa</small></a>
          <a href="#/clima" className="overview__explore-card"><span className="overview__explore-icon"><AgroIcon name="climate" /></span><strong>Condições climáticas</strong><p>Chuva, temperatura e balanço hídrico da propriedade.</p><small>Consultar clima</small></a>
        </div>
      </section>
    </div>
  )
}
