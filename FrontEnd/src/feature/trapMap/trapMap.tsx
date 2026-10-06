import { useMemo } from 'react'
import { CircleMarker, MapContainer, Pane, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAgro } from '../../data/agroContext'
import { TONE_BY_SEVERITY, useDerived } from '../../data/useDerived'
import { colors } from '../../core/theme/colors'
import { Card } from '../../core/components/ui'
import { formatDateTime, trapTypeLabel } from '../../core/utils/format'
import './trapMap.css'

/** Armadilhas e alertas de maquina exibidos juntos no mapa. */
export default function TrapMap() {
  const { data } = useAgro()
  const derived = useDerived()
  const severityByTrap = useMemo(
    () => new Map((derived?.ranking ?? []).map((row) => [row.trapCode, row.severity])),
    [derived],
  )

  if (!data) return null

  const [referenceLon, referenceLat] = data.manifest.farmReference
  const center: [number, number] = [referenceLat, referenceLon]

  return (
    <div className="trap-map">
      <Card
        title="Mapa de monitoramento"
        subtitle="Armadilhas e alertas de máquinas no mesmo mapa"
      >
        <MapContainer center={center} zoom={14} className="trap-map__canvas" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Pane name="traps" style={{ zIndex: 450 }}>
            {data.traps.traps.map((trap) => {
              if (trap.latitude === null || trap.longitude === null) return null
              const severity = severityByTrap.get(trap.trapCode) ?? 'unknown'
              const tone = colors.severity[TONE_BY_SEVERITY[severity]]
              return (
                <CircleMarker
                  key={trap.trapCode}
                  center={[trap.latitude, trap.longitude]}
                  radius={8}
                  pathOptions={{ color: tone, fillColor: tone, fillOpacity: 0.3, weight: 3 }}
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
          </Pane>

          {data.machineAlerts.alerts.map((alert) => (
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

        <p className="trap-map__legend">
          <span className="trap-map__key trap-map__key--trap">Armadilhas (cor por infestação)</span>
          <span className="trap-map__key trap-map__key--alert">Alertas de máquinas</span>
          <span className="trap-map__key trap-map__key--outside">Alertas fora da propriedade</span>
        </p>
      </Card>
    </div>
  )
}
