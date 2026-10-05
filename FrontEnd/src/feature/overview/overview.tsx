import { useMemo } from 'react'
import { useAgro } from '../../data/agroContext'
import { useDerived } from '../../data/useDerived'
import { buildKpis } from '../../data/selectors'
import { Notice, Stat } from '../../core/components/ui'
import { formatDay, formatPercent } from '../../core/utils/format'
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
          <div><span className="overview__section-kicker">01 / PANORAMA</span><h2>O campo em números</h2></div>
          <p>Indicadores calculados para o período selecionado.</p>
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
          <Notice tone="info" title="Sem periodo anterior para comparar">
            O intervalo anterior ({formatDay(derived.previousWindow.from)} a {formatDay(derived.previousWindow.to)}) nao
            tem serie, entao os indicadores aparecem sem variacao.
          </Notice>
        )}
      </section>
      <section className="overview__explore" aria-label="Explorar análises">
        <div className="overview__section-heading">
          <div><span className="overview__section-kicker">02 / EXPLORAR</span><h2>Vá além do panorama</h2></div>
          <p>Escolha uma perspectiva para aprofundar a análise.</p>
        </div>
        <div className="overview__explore-grid">
          <a href="#/tendencias" className="overview__explore-card"><span>01 / EVOLUÇÃO</span><strong>Tendências</strong><p>Como as detecções mudaram ao longo dos dias.</p><b aria-hidden="true">↗</b></a>
          <a href="#/mapa" className="overview__explore-card"><span>02 / TERRITÓRIO</span><strong>Mapa</strong><p>Onde estão as armadilhas e os alertas do campo.</p><b aria-hidden="true">↗</b></a>
          <a href="#/clima" className="overview__explore-card"><span>03 / CONTEXTO</span><strong>Clima</strong><p>As condições ambientais por trás dos números.</p><b aria-hidden="true">↗</b></a>
        </div>
      </section>
    </div>
  )
}
