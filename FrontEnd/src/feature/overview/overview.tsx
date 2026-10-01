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
    </div>
  )
}
