import { useMemo, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAgro } from '../../data/agroContext'
import { TONE_BY_SEVERITY, useDerived } from '../../data/useDerived'
import { colors } from '../../core/theme/colors'
import { Card, Notice, SegmentedControl } from '../../core/components/ui'
import { formatDateTime, formatDistance, formatNumber, trapTypeLabel } from '../../core/utils/format'
import './trapMap.css'

type LayerId = 'armadilhas' | 'alertas' | 'referencia' | 'aerea'

const LAYERS: { value: LayerId; label: string }[] = [
  { value: 'armadilhas', label: 'Armadilhas' },
  { value: 'alertas', label: 'Alertas' },
  { value: 'referencia', label: 'Referencia' },
  { value: 'aerea', label: 'Aerea' },
]

/**
 * Mapa das armadilhas e dos alertas de maquina.
 *
 * O que o pacote entrega de georreferenciado:
 * - `traps.json` tem latitude/longitude por armadilha;
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
  const severityByTrap = useMemo(
    () => new Map((derived?.ranking ?? []).map((row) => [row.trapCode, row.severity])),
    [derived],
  )

  if (!data) return null

  const [referenceLon, referenceLat] = data.manifest.farmReference
  const center: [number, number] = [referenceLat, referenceLon]
  const radius = data.manifest.farmReferenceRadiusMeters

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

        <p className="trap-map__legend">
          <span className="trap-map__key trap-map__key--ok">armadilha com serie</span>
          <span className="trap-map__key trap-map__key--unknown">armadilha sem limiar</span>
          <span className="trap-map__key trap-map__key--reference">referencia do manifesto</span>
        </p>
      </Card>
    </div>
  )
}
