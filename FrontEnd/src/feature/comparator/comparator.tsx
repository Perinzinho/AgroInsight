import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { useDerived } from '../../data/useDerived'
import { detectionsByPest, variation } from '../../data/selectors'
import TrendChart from '../trendChart/trendChart'
import { Card, EmptyHint, Notice } from '../../core/components/ui'
import { formatDay, formatNumber, formatPercent } from '../../core/utils/format'
import { buildComparisonChart } from './comparisonChart'
import './comparator.css'

type Dimension = 'traps' | 'pests'

/**
 * Comparador lado a lado.
 *
 * Compara apenas entidades que existem no mesmo conjunto filtrado. Onde nao ha
 * serie, a celula fica vazia com o motivo ("sem dado no periodo") em vez de
 * virar zero, que leria como "nao teve praga".
 */
export default function Comparator() {
  const { data, filters } = useAgro()
  const derived = useDerived()
  const [dimension, setDimension] = useState<Dimension>('traps')

  const ranking = useMemo(() => derived?.ranking ?? [], [derived])
  const byPest = useMemo(() => derived?.byPest ?? [], [derived])

  const options = useMemo(() => {
    if (dimension === 'traps') return ranking.map((row) => ({ value: row.trapCode, label: row.trapCode }))
    return byPest.map((row) => ({ value: row.pestKey, label: row.pestName }))
  }, [dimension, ranking, byPest])

  const active = useMemo(() => options.map((option) => option.value), [options])

  const chart = useMemo(() => {
    if (!data || !derived) return null
    return buildComparisonChart({
      rows: derived.rows,
      days: derived.days,
      coverage: data.manifest.coverage.events.range,
      dimension,
      options,
      pestKeys: derived.pestKeys,
    })
  }, [data, derived, dimension, options])

  if (!data || !derived || !chart) return null

  return (
    <div className="comparator">
      <Card
        title="Comparador"
        subtitle={`${formatDay(filters.from)} a ${formatDay(filters.to)}`}
        actions={
          <div className="comparator__tabs" role="group" aria-label="O que comparar">
            <button
              type="button"
              className={`chip ${dimension === 'traps' ? 'is-active' : ''}`}
              aria-pressed={dimension === 'traps'}
              onClick={() => setDimension('traps')}
            >
              Por armadilha
            </button>
            <button
              type="button"
              className={`chip ${dimension === 'pests' ? 'is-active' : ''}`}
              aria-pressed={dimension === 'pests'}
              onClick={() => setDimension('pests')}
            >
              Por praga
            </button>
          </div>
        }
      >
        {options.length === 0 ? (
          <EmptyHint>Nada para comparar no filtro atual.</EmptyHint>
        ) : (
          <>
            <p className="comparator__coverage">
              {options.length} {dimension === 'traps' ? 'armadilhas' : 'pragas'} · Capturas de {formatDay(chart.days[0])} a {formatDay(chart.days[chart.days.length - 1])}.
              {' '}Passe sobre os pontos para identificar cada série. Dias sem captura aparecem como lacunas.
            </p>
            <TrendChart labels={chart.labels} series={chart.series} yLabel="Detecções" height={360} showLegend={false} interactionMode="nearest" ariaLabel={`Comparação de detecções por ${dimension === 'traps' ? 'armadilha' : 'praga'}`} />
          </>
        )}
      </Card>

      {dimension === 'pests' && (
        <Card title="Pragas lado a lado" subtitle="Contagem por praga e o que o catalogo diz sobre ela">
          {active.length === 0 ? (
            <EmptyHint>Nenhuma praga no período selecionado.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medida</th>
                    {active.map((pestKey) => (
                      <th key={pestKey} className="is-number">
                        {byPest.find((row) => row.pestKey === pestKey)?.pestName ?? pestKey}
                      </th>
                    ))}
                    <th className="is-number">Maior - menor</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Caixas"
                    values={active.map((pestKey) => detectionsByPest(derived.rows, [pestKey])[0]?.detections ?? null)}
                  />
                  <CompareRow
                    label="Capturas"
                    values={active.map((pestKey) => detectionsByPest(derived.rows, [pestKey])[0]?.captures ?? null)}
                  />
                  <CompareRow
                    label="Confianca media"
                    decimals={2}
                    values={active.map(
                      (pestKey) => {
                        const value = detectionsByPest(derived.rows, [pestKey])[0]?.meanConfidence ?? null
                        return value === null ? null : value * 100
                      },
                    )}
                  />
                  <tr>
                    <td>Limiar de alerta</td>
                    {active.map((pestKey) => {
                      const group = data.pests.groups.find((item) => item.key === pestKey)
                      const variant = group?.variants.find((item) => item.culture === derived.trapCulture)
                      return (
                        <td key={pestKey} className="is-number">
                          {formatNumber(variant?.thresholds.alert ?? null)}
                        </td>
                      )
                    })}
                    <td className="is-number">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Notice tone="info" title="Como ler a comparação">
        As contagens vêm das detecções nas imagens, sem ajuste por área ou intensidade de amostragem.
        Uma captura sem detecções vale zero; um dia sem captura fica sem valor.
      </Notice>
    </div>
  )
}

/** Linha com o texto e o spread entre o maior e o menor valor. */
function CompareRow({
  label,
  values,
  decimals = 0,
  text = false,
}: {
  label: string
  values: (number | string | null)[]
  decimals?: number
  text?: boolean
}) {
  const numbers = values.filter((value): value is number => typeof value === 'number')
  const max = numbers.length > 0 ? Math.max(...numbers) : null
  const min = numbers.length > 0 ? Math.min(...numbers) : null
  const spread = max !== null && min !== null && max !== min ? variation(max, min, min > 0) : null

  return (
    <tr>
      <td>{label}</td>
      {values.map((value, index) => (
        <td key={index} className="is-number">
          {value === null ? (
            <span className="comparator__absent">sem dado</span>
          ) : text ? (
            value
          ) : (
            formatNumber(value as number, decimals)
          )}
        </td>
      ))}
      <td className="is-number">
        {spread?.percent === null || spread === null
          ? '—'
          : `${formatPercent(spread.percent, 0)}${min === 0 ? ' (base 0)' : ''}`}
      </td>
    </tr>
  )
}
