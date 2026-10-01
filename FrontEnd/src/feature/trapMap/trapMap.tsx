import { useMemo, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAgro } from '../../data/agroContext'
import { TONE_BY_SEVERITY, useDerived } from '../../data/useDerived'
import { loadOperationDetail } from '../../data/api'
import { colors } from '../../core/theme/colors'
import { Badge, Card, EmptyHint, Notice, SegmentedControl } from '../../core/components/ui'
import { formatDateTime, formatDistance, formatNumber, trapTypeLabel } from '../../core/utils/format'
import type { MachineOperationSummary, OperationDetailPayload } from '../../data/types'
import './trapMap.css'

type LayerId = 'armadilhas' | 'alertas' | 'referencia' | 'aerea'

const LAYERS: { value: LayerId; label: string }[] = [
  { value: 'armadilhas', label: 'Armadilhas' },
  { value: 'alertas', label: 'Alertas' },
  { value: 'referencia', label: 'Referencia' },
  { value: 'aerea', label: 'Aerea' },
]

/**
 * Mapa das armadilhas, dos alertas de maquina e das trajetorias de aplicacao.
 *
 * O que o pacote entrega de georreferenciado:
 * - `traps.json` tem latitude/longitude por armadilha;
 * - `operations/*.json` tem o indice; a geometria fica nos arquivos por ordem
 *   de servico, carregados aqui sob demanda;
 * - `machine-alerts.json` tem a posicao de cada alerta.
 *
 * O que o pacote NAO traz: o limite da propriedade. Nao ha geojson em
 * `traps.json`, entao a "referencia" desenhada e o circulo de
 * `farmReferenceRadiusMeters` do manifesto — o mesmo criterio que o conversor
 * usa para marcar alerta fora da propriedade. Desenhar um contorno inventado
 * seria pior do que mostrar essa ausencia.
 */
export default function TrapMap() {
  const { data } = useAgro()
  const derived = useDerived()
  const [layer, setLayer] = useState<LayerId>('armadilhas')
  const [detail, setDetail] = useState<OperationDetailPayload | null>(null)
  const [loadingFile, setLoadingFile] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const severityByTrap = useMemo(
    () => new Map((derived?.ranking ?? []).map((row) => [row.trapCode, row.severity])),
    [derived],
  )

  const operations = useMemo(() => {
    if (!data) return []
    return [...data.fertilization.operations, ...data.spray.operations]
  }, [data])

  const loadTrack = async (operation: MachineOperationSummary) => {
    if (!data) return
    if (detail?.serviceOrder === operation.serviceOrder) {
      setDetail(null)
      return
    }
    setLoadingFile(operation.file)
    setLoadError(null)
    try {
      setDetail(await loadOperationDetail(operation.file))
    } catch (error) {
      setDetail(null)
      setLoadError(error instanceof Error ? error.message : 'Falha ao carregar a trajetoria.')
    } finally {
      setLoadingFile(null)
    }
  }

  if (!data) return null

  const [referenceLon, referenceLat] = data.manifest.farmReference
  const center: [number, number] = [referenceLat, referenceLon]
  const radius = data.manifest.farmReferenceRadiusMeters

  const trapsWithoutCoordinates = data.traps.traps.filter(
    (trap) => trap.latitude === null || trap.longitude === null,
  )

  return (
    <div className="trap-map">
      <Card
        title="Mapa de monitoramento"
        subtitle={`Referencia em ${referenceLat.toFixed(5)}, ${referenceLon.toFixed(5)} · circulo de ${formatDistance(radius)}`}
        actions={
          <SegmentedControl
            label="Camadas do mapa"
            value={layer}
            onChange={(value: LayerId) => setLayer(value)}
            options={LAYERS}
          />
        }
      >
        <MapContainer center={center} zoom={14} className="trap-map__canvas" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {(layer === 'referencia' || layer === 'armadilhas') && (
            <Circle
              center={center}
              radius={radius}
              pathOptions={{ color: colors.gold.primary, weight: 1.5, fillOpacity: 0.05, dashArray: '5 4' }}
            />
          )}

          {layer === 'armadilhas' &&
            data.traps.traps.map((trap) => {
              if (trap.latitude === null || trap.longitude === null) return null
              const severity = severityByTrap.get(trap.trapCode) ?? 'unknown'
              const tone = colors.severity[TONE_BY_SEVERITY[severity]]
              return (
                <CircleMarker
                  key={trap.trapCode}
                  center={[trap.latitude, trap.longitude]}
                  radius={7}
                  pathOptions={{ color: tone, fillColor: tone, fillOpacity: 0.55, weight: 2 }}
                >
                  <Popup>
                    <strong>{trap.trapCode}</strong>
                    <br />
                    {trapTypeLabel(trap.type)}
                    <br />
                    Cultura: {trap.cultures.join(', ') || 'sem historico em traps_data.csv'}
                  </Popup>
                </CircleMarker>
              )
            })}

          {layer === 'alertas' &&
            data.machineAlerts.alerts.map((alert) => (
              <CircleMarker
                key={alert.alertId}
                center={[alert.location.latitude, alert.location.longitude]}
                radius={5}
                pathOptions={{
                  color: alert.outOfProperty ? colors.severity.critical : colors.severity.medium,
                  fillColor: alert.outOfProperty ? colors.severity.critical : colors.severity.medium,
                  fillOpacity: 0.6,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <strong>{alert.alert ?? 'Alerta'}</strong>
                  <br />
                  {formatDateTime(alert.at)} ({alert.machine ?? 'maquina nao informada'})
                  <br />
                  {alert.classifiedActivity ?? 'Sem classificacao'}
                  <br />
                  {formatDistance(alert.distanceFromFarmMeters)} da referencia
                  {alert.outOfProperty && (
                    <>
                      <br />
                      <strong>Fora da propriedade</strong>
                    </>
                  )}
                </Popup>
              </CircleMarker>
            ))}

          {detail?.paths.map((path, index) => (
            <Polyline
              key={`${path.at}-${index}`}
              positions={path.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])}
              pathOptions={{
                color: detail.kind === 'fertilization' ? colors.green.primary : colors.blue.primary,
                weight: 3,
                opacity: 0.85,
              }}
            />
          ))}
        </MapContainer>

        {layer === 'aerea' && (
          <Notice tone="atencao" title="Sem imagem aerea nesta base">
            O CSV nao traz ortofoto, imagem de satelite nem raster de drone. A camada fica declarada no contrato, mas sem
            dado: quando o arquivo chegar, o ponto de entrada e um raster georreferenciado sobre a mesma referencia,
            sem mudanca de schema nem de schema de tela.
          </Notice>
        )}

        {layer === 'alertas' && (
          <Notice tone="info" title="Como este mapa de alertas foi montado">
            Cada ponto e um registro de <code>LAYER_MAP_PARAMETERIZED_ALERT.csv</code>. Vermelho marca os{' '}
            {formatNumber(data.machineAlerts.outOfProperty)} alertas a mais de {formatDistance(radius)} da referencia;
            o resto esta dentro do circulo.
          </Notice>
        )}

        {detail && (
          <Notice tone="info" title={`Trajetoria carregada: OS ${detail.serviceOrder}`}>
            {detail.paths.length} trecho(s) · {formatDetailDays(detail)}. A geometria veio de{' '}
            <code>{detail.source}</code>.
          </Notice>
        )}
        {loadError && (
          <Notice tone="critico" title="Nao foi possivel carregar a trajetoria">
            {loadError}
          </Notice>
        )}

        <p className="trap-map__legend">
          <span className="trap-map__key trap-map__key--ok">armadilha com serie</span>
          <span className="trap-map__key trap-map__key--unknown">armadilha sem limiar</span>
          <span className="trap-map__key trap-map__key--reference">referencia do manifesto</span>
        </p>
      </Card>

      <Card
        title="Operacoes no mapa"
        subtitle="A geometria fica nos arquivos por ordem de servico e e carregada ao clicar"
      >
        {operations.length === 0 ? (
          <EmptyHint>Nenhuma ordem de servico no pacote.</EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Operacao</th>
                  <th>Maquina</th>
                  <th className="is-number">Trechos</th>
                  <th className="is-number">Area relatada</th>
                  <th className="is-number">Longe da referencia</th>
                  <th>Trajetoria</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((operation) => (
                  <tr key={operation.file}>
                    <td className="is-primary">{operation.serviceOrder}</td>
                    <td>{operation.operation}</td>
                    <td>{operation.machine ?? '—'}</td>
                    <td className="is-number">{formatNumber(operation.segments)}</td>
                    <td className="is-number">{formatNumber(operation.reportedAreaHa, 1)} ha</td>
                    <td className="is-number">
                      {formatNumber(operation.farFromFarmSegments)}
                      {operation.maxDistanceMeters !== null && (
                        <span className="trap-map__distance"> ate {formatDistance(operation.maxDistanceMeters)}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        disabled={loadingFile === operation.file}
                        onClick={() => void loadTrack(operation)}
                      >
                        {loadingFile === operation.file
                          ? 'Carregando...'
                          : detail?.serviceOrder === operation.serviceOrder
                            ? 'Ocultar'
                            : 'Desenhar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Inventario de armadilhas" subtitle={`${data.traps.traps.length} armadilhas no cadastro`}>
        {derived === null || derived.traps.length === 0 ? (
          <EmptyHint>Nenhuma armadilha cadastrada.</EmptyHint>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Armadilha</th>
                  <th>Tipo</th>
                  <th>Cultura</th>
                  <th>Severidade</th>
                  <th className="is-number">Caixas</th>
                  <th className="is-number">Capturas</th>
                  <th className="is-number">Dias</th>
                </tr>
              </thead>
              <tbody>
                {derived.traps.map((entry) => (
                  <tr key={entry.trap.trapCode}>
                    <td className="is-primary">
                      <a className="inline-link" href={`#/armadilha/${entry.trap.trapCode}`}>
                        {entry.trap.trapCode}
                      </a>
                    </td>
                    <td>{trapTypeLabel(entry.trap.type)}</td>
                    <td>{entry.trap.cultures.join(', ') || '—'}</td>
                    <td>
                      <Badge tone={TONE_BY_SEVERITY[entry.severity]}>{entry.severity}</Badge>
                    </td>
                    <td className="is-number">{formatNumber(entry.detections)}</td>
                    <td className="is-number">{formatNumber(entry.captures)}</td>
                    <td className="is-number">{formatNumber(entry.days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {trapsWithoutCoordinates.length > 0 && (
          <Notice tone="info" title="Sem coordenada no cadastro">
            {trapsWithoutCoordinates.map((trap) => trap.trapCode).join(', ')} nao entram no mapa:{' '}
            <code>traps_list.csv</code> nao tem latitude/longitude valida para elas. Elas continuam no filtro e na serie.
          </Notice>
        )}
      </Card>
    </div>
  )
}

/** Mostra quantos dias a trajetoria cobre, sem repetir o intervalo inteiro. */
function formatDetailDays(detail: OperationDetailPayload): string {
  const days = new Set(detail.paths.map((path) => path.day))
  return `${days.size} dia(s) de trabalho`
}