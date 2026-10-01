import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { useDerived } from '../../data/useDerived'
import { dailySeries, detectionsByPest, variation } from '../../data/selectors'
import { colors } from '../../core/theme/colors'
import TrendChart from '../trendChart/trendChart'
import { Badge, Card, EmptyHint, Notice } from '../../core/components/ui'
import { TONE_BY_SEVERITY } from '../../data/useDerived'
import { formatDay, formatDayShort, formatNumber, formatPercent, trapTypeLabel } from '../../core/utils/format'
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
  const [picked, setPicked] = useState<string[]>([])

  const ranking = useMemo(() => derived?.ranking ?? [], [derived])
  const byPest = useMemo(() => derived?.byPest ?? [], [derived])

  const options = useMemo(() => {
    if (dimension === 'traps') return ranking.map((row) => ({ value: row.trapCode, label: row.trapCode }))
    return byPest.map((row) => ({ value: row.pestKey, label: row.pestName }))
  }, [dimension, ranking, byPest])

  const selected = picked.filter((value) => options.some((option) => option.value === value))
  const active = selected.length > 0 ? selected : options.slice(0, 3).map((option) => option.value)

  const chart = useMemo(() => {
    if (!derived) return null
    return {
      labels: derived.days.map((day) => formatDayShort(day)),
      series:
        dimension === 'traps'
          ? active.map((trapCode, index) => {
              const points = dailySeries(
                derived.rows.filter((row) => row.trapCode === trapCode),
                derived.days,
                derived.pestKeys,
              )
              return {
                label: trapCode,
                values: points.map((point) => (point.captures === 0 && point.detections === 0 ? null : point.detections)),
                color: colors.chart[index % colors.chart.length],
              }
            })
          : active.map((pestKey, index) => {
              const points = dailySeries(derived.rows, derived.days, [pestKey])
              return {
                label: pestKey,
                values: points.map((point) => (point.captures === 0 && point.detections === 0 ? null : point.detections)),
                color: colors.chart[index % colors.chart.length],
              }
            }),
    }
  }, [derived, dimension, active])

  if (!data || !derived || !chart) return null

  const trapByCode = new Map(data.traps.traps.map((trap) => [trap.trapCode, trap]))

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
              onClick={() => {
                setDimension('traps')
                setPicked([])
              }}
            >
              Por armadilha
            </button>
            <button
              type="button"
              className={`chip ${dimension === 'pests' ? 'is-active' : ''}`}
              onClick={() => {
                setDimension('pests')
                setPicked([])
              }}
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
            <div className="comparator__picker">
              {options.map((option) => {
                const isActive = active.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`chip ${isActive ? 'is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() =>
                      setPicked((current) => {
                        const next = current.includes(option.value)
                          ? current.filter((value) => value !== option.value)
                          : [...current, option.value]
                        return next.length === 0 ? picked.filter((value) => value !== option.value) : next
                      })
                    }
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="comparator__hint">
              Marcados entram no grafico. Sem selecao, comparamos as {Math.min(3, options.length)} primeiras.
            </p>

            <TrendChart labels={chart.labels} series={chart.series} yLabel="caixas" height={260} />
          </>
        )}
      </Card>

      {dimension === 'traps' && (
        <Card title="Armadilhas lado a lado" subtitle="Mesmos dias, mesmas pragas, numeros lado a lado">
          {active.length === 0 ? (
            <EmptyHint>Selecione ao menos uma armadilha.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medida</th>
                    {active.map((trapCode) => (
                      <th key={trapCode} className="is-number">
                        {trapCode}
                      </th>
                    ))}
                    <th className="is-number">Maior - menor</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Caixas"
                    values={active.map((trapCode) => ranking.find((row) => row.trapCode === trapCode)?.detections ?? null)}
                  />
                  <CompareRow
                    label="Capturas"
                    values={active.map((trapCode) => ranking.find((row) => row.trapCode === trapCode)?.captures ?? null)}
                  />
                  <CompareRow
                    label="Media por dia"
                    decimals={1}
                    values={active.map((trapCode) => ranking.find((row) => row.trapCode === trapCode)?.meanPerDay ?? null)}
                  />
                  <CompareRow
                    label="Praga dominante"
                    text
                    values={active.map((trapCode) => ranking.find((row) => row.trapCode === trapCode)?.topPest ?? null)}
                  />
                  <tr>
                    <td>Severidade</td>
                    {active.map((trapCode) => {
                      const severity = ranking.find((row) => row.trapCode === trapCode)?.severity ?? 'unknown'
                      return (
                        <td key={trapCode} className="is-number">
                          <Badge tone={TONE_BY_SEVERITY[severity]}>{severity}</Badge>
                        </td>
                      )
                    })}
                    <td className="is-number">—</td>
                  </tr>
                  <tr>
                    <td>Tipo</td>
                    {active.map((trapCode) => (
                      <td key={trapCode} className="is-number">
                        {trapTypeLabel(trapByCode.get(trapCode)?.type ?? null)}
                      </td>
                    ))}
                    <td className="is-number">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {dimension === 'pests' && (
        <Card title="Pragas lado a lado" subtitle="Contagem por praga e o que o catalogo diz sobre ela">
          {active.length === 0 ? (
            <EmptyHint>Selecione ao menos uma praga.</EmptyHint>
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

      <Notice tone="info" title="O que este comparador nao faz">
        Nao ha ajuste por area, por cultivar ou por intensidade de amostragem nos arquivos de origem, entao a comparacao
        entre armadilhas e uma leitura direta de caixas. Onde a contagem e igual a zero por falta de dado, a celula fica
        marcada como ausencia, nunca como "0 caixas".
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