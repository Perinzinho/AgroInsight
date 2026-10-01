import { useEffect, useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { TONE_BY_SEVERITY, useDerived } from '../../data/useDerived'
import { loadTrapEvents } from '../../data/api'
import { batteryHealth, dailySeries, detectionsByPest, sumPestDetections } from '../../data/selectors'
import { Badge, Card, DataState, EmptyHint, Notice, Stat } from '../../core/components/ui'
import TrendChart from '../trendChart/trendChart'
import { colors } from '../../core/theme/colors'
import {
  formatDateTime,
  formatDay,
  formatDayShort,
  formatNumber,
  formatTime,
  trapTypeLabel,
} from '../../core/utils/format'
import type { TrapEventsPayload } from '../../data/types'
import './trapDetail.css'

/**
 * Detalhe de uma armadilha: cadastro, serie do periodo e os eventos brutos.
 *
 * Os eventos entram sob demanda porque sao o arquivo mais pesado do pacote e so
 * interessam quando o usuario abre uma armadilha especifica.
 */
export default function TrapDetail({ trapCode }: { trapCode: string | null }) {
  const { data, filters } = useAgro()
  const derived = useDerived()

  const [state, setState] = useState<{
    file: string | null
    status: 'idle' | 'loading' | 'ready' | 'error'
    error: string | null
    payload: TrapEventsPayload | null
  }>({ file: null, status: 'idle', error: null, payload: null })

  const entry = useMemo(
    () => data?.events.traps.find((item) => item.trapCode === trapCode) ?? null,
    [data, trapCode],
  )

  useEffect(() => {
    if (!entry) return

    let cancelled = false

    loadTrapEvents(entry.file)
      .then((payload) => {
        if (cancelled) return
        setState({ file: entry.file, status: 'ready', error: null, payload })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setState({
          file: entry.file,
          status: 'error',
          error: cause instanceof Error ? cause.message : 'Falha ao carregar os eventos.',
          payload: null,
        })
      })

    return () => {
      cancelled = true
    }
  }, [entry])

  const trap = data?.traps.traps.find((item) => item.trapCode === trapCode) ?? null
  const ranking = derived?.ranking.find((row) => row.trapCode === trapCode) ?? null

  const rows = useMemo(
    () => derived?.rows.filter((row) => row.trapCode === trapCode) ?? [],
    [derived, trapCode],
  )

  const chart = useMemo(() => {
    if (!derived) return null
    const points = dailySeries(rows, derived.days, derived.pestKeys)
    return {
      labels: points.map((point) => formatDayShort(point.day)),
      detections: points.map((point) =>
        point.captures === 0 && point.detections === 0
          ? null
          : sumPestDetections(
              rows.filter((row) => row.day === point.day).flatMap((row) => row.pests),
              derived.pestKeys,
            ),
      ),
    }
  }, [derived, rows])

  const battery = batteryHealth(rows)
  const byPest = detectionsByPest(rows, derived?.pestKeys ?? [])

  const events = entry !== null && state.file === entry.file ? state.payload : null
  const status =
    entry === null ? 'idle' : state.file === entry.file ? state.status : ('loading' as const)
  const error = entry !== null && state.file === entry.file ? state.error : null

  const filteredEvents = useMemo(() => {
    if (!events) return []
    return events.events
      .filter((event) => event.day >= filters.from && event.day <= filters.to)
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [events, filters.from, filters.to])

  if (!data) return null

  if (data.traps.traps.length === 0) {
    return (
      <Card title="Detalhe da armadilha">
        <EmptyHint>Nenhuma armadilha no cadastro.</EmptyHint>
      </Card>
    )
  }

  return (
    <div className="trap-detail">
      <Card
        title={trap ? `Armadilha ${trap.trapCode}` : 'Escolha uma armadilha'}
        subtitle={
          trap
            ? `${trapTypeLabel(trap.type)} · ${trap.status ?? 'sem status no cadastro'} · instalacao ${formatDay(trap.installationDate ?? '—')}`
            : 'Use o link em "Armadilhas por volume" ou a navegacao direta por hash.'
        }
        actions={
          <label className="trap-detail__picker">
            <span>Armadilha</span>
            <select
              value={trapCode ?? ''}
              onChange={(event) => {
                window.location.hash = `#/armadilha/${event.target.value}`
              }}
            >
              <option value="">Selecione...</option>
              {data.traps.traps.map((item) => (
                <option key={item.trapCode} value={item.trapCode}>
                  {item.trapCode}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {!trap ? (
          <EmptyHint>Nenhuma armadilha com o codigo "{trapCode}" em traps_list.csv.</EmptyHint>
        ) : (
          <>
            <div className="trap-detail__stats">
              <Stat
                label="Caixas no periodo"
                value={formatNumber(ranking?.detections ?? 0)}
                note={`${formatNumber(ranking?.days ?? 0)} dia(s) com serie`}
                tone={ranking && ranking.detections > 0 ? 'green' : 'neutral'}
              />
              <Stat
                label="Capturas de imagem"
                value={formatNumber(ranking?.captures ?? 0)}
                note="Eventos IMAGE no periodo"
                tone="blue"
              />
              <Stat
                label="Media por dia"
                value={formatNumber(ranking?.meanPerDay ?? null, 1)}
                note="caixas divididas pelos dias com serie"
                tone="neutral"
              />
              <Stat
                label="Bateria"
                value={battery.mean === null ? null : `${battery.mean.toFixed(2)} V`}
                note={battery.mean === null ? 'traps_events.csv nao traz leitura' : `menor leitura ${battery.lowest?.toFixed(2)} V`}
                tone={battery.severity === 'ok' ? 'green' : battery.severity === 'unknown' ? 'neutral' : 'yellow'}
              />
              <Stat
                label="Severidade"
                value={ranking?.severity ?? 'unknown'}
                note={
                  ranking === null
                    ? 'sem serie no periodo'
                    : ranking.severity === 'unknown'
                      ? 'praga sem limiar em pest_list.csv'
                      : `pior praga: ${ranking.topPest ?? '—'}`
                }
                tone={ranking ? TONE_BY_SEVERITY[ranking.severity] : 'neutral'}
              />
            </div>

            {trap.readingsFromUnknownTrapId > 0 && (
              <Notice tone="atencao" title="Parte das leituras veio de um trapId fora do catalogo">
                {trap.readingsFromUnknownTrapId} leitura(s) de traps_data.csv cites {trap.trapIds.join(', ')} e nao entraram
                no historico desta armadilha.
              </Notice>
            )}

            <dl className="trap-detail__meta">
              <div>
                <dt>trapIds no historico</dt>
                <dd>{trap.trapIds.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Culturas</dt>
                <dd>{trap.cultures.join(', ') || 'sem leitura em traps_data.csv'}</dd>
              </div>
              <div>
                <dt>Status vistos</dt>
                <dd>{trap.statusesSeen.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Ultima leitura</dt>
                <dd>{formatDateTime(trap.latest?.at ?? null)}</dd>
              </div>
              <div>
                <dt>pestCount da ultima leitura</dt>
                <dd>
                  {trap.latest?.pestCountReported === null || trap.latest === null
                    ? '—'
                    : formatNumber(trap.latest.pestCountReported)}{' '}
                  <span className="trap-detail__hint">apenas auditoria; a contagem oficial e a soma das caixas</span>
                </dd>
              </div>
              <div>
                <dt>Fontes</dt>
                <dd>{trap.sources.map((source) => `${source.file}:${source.row}`).join(', ')}</dd>
              </div>
            </dl>
          </>
        )}
      </Card>

      {trap && chart && (
        <Card title="Serie da armadilha" subtitle={`${formatDay(filters.from)} a ${formatDay(filters.to)}`}>
          {rows.length === 0 ? (
            <EmptyHint>Sem serie no periodo selecionado.</EmptyHint>
          ) : (
            <TrendChart
              labels={chart.labels}
              series={[{ label: 'Caixas', values: chart.detections, color: colors.green.primary, fill: true }]}
              yLabel="caixas"
              height={200}
            />
          )}
        </Card>
      )}

      {trap && (
        <Card title="Pragas nesta armadilha" subtitle="Somente as que o filtro de praga permite">
          {byPest.length === 0 ? (
            <EmptyHint>Nenhuma deteccao no periodo.</EmptyHint>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Praga</th>
                    <th className="is-number">Caixas</th>
                    <th className="is-number">Capturas</th>
                    <th className="is-number">Confianca media</th>
                  </tr>
                </thead>
                <tbody>
                  {byPest.map((pest) => (
                    <tr key={pest.pestKey}>
                      <td className="is-primary">{pest.pestName}</td>
                      <td className="is-number">{formatNumber(pest.detections)}</td>
                      <td className="is-number">{formatNumber(pest.captures)}</td>
                      <td className="is-number">
                        {pest.meanConfidence === null ? '—' : `${(pest.meanConfidence * 100).toFixed(0)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {entry && (
        <Card
          title="Eventos brutos"
          subtitle={`${filteredEvents.length} evento(s) no periodo · arquivo ${entry.file}`}
          tone="quiet"
        >
          <DataState status={status === 'idle' ? 'loading' : status} error={error} empty={status === 'ready' && filteredEvents.length === 0}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Tipo</th>
                    <th className="is-number">Caixas</th>
                    <th className="is-number">pestCount</th>
                    <th>Conferencia</th>
                    <th>Pragas</th>
                    <th>Imagem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={`${event.eventId}-${event.at}`}>
                      <td className="is-primary">
                        {formatDay(event.day)} {formatTime(event.at)}
                      </td>
                      <td>{event.type}</td>
                      <td className="is-number">{event.detectedTotal || '—'}</td>
                      <td className="is-number">{event.pestCountReported ?? '—'}</td>
                      <td>
                        <Badge
                          tone={agreementTone(event.countAgreement)}
                          title={AGREEMENT_LABEL[event.countAgreement]}
                        >
                          {AGREEMENT_LABEL[event.countAgreement]}
                        </Badge>
                      </td>
                      <td>
                        {event.detections.length === 0
                          ? '—'
                          : event.detections
                              .map((detection) => `${detection.pestName} (${detection.detections})`)
                              .join(', ')}
                      </td>
                      <td>
                        {event.imageUrl ? (
                          <a className="inline-link" href={event.imageUrl} target="_blank" rel="noreferrer">
                            abrir
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataState>
        </Card>
      )}
    </div>
  )
}

const AGREEMENT_LABEL = {
  match: 'confere',
  'detections-higher': 'caixas > pestCount',
  'reported-higher': 'pestCount > caixas',
  'only-reported': 'so no pestCount',
} as const

function agreementTone(agreement: keyof typeof AGREEMENT_LABEL): 'green' | 'yellow' | 'red' {
  return agreement === 'match' ? 'green' : agreement === 'only-reported' ? 'red' : 'yellow'
}