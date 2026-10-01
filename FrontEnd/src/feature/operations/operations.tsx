import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { loadOperationDetail } from '../../data/api'
import { Badge, Card, EmptyHint, Notice, SegmentedControl } from '../../core/components/ui'
import {
  formatArea,
  formatDateTime,
  formatDay,
  formatDistance,
  formatNumber,
  formatPercent,
} from '../../core/utils/format'
import type { MachineOperationSummary, OperationDetailPayload, OperationsIndexPayload } from '../../data/types'
import './operations.css'

/**
 * Operacoes de maquina: ordens de servico, doses e desvios do configurado.
 *
 * O painel separa as duas familias porque elas vem de arquivos diferentes com
 * colunas diferentes: a fertilizacao tem area e dose, a pulverizacao acrescenta
 * pressao — e a pressao e a coluna que vem zerada em toda a base.
 */
export default function Operations() {
  const { data, filters } = useAgro()
  const [kind, setKind] = useState<'fertilization' | 'spray'>('fertilization')

  const index: OperationsIndexPayload | null = data === null ? null : kind === 'fertilization' ? data.fertilization : data.spray

  const [detail, setDetail] = useState<OperationDetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (!index) return []
    return index.operations.filter(
      (operation) => operation.lastAt.slice(0, 10) >= filters.from && operation.firstAt.slice(0, 10) <= filters.to,
    )
  }, [index, filters.from, filters.to])

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, operation) => ({
        segments: sum.segments + operation.segments,
        reportedArea: sum.reportedArea + (operation.reportedAreaHa ?? 0),
        geometryArea: sum.geometryArea + (operation.geometryAreaHa ?? 0),
        zeroDose: sum.zeroDose + operation.zeroDoseSegments,
        below: sum.below + operation.belowConfiguredSegments,
        above: sum.above + operation.aboveConfiguredSegments,
        missingPressure: sum.missingPressure + operation.missingPressureSegments,
        zeroPressure: sum.zeroPressure + operation.zeroPressureSegments,
        farFromFarm: sum.farFromFarm + operation.farFromFarmSegments,
        withReportedArea: sum.withReportedArea + (operation.reportedAreaHa === null ? 0 : 1),
        withGeometryArea: sum.withGeometryArea + (operation.geometryAreaHa === null ? 0 : 1),
      }),
      {
        segments: 0,
        reportedArea: 0,
        geometryArea: 0,
        zeroDose: 0,
        below: 0,
        above: 0,
        missingPressure: 0,
        zeroPressure: 0,
        farFromFarm: 0,
        withReportedArea: 0,
        withGeometryArea: 0,
      },
    )
  }, [rows])

  const openDetail = async (operation: MachineOperationSummary) => {
    if (detail?.serviceOrder === operation.serviceOrder) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setDetail(await loadOperationDetail(operation.file))
    } catch (cause) {
      setDetail(null)
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar os trechos.')
    } finally {
      setLoading(false)
    }
  }

  if (!data || !index) return null

  return (
    <div className="operations">
      <Card
        title={kind === 'fertilization' ? 'Fertilizacao' : 'Pulverizacao'}
        subtitle={`${index.source} · coluna de maquina "${index.machineColumn}" · coluna de operacao "${index.operationColumn}"`}
        actions={
          <SegmentedControl
            label="Tipo de operacao"
            value={kind}
            onChange={(value) => {
              setKind(value)
              setDetail(null)
            }}
            options={[
              { value: 'fertilization', label: 'Fertilizacao' },
              { value: 'spray', label: 'Pulverizacao' },
            ]}
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyHint>Nenhuma ordem de servico no periodo selecionado.</EmptyHint>
        ) : (
          <>
            <div className="operations__totals">
              <span>
                <strong>{formatNumber(rows.length)}</strong> ordem(ns) de servico
              </span>
              <span>
                <strong>{formatNumber(totals.segments)}</strong> trechos
              </span>
              <span>
                area relatada <strong>{formatArea(totals.reportedArea)}</strong> em{' '}
                {formatNumber(totals.withReportedArea)} OS
              </span>
              <span>
                area da geometria <strong>{formatArea(totals.geometryArea)}</strong> em{' '}
                {formatNumber(totals.withGeometryArea)} OS
              </span>
            </div>

            <Notice tone="info" title="Area relatada x area da geometria">
              A coluna de area do arquivo e a soma das areas que a maquina registrou; a area da geometria e calculada do
              poligono do trecho. As duas nao batem por construcao, entao a tela mostra as duas em vez de escolher uma.
            </Notice>

            {kind === 'spray' && (
              <Notice tone="critico" title="Pressao de pulverizacao vem zerada em toda a base">
                {formatNumber(totals.zeroPressure)} de {formatNumber(totals.segments)} trechos tem pressao 0 e{' '}
                {formatNumber(totals.missingPressure)} nao tem o campo. Nao da para avaliar pulverizacao por pressao com
                estes dados; a interface mostra o zero como zero, nunca como "sem pressao".
              </Notice>
            )}

            {totals.farFromFarm > 0 && (
              <Notice tone="atencao" title="Trechos longe da referencia da fazenda">
                {formatNumber(totals.farFromFarm)} trecho(s) estao a mais de{' '}
                {formatDistance(data.manifest.farmReferenceRadiusMeters)} da referencia de{' '}
                {data.manifest.farmReference[1].toFixed(4)}, {data.manifest.farmReference[0].toFixed(4)}. Isso aparece
                como alerta de maquina em <code>machine-alerts.json</code> e nao e ajuste do conversor.
              </Notice>
            )}

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>OS</th>
                    <th>Operacao</th>
                    <th>Maquina / equipe</th>
                    <th>Periodo</th>
                    <th className="is-number">Trechos</th>
                    <th className="is-number">Area relatada</th>
                    <th className="is-number">Area geometria</th>
                    <th className="is-number">Dose aplicada</th>
                    <th className="is-number">vs. configurado</th>
                    <th>Trechos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((operation) => (
                    <tr key={operation.file}>
                      <td className="is-primary">{operation.serviceOrder}</td>
                      <td>
                        {operation.operation}
                        {operation.operationRawSpellings.length > 1 && (
                          <span className="operations__spellings">
                            {operation.operationRawSpellings.length} grafias no arquivo
                          </span>
                        )}
                      </td>
                      <td>
                        {operation.machine ?? '—'}
                        {operation.team && <span className="operations__team">{operation.team}</span>}
                        {operation.operator.name && (
                          <span className="operations__team">{operation.operator.name}</span>
                        )}
                      </td>
                      <td>
                        {formatDay(operation.firstAt.slice(0, 10))} a {formatDay(operation.lastAt.slice(0, 10))}
                      </td>
                      <td className="is-number">{formatNumber(operation.segments)}</td>
                      <td className="is-number">{formatArea(operation.reportedAreaHa)}</td>
                      <td className="is-number">{formatArea(operation.geometryAreaHa)}</td>
                      <td className="is-number">{formatNumber(operation.appliedDoseKgHaWeighted, 2)} kg/ha</td>
                      <td className="is-number">
                        {formatPercent(operation.appliedVsConfiguredPct)}
                        {operation.appliedVsConfiguredPct !== null && Math.abs(operation.appliedVsConfiguredPct) > 10 && (
                          <Badge tone="yellow">desvio</Badge>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          disabled={loading}
                          onClick={() => void openDetail(operation)}
                        >
                          {loading && detail?.serviceOrder !== operation.serviceOrder
                            ? 'Abrindo...'
                            : detail?.serviceOrder === operation.serviceOrder
                              ? 'Fechar'
                              : 'Abrir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {detail && <OperationSegments detail={detail} />}

      {error && (
        <Notice tone="critico" title="Nao foi possivel carregar os trechos">
          {error}
        </Notice>
      )}

      <Card title="Nomes de operacao no arquivo" subtitle="Como o mesmo nome aparece escrito no CSV">
        {Object.keys(index.operationSpellings).length === 0 ? (
          <EmptyHint>Nenhuma grafia registrada.</EmptyHint>
        ) : (
          <div className="operations__spellings-grid">
            {Object.entries(index.operationSpellings).map(([normalized, spellings]) => (
              <div key={normalized}>
                <h4 className="operations__spellings-title">{normalized}</h4>
                <ul>
                  {spellings.map((spelling) => (
                    <li key={spelling}>{spelling}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

/** Trechos da ordem de servico aberta. */
function OperationSegments({ detail }: { detail: OperationDetailPayload }) {
  const pressureKnown = detail.paths.some((path) => path.pressure !== null)
  const pointsByTime = new Map(detail.paths.map((path) => [path.at, path.coordinates.length]))

  return (
    <Card
      title={`Trechos da OS ${detail.serviceOrder}`}
      subtitle={`${formatNumber(detail.segments.length)} trechos · ${detail.days.join(', ')}`}
      tone="quiet"
    >
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th className="is-number">Area</th>
              <th className="is-number">Dose aplicada</th>
              <th className="is-number">Dose configurada</th>
              <th className="is-number">Peso</th>
              {pressureKnown && <th className="is-number">Pressao (psi)</th>}
              <th className="is-number">Pontos</th>
              <th className="is-number">Linha</th>
            </tr>
          </thead>
          <tbody>
            {detail.segments.map((segment) => (
              <tr key={`${segment.sourceRow}-${segment.at}`}>
                <td className="is-primary">{formatDateTime(segment.at)}</td>
                <td className="is-number">{formatArea(segment.areaHa)}</td>
                <td className="is-number">{formatNumber(segment.appliedDoseKgHa, 2)}</td>
                <td className="is-number">{formatNumber(segment.configuredDoseKgHa, 2)}</td>
                <td className="is-number">{formatNumber(segment.weightKg, 1)}</td>
                {pressureKnown && (
                  <td className="is-number">
                    {segment.pressurePsi === null ? (
                      <span className="operations__absent">sem campo</span>
                    ) : (
                      <>
                        {formatNumber(segment.pressurePsi, 1)}
                        {segment.pressurePsi === 0 && <span className="operations__absent"> zerado na origem</span>}
                      </>
                    )}
                  </td>
                )}
                <td className="is-number">{formatNumber(pointsByTime.get(segment.at) ?? null)}</td>
                <td className="is-number">{formatDistance(segment.distanceMeters)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}