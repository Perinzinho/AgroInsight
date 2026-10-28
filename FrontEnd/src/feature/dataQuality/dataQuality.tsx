import { useMemo } from 'react'
import { useAgro } from '../../data/agroContext'
import { Badge, Card, EmptyHint, Notice } from '../../core/components/ui'
import { formatDistance, formatNumber } from '../../core/utils/format'
import './dataQuality.css'

/**
 * Qualidade dos dados.
 *
 * E a tela que sustenta a honestidade do resto do produto: mostra as regras do
 * conversor, a cobertura real, os avisos gerados e cada linha descartada com o
 * motivo e exemplos. Nada aqui e "corrigido" silenciosamente.
 */
export default function DataQuality() {
  const { data } = useAgro()

  const operations = useMemo(() => {
    if (!data) return null
    const all = [...data.fertilization.operations, ...data.spray.operations]
    return {
      segments: all.reduce((sum, operation) => sum + operation.segments, 0),
      zeroPressure: all.reduce((sum, operation) => sum + operation.zeroPressureSegments, 0),
      missingPressure: all.reduce((sum, operation) => sum + operation.missingPressureSegments, 0),
      zeroDose: all.reduce((sum, operation) => sum + operation.zeroDoseSegments, 0),
      farFromFarm: all.reduce((sum, operation) => sum + operation.farFromFarmSegments, 0),
      areaMismatch: all.filter(
        (operation) =>
          operation.reportedAreaHa !== null &&
          operation.geometryAreaHa !== null &&
          Math.abs(operation.reportedAreaHa - operation.geometryAreaHa) > 0.5,
      ).length,
    }
  }, [data])

  if (!data || !operations) return null

  const manifest = data.manifest
  const coverage = manifest.coverage

  return (
    <div className="quality">
      <Card title="Avisos do conversor" subtitle={`Gerados em ${manifest.generatedAt}`}>
        {manifest.warnings.length === 0 ? (
          <EmptyHint>Nenhum aviso registrado.</EmptyHint>
        ) : (
          <div className="quality__warnings">
            {manifest.warnings.map((warning) => (
              <Notice key={warning.id} tone={warning.severity === 'critico' ? 'critico' : warning.severity} title={warning.title}>
                {warning.message}
              </Notice>
            ))}
          </div>
        )}
      </Card>

      <Card title="Regras aplicadas" subtitle="O que o conversor assumiu e por que">
        <dl className="quality__rules">
          <div>
            <dt>Identidade da armadilha</dt>
            <dd>{manifest.rules.trapIdentity}</dd>
          </div>
          <div>
            <dt>Fonte da contagem</dt>
            <dd>{manifest.rules.captureSource}</dd>
          </div>
          <div>
            <dt>pestCount reportado</dt>
            <dd>{manifest.rules.pestCountReported}</dd>
          </div>
          <div>
            <dt>Origem dos limiares</dt>
            <dd>{manifest.rules.thresholdsSource}</dd>
          </div>
          <div>
            <dt>Agrupamento por dia</dt>
            <dd>{manifest.rules.dayBuckets}</dd>
          </div>
          <div>
            <dt>Ordem das coordenadas</dt>
            <dd>{manifest.rules.coordinateOrder}</dd>
          </div>
          <div>
            <dt>Telemetria excluida</dt>
            <dd>
              {manifest.rules.telemetryExcluded.length === 0
                ? 'nenhuma'
                : manifest.rules.telemetryExcluded.join(', ')}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Cobertura por conjunto" subtitle="O que existe e o que nao existe">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Conjunto</th>
                <th>Intervalo</th>
                <th className="is-number">Registros</th>
                <th>Observacao</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="is-primary">Armadilhas</td>
                <td>—</td>
                <td className="is-number">{formatNumber(coverage.traps.count)}</td>
                <td>
                  {coverage.traps.invalidCoordinates} com coordenada invalida;{' '}
                  {coverage.traps.readingsFromUnknownTrapId} leitura(s) de trapId fora do catalogo
                </td>
              </tr>
              <tr>
                <td className="is-primary">Eventos</td>
                <td>
                  {coverage.events.range[0]} a {coverage.events.range[1]}
                </td>
                <td className="is-number">{formatNumber(coverage.events.totalCaptures)}</td>
                <td>
                  {formatNumber(coverage.events.totalDetections)} caixas em{' '}
                  {Object.entries(coverage.events.byType)
                    .map(([type, count]) => `${type}: ${formatNumber(count)}`)
                    .join(' · ')}{' '}
                  · {formatNumber(coverage.events.divergentFromPestCount)} divergem de pestCount
                </td>
              </tr>
              <tr>
                <td className="is-primary">Clima diario</td>
                <td>
                  {coverage.climate.range[0]} a {coverage.climate.range[1]}
                </td>
                <td className="is-number">{formatNumber(coverage.climate.days)} dias</td>
                <td>{formatNumber(coverage.climate.hours)} horas agregadas</td>
              </tr>
              <tr>
                <td className="is-primary">Fertilizacao</td>
                <td>
                  {coverage.fertilization.range[0]} a {coverage.fertilization.range[1]}
                </td>
                <td className="is-number">{formatNumber(coverage.fertilization.serviceOrders)} OS</td>
                <td>{formatNumber(operations.segments)} trechos no total (os dois arquivos)</td>
              </tr>
              <tr>
                <td className="is-primary">Pulverizacao</td>
                <td>
                  {coverage.spray.range[0]} a {coverage.spray.range[1]}
                </td>
                <td className="is-number">{formatNumber(coverage.spray.serviceOrders)} OS</td>
                <td>
                  {formatNumber(operations.zeroPressure)} trechos com pressao 0;{' '}
                  {formatNumber(operations.missingPressure)} sem o campo
                </td>
              </tr>
              <tr>
                <td className="is-primary">Alertas de maquina</td>
                <td>
                  {coverage.machineAlerts.range[0]} a {coverage.machineAlerts.range[1]}
                </td>
                <td className="is-number">{formatNumber(coverage.machineAlerts.alerts)}</td>
                <td>
                  {formatNumber(data.machineAlerts.outOfProperty)} fora da referencia de{' '}
                  {formatDistance(manifest.farmReferenceRadiusMeters)} ·{' '}
                  {formatNumber(data.machineAlerts.unclassified)} sem ligacao de motivo
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Zeros e lacunas que mudam a leitura" subtitle="Onde o arquivo traz zero de verdade e onde nao traz nada">
        <div className="quality__flags">
          <Flag
            tone="critico"
            title="Pressao de pulverizacao zerada"
            detail={`${formatNumber(operations.zeroPressure)} trechos com pressao 0 e ${formatNumber(
              operations.missingPressure,
            )} sem o campo, em ${formatNumber(operations.segments)} trechos. Avaliar pulverizacao por pressao nao e possivel com esta base.`}
          />
          <Flag
            tone="atencao"
            title="Area relatada x area da geometria"
            detail={`${formatNumber(operations.areaMismatch)} ordens de servico com mais de 0,5 ha de diferenca entre a coluna de area e o poligono do trecho.`}
          />
          <Flag
            tone="atencao"
            title="Trechos longe da referencia"
            detail={`${formatNumber(operations.farFromFarm)} trecho(s) a mais de ${formatDistance(
              manifest.farmReferenceRadiusMeters,
            )} da referencia da fazenda.`}
          />
          <Flag
            tone="atencao"
            title="Dose aplicada zerada"
            detail={`${formatNumber(operations.zeroDose)} trecho(s) com dose aplicada 0.`}
          />
          <Flag
            tone="atencao"
            title="pestCount x soma das caixas"
            detail={`${formatNumber(
              coverage.events.divergentFromPestCount,
            )} evento(s) divergem. A interface usa a soma das caixas e mantem pestCount apenas para auditoria.`}
          />
          <Flag
            tone="info"
            title="Limites de propriedade sao uma referencia, nao o shapefile"
            detail={`O manifesto carrega um ponto de referencia e um raio de ${formatDistance(
              manifest.farmReferenceRadiusMeters,
            )}. O contorno da propriedade nao esta no pacote, entao o mapa desenha esse circulo e avisa.`}
          />
        </div>
      </Card>

      <Card title="Linhas descartadas ou corrigidas" subtitle="Cada grupo com motivo e exemplos do arquivo original">
        {manifest.discarded.length === 0 ? (
          <EmptyHint>Nenhuma linha descartada.</EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Conjunto</th>
                  <th>Arquivo</th>
                  <th>Motivo</th>
                  <th className="is-number">Linhas</th>
                  <th>Exemplos</th>
                </tr>
              </thead>
              <tbody>
                {manifest.discarded.map((group) => (
                  <tr key={`${group.dataset}-${group.reason}`}>
                    <td className="is-primary">{group.dataset}</td>
                    <td>{group.file}</td>
                    <td>{group.reason}</td>
                    <td className="is-number">{formatNumber(group.count)}</td>
                    <td>
                      {group.examples.length === 0 ? (
                        '—'
                      ) : (
                        <ul className="quality__examples">
                          {group.examples.map((example) => (
                            <li key={example}>{example}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Arquivos de origem" subtitle="Delimitador, encoding, quebras e tamanho de cada CSV lido">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Delimitador</th>
                <th>Encoding</th>
                <th>Quebra</th>
                <th>BOM</th>
                <th className="is-number">Linhas</th>
                <th className="is-number">Bytes</th>
              </tr>
            </thead>
            <tbody>
              {manifest.sources.map((source) => (
                <tr key={source.file}>
                  <td className="is-primary">{source.file}</td>
                  <td>{source.delimiter}</td>
                  <td>{source.encoding}</td>
                  <td>{source.lineEnding}</td>
                  <td>{source.bom ? 'sim' : 'nao'}</td>
                  <td className="is-number">{formatNumber(source.rows)}</td>
                  <td className="is-number">{formatNumber(source.bytes / 1_000_000, 2)} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Arquivos gerados" subtitle="O que o conversor escreveu em public/data">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Descricao</th>
                <th>Origem</th>
                <th className="is-number">Linhas</th>
                <th className="is-number">Tamanho</th>
                <th>Carregamento</th>
              </tr>
            </thead>
            <tbody>
              {manifest.outputs.map((output) => (
                <tr key={output.file}>
                  <td className="is-primary">{output.file}</td>
                  <td>{output.description}</td>
                  <td>{output.source}</td>
                  <td className="is-number">{formatNumber(output.rows)}</td>
                  <td className="is-number">{formatNumber(output.bytes / 1_000_000, 2)} MB</td>
                  <td>
                    <Badge tone={output.lazy ? 'blue' : 'green'}>{output.lazy ? 'sob demanda' : 'inicial'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Flag({ tone, title, detail }: { tone: 'info' | 'atencao' | 'critico'; title: string; detail: string }) {
  return (
    <div className={`quality__flag quality__flag--${tone}`}>
      <div className="quality__flag-head">
        <strong>{title}</strong>
        <Badge tone={tone === 'info' ? 'blue' : tone === 'atencao' ? 'yellow' : 'red'}>{tone}</Badge>
      </div>
      <p>{detail}</p>
    </div>
  )
}