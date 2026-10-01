import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { UNCLASSIFIED } from '../../data/selectors'
import { Badge, Card, EmptyHint, Notice, Stat } from '../../core/components/ui'
import {
  formatDistance,
  formatDuration,
  formatNumber,
  formatTime,
} from '../../core/utils/format'
import './machine.css'

type Bucket = 'todos' | 'fora' | 'produtivo' | 'manutencao' | 'sem-classificacao'

/**
 * Alertas de maquina e motivos de parada.
 *
 * A classificacao do motivo nunca aparece como fato: cada linha mostra como o
 * motivo foi ligado (`classificationBasis`). Quem nao teve ligacao fica como
 * "sem classificacao", e nao como "manutencao" por padrao.
 */
export default function Machine() {
  const { data, filters } = useAgro()
  const [bucket, setBucket] = useState<Bucket>('todos')

  const rows = useMemo(() => {
    if (!data) return []
    return data.machineAlerts.alerts
      .filter((alert) => alert.day >= filters.from && alert.day <= filters.to)
      .filter((alert) => {
        switch (bucket) {
          case 'fora':
            return alert.outOfProperty
          case 'produtivo':
            return alert.classification === 'EVENT_TYPE_PRODUCTIVE'
          case 'manutencao':
            return alert.classification === 'EVENT_TYPE_MAINTENANCE'
          case 'sem-classificacao':
            return alert.classification === UNCLASSIFIED || alert.classificationBasis === null
          case 'todos':
            return true
        }
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [data, filters.from, filters.to, bucket])

  const stats = useMemo(() => {
    if (!data) return null
    const inPeriod = data.machineAlerts.alerts.filter(
      (alert) => alert.day >= filters.from && alert.day <= filters.to,
    )
    return {
      total: inPeriod.length,
      outOfProperty: inPeriod.filter((alert) => alert.outOfProperty).length,
      unclassified: inPeriod.filter((alert) => alert.classificationBasis === null).length,
      byBasis: inPeriod.reduce<Record<string, number>>((sum, alert) => {
        const key = alert.classificationBasis ?? 'sem ligacao'
        sum[key] = (sum[key] ?? 0) + 1
        return sum
      }, {}),
    }
  }, [data, filters.from, filters.to])

  if (!data || !stats) return null

  const radius = data.manifest.farmReferenceRadiusMeters

  return (
    <div className="machine">
      <div className="machine__stats">
        <Stat label="Alertas no periodo" value={formatNumber(stats.total)} note="linhas de LAYER_MAP_PARAMETERIZED_ALERT.csv" tone="blue" />
        <Stat
          label="Fora da referencia"
          value={formatNumber(stats.outOfProperty)}
          note={`a mais de ${formatDistance(radius)} da referencia`}
          tone={stats.outOfProperty > 0 ? 'red' : 'green'}
        />
        <Stat
          label="Sem ligacao de motivo"
          value={formatNumber(stats.unclassified)}
          note="motivo nao casa nem por nome exato nem por familia"
          tone={stats.unclassified > 0 ? 'yellow' : 'green'}
        />
        <Stat
          label="Por nome exato"
          value={formatNumber(stats.byBasis['exact-activity-name'] ?? 0)}
          note="operation casa com o nome de uma atividade"
          tone="neutral"
        />
        <Stat
          label="Por familia de operacao"
          value={formatNumber(stats.byBasis['operation-family'] ?? 0)}
          note="operation casa com um padrao de nome"
          tone="neutral"
        />
      </div>

      {data.machineAlerts.note && (
        <Notice tone="info" title="Nota do proprio conversor">
          {data.machineAlerts.note}
        </Notice>
      )}

      <Card
        title="Alertas de maquina"
        subtitle={`${formatNumber(rows.length)} exibido(s) de ${formatNumber(stats.total)} no periodo`}
        actions={
          <div className="machine__filters" role="group" aria-label="Filtro de alertas">
            {(
              [
                ['todos', 'Todos'],
                ['fora', 'Fora da referencia'],
                ['produtivo', 'Produto'],
                ['manutencao', 'Manutencao'],
                ['sem-classificacao', 'Sem ligacao'],
              ] as [Bucket, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${bucket === value ? 'is-active' : ''}`}
                onClick={() => setBucket(value)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyHint>Nenhum alerta com esse filtro no periodo selecionado.</EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Maquina</th>
                  <th>Alerta</th>
                  <th className="is-number">Valor</th>
                  <th className="is-number">Duracao</th>
                  <th>Operacao</th>
                  <th>Motivo de parada</th>
                  <th>Classificacao</th>
                  <th className="is-number">Longe</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 400).map((alert) => (
                  <tr key={alert.alertId} className={alert.outOfProperty ? 'machine__row--out' : undefined}>
                    <td className="is-primary">
                      {formatTime(alert.at)}
                      <span className="machine__day">{alert.day}</span>
                    </td>
                    <td>
                      {alert.machine ?? '—'}
                      {alert.operator.name && <span className="machine__sub">{alert.operator.name}</span>}
                    </td>
                    <td>{alert.alert ?? '—'}</td>
                    <td className="is-number">{formatNumber(alert.value, 2)}</td>
                    <td className="is-number">{formatDuration(alert.durationSeconds)}</td>
                    <td>
                      {alert.operation ?? '—'}
                      {alert.serviceOrder && <span className="machine__sub">OS {alert.serviceOrder}</span>}
                    </td>
                    <td>
                      {alert.stopReasons.length === 0 ? (
                        <span className="machine__absent">sem motivo</span>
                      ) : (
                        alert.stopReasons
                          .map((reason) => `${reason.name}${reason.productive ? '' : ' (improdutivo)'}`)
                          .join(', ')
                      )}
                    </td>
                    <td>
                      <Badge tone={classificationTone(alert.classificationBasis, alert.classification)}>
                        {alert.classifiedActivity ?? alert.classification}
                      </Badge>
                      <span className="machine__basis">{BASIS_LABEL[alert.classificationBasis ?? 'sem-ligacao']}</span>
                    </td>
                    <td className="is-number">
                      {formatDistance(alert.distanceFromFarmMeters)}
                      {alert.outOfProperty && <Badge tone="red">fora</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 400 && (
          <p className="machine__more">
            Mostrando os 400 alertas mais recentes de {formatNumber(rows.length)}. Reduza o periodo ou use os filtros
            acima para ver o resto.
          </p>
        )}
      </Card>

      <Card title="Tipos de alerta" subtitle="Como o conversor leu a coluna de alerta">
        {Object.keys(data.machineAlerts.alertTypes).length === 0 ? (
          <EmptyHint>Nenhum tipo de alerta no arquivo.</EmptyHint>
        ) : (
          <div className="machine__buckets">
            {Object.entries(data.machineAlerts.alertTypes).map(([type, count]) => (
              <div key={type} className="machine__bucket">
                <span className="machine__bucket-label">{type}</span>
                <span className="machine__bucket-count">{formatNumber(count)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Regras de ligacao de motivo" subtitle="Como operation virou atividade no stop_reasons.csv">
        {data.stopReasons.operationFamilyMapping.length === 0 ? (
          <EmptyHint>Nenhuma familia de operacao mapeada.</EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Atividade</th>
                  <th>Padrao no nome da operacao</th>
                  <th>Motivos aceitos</th>
                </tr>
              </thead>
              <tbody>
                {data.stopReasons.operationFamilyMapping.map((rule) => (
                  <tr key={rule.activityName}>
                    <td className="is-primary">{rule.activityName}</td>
                    <td>
                      <code>{rule.match}</code>
                    </td>
                    <td>
                      {rule.stopReasons
                        .map((reason) => `${reason.name} (${reason.type}${reason.productive ? ', produtivo' : ', improdutivo'})`)
                        .join('; ')}
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

const BASIS_LABEL = {
  'exact-activity-name': 'por nome exato da atividade',
  'operation-family': 'por familia de operacao',
  'sem-ligacao': 'sem ligacao',
} as const

function classificationTone(
  basis: 'exact-activity-name' | 'operation-family' | null,
  classification: string,
): 'green' | 'yellow' | 'neutral' {
  if (basis === null) return 'neutral'
  return classification === 'EVENT_TYPE_PRODUCTIVE' ? 'green' : 'yellow'
}