import { useMemo } from 'react'
import { useAgro } from '../../data/agroContext'
import { TONE_BY_SEVERITY, useDerived } from '../../data/useDerived'
import { dailySeries, detectionsByPest, sumPestDetections } from '../../data/selectors'
import { Card, EmptyHint, Notice, Stat } from '../../core/components/ui'
import TrendChart from '../trendChart/trendChart'
import { colors } from '../../core/theme/colors'
import {
  formatDateTime,
  formatDay,
  formatDayShort,
  formatNumber,
  trapTypeLabel,
} from '../../core/utils/format'
import './trapDetail.css'

/**
 * Detalhe de uma armadilha: cadastro e serie do periodo.
 */
export default function TrapDetail({ trapCode }: { trapCode: string | null }) {
  const { data, filters } = useAgro()
  const derived = useDerived()

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

  const byPest = detectionsByPest(rows, derived?.pestKeys ?? [])

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
            : 'Selecione uma armadilha para ver o detalhe.'
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
                <dd>
                  {trap.trapIds.length === 0 ? (
                    '—'
                  ) : (
                    <ul className="trap-detail__ids">
                      {trap.trapIds.map((id) => (
                        <li key={id}>{id}</li>
                      ))}
                    </ul>
                  )}
                </dd>
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
    </div>
  )
}
