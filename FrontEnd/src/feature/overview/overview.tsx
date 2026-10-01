import { useMemo } from 'react'
import { useAgro } from '../../data/agroContext'
import { TONE_BY_SEVERITY, useDerived } from '../../data/useDerived'
import { buildKpis, pestDistribution } from '../../data/selectors'
import { Badge, Card, DataState, EmptyHint, Notice, Stat } from '../../core/components/ui'
import { formatDay, formatNumber, formatPercent } from '../../core/utils/format'
import './overview.css'

/**
 * Visao geral: o que pedir atencao agora e por que.
 *
 * A ordem das secoes segue o plano de leitura: primeiro os indicadores, depois a
 * fila de prioridades com a prova em tres camadas, e so entao a distribuicao e o
 * ranking que explicam os numeros.
 */
export default function Overview({ focus }: { focus?: 'alerts' }) {
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
    })
  }, [agro.data, derived])

  const distribution = useMemo(() => {
    if (!agro.data || !derived) return []
    return pestDistribution(derived.byPest, agro.data.pests.groups, derived.trapCulture)
  }, [agro.data, derived])

  if (focus === 'alerts') {
    return <PriorityQueue />
  }

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

      <PriorityQueue />

      <section className="overview__split">
        <Card title="Distribuicao por praga" subtitle="Caixas detectadas no periodo, com a severidade contra pest_list.csv">
          {distribution.length === 0 ? (
            <EmptyHint>Nenhuma praga com deteccao no periodo selecionado.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Praga</th>
                    <th className="is-number">Caixas</th>
                    <th>Nivel</th>
                    <th>Limiar a/c/d</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.map((row) => (
                    <tr key={row.pestKey}>
                      <td className="is-primary">
                        {row.pestName}
                        {row.cultureMismatch && (
                          <Badge tone="yellow" title={row.note}>
                            cultura nao encontrada
                          </Badge>
                        )}
                      </td>
                      <td className="is-number">{formatNumber(row.detections)}</td>
                      <td>
                        <Badge tone={TONE_BY_SEVERITY[row.severity]}>{row.levelLabel}</Badge>
                      </td>
                      <td className="is-number">
                        {row.thresholds.alert ?? '-'}/{row.thresholds.control ?? '-'}/{row.thresholds.damage ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Armadilhas por volume" subtitle="Ordenadas pelas caixas do periodo filtrado">
          {derived === null || derived.ranking.length === 0 ? (
            <EmptyHint>Nenhuma armadilha com serie no periodo selecionado.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Armadilha</th>
                    <th className="is-number">Caixas</th>
                    <th className="is-number">Media/dia</th>
                    <th>Praga dominante</th>
                    <th>Severidade</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.ranking.map((row) => (
                    <tr key={row.trapCode}>
                      <td className="is-primary">
                        <a className="inline-link" href={`#/armadilha/${row.trapCode}`}>
                          {row.trapCode}
                        </a>
                      </td>
                      <td className="is-number">{formatNumber(row.detections)}</td>
                      <td className="is-number">{formatNumber(row.meanPerDay, 1)}</td>
                      <td>{row.topPest ?? '—'}</td>
                      <td>
                        <Badge tone={TONE_BY_SEVERITY[row.severity]}>
                          {row.severity === 'unknown' ? 'sem limiar' : row.level === 'below' ? 'abaixo' : row.level}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}

/**
 * Fila de prioridades.
 *
 * Cada item so aparece quando ha uma camada que realmente sustenta a afirmacao:
 * captura, contagem acima do limiar e contexto. Camadas ausentes aparecem
 * declaradas como ausentes, nunca preenchidas com estimativa.
 */
function PriorityQueue() {
  const agro = useAgro()
  const derived = useDerived()

  const evidence = derived?.evidence ?? []

  return (
    <Card
      title="Prioridades do periodo"
      subtitle="Pragas que cruzaram um limiar de pest_list.csv, com a prova em tres camadas"
      actions={
        <a className="inline-link" href="#/alertas">
          Ver alertas ({evidence.length})
        </a>
      }
    >
      <DataState status={agro.status} error={agro.error} onRetry={agro.reload} empty={evidence.length === 0}>
        <ol className="priority">
          {evidence.map((item) => (
            <li className="priority__item" key={item.pestKey}>
              <div className="priority__head">
                <span className={`priority__marker priority__marker--${TONE_BY_SEVERITY[item.severity]}`} aria-hidden="true" />
                <div>
                  <h4 className="priority__title">{item.pestName}</h4>
                  <p className="priority__meta">{item.title}</p>
                </div>
                <Badge tone={TONE_BY_SEVERITY[item.severity]}>{item.severity}</Badge>
              </div>

              <ol className="proof">
                {item.layers.map((layer) => (
                  <li className={`proof__step ${layer.available ? '' : 'proof__step--missing'}`} key={layer.id}>
                    <span className="proof__index">{layer.label}</span>
                    <div>
                      <p className="proof__summary">
                        {layer.summary}
                        {!layer.available && <span className="proof__missing"> — camada indisponivel</span>}
                      </p>
                      <p className="proof__detail">{layer.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </DataState>
    </Card>
  )
}