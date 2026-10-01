import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { useDerived } from '../../data/useDerived'
import { describeThresholds, LEVEL_LABEL, resolveVariant } from '../../data/alertRules'
import { Badge, Card, EmptyHint, Notice } from '../../core/components/ui'
import { formatNumber } from '../../core/utils/format'
import type { PestGroup } from '../../data/types'
import './pests.css'

/**
 * Catalogo de pragas com os limiares reais de pest_list.csv.
 *
 * Quando a mesma praga aparece em varias culturas, a tela mostra todas as
 * variantes lado a lado em vez de escolher uma: o catalogo nao define regra de
 * desempate, e esconder a divergencia seria inventar criterio.
 */
export default function Pests() {
  const { data } = useAgro()
  const derived = useDerived()
  const [open, setOpen] = useState<string | null>(null)

  const detections = useMemo(() => {
    const map = new Map<string, number>()
    for (const pest of derived?.byPest ?? []) map.set(pest.pestKey, pest.detections)
    return map
  }, [derived])

  if (!data) return null

  const documented = data.pests.groups.filter((group) => group.hasDocumentation).length
  const withPhotos = data.pests.groups.filter((group) => group.hasReferencePhotos).length

  return (
    <div className="pests">
      <div className="pests__summary">
        <span>
          <strong>{formatNumber(data.pests.groups.length)}</strong> pragas
        </span>
        <span>
          <strong>{formatNumber(documented)}</strong> com descricao
        </span>
        <span>
          <strong>{formatNumber(withPhotos)}</strong> com foto de referencia
        </span>
        <span>
          cultura em foco: <strong>{derived?.trapCulture ?? 'nenhuma (empate ou ausente)'}</strong>
        </span>
      </div>

      {derived?.trapCulture && (
        <Notice tone="info" title={`Cultura em foco: ${derived.trapCulture}`}>
          Os limiares aplicados nas telas de severidade sao os desta cultura. A comparacao abaixo mostra as variantes de
          todas as culturas do catalogo.
        </Notice>
      )}
      {!derived?.trapCulture && (
        <Notice tone="atencao" title="Sem cultura definida para os limiares">
          O filtro de armadilha seleciona mais de uma cultura em <code>traps_data.csv</code>. Por isso as telas mostram
          severidade como "sem limiar" em vez de escolher uma cultura por acaso.
        </Notice>
      )}

      {data.pests.groups.length === 0 ? (
        <EmptyHint>O catalogo de pragas veio vazio do CSV.</EmptyHint>
      ) : (
        <Card title="Catalogo" subtitle="Ordenado pelas pragas com mais caixas no periodo filtrado">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Praga</th>
                  <th>Nome cientifico</th>
                  <th>Classificacao</th>
                  <th>Nomes no modelo</th>
                  <th className="is-number">Culturas</th>
                  <th className="is-number">Caixas no periodo</th>
                  <th>Limiares</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {data.pests.groups.map((group) => (
                  <PestRow
                    key={group.key}
                    group={group}
                    detections={detections.get(group.key) ?? 0}
                    focusCulture={derived?.trapCulture ?? null}
                    open={open === group.key}
                    onToggle={() => setOpen(open === group.key ? null : group.key)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function PestRow({
  group,
  detections,
  focusCulture,
  open,
  onToggle,
}: {
  group: PestGroup
  detections: number
  focusCulture: string | null
  open: boolean
  onToggle: () => void
}) {
  const decision = resolveVariant(group, focusCulture)

  return (
    <>
      <tr className={detections > 0 ? 'pests__row--active' : undefined}>
        <td className="is-primary">
          <button type="button" className="link-button" onClick={onToggle} aria-expanded={open}>
            {group.popularName}
          </button>
        </td>
        <td>{group.scientificNames.filter(Boolean).join(', ') || '—'}</td>
        <td>{group.classification ?? '—'}</td>
        <td>{group.detectionNames.join(', ')}</td>
        <td className="is-number">{formatNumber(group.cultures.length)}</td>
        <td className="is-number">{detections || '—'}</td>
        <td>
          {decision === null ? (
            <Badge tone="neutral">sem limiar</Badge>
          ) : (
            <>
              <Badge tone={decision.conflicting ? 'yellow' : 'blue'}>
                {decision.variant.culture}: {decision.variant.thresholds.alert ?? '—'} /{' '}
                {decision.variant.thresholds.control ?? '—'} / {decision.variant.thresholds.damage ?? '—'}
              </Badge>
              {decision.conflicting && <span className="pests__conflict">variantes divergentes</span>}
            </>
          )}
        </td>
        <td>
          {group.hasReferencePhotos ? (
            <span>{group.variants.find((variant) => variant.referencePhotos.length > 0)?.referencePhotos.length ?? 0} foto(s)</span>
          ) : (
            '—'
          )}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} className="pests__detail">
            <div className="pests__detail-inner">
              {group.hasDocumentation ? (
                <p>
                  {group.variants.find((variant) => variant.description)?.description ?? 'Sem descricao no CSV.'}
                </p>
              ) : (
                <p className="pests__absent">pest_details.csv nao traz descricao para esta praga.</p>
              )}

              <h4>Variantes e limiares</h4>
              <table className="data-table pests__variants">
                <thead>
                  <tr>
                    <th>Cultura</th>
                    <th className="is-number">Alerta</th>
                    <th className="is-number">Controle</th>
                    <th className="is-number">Dano</th>
                  </tr>
                </thead>
                <tbody>
                  {group.variants.map((variant) => (
                    <tr key={`${variant.culture}-${variant.pestId}`}>
                      <td className="is-primary">
                        {variant.culture}
                        {focusCulture && variant.culture === focusCulture && <Badge tone="green">em foco</Badge>}
                      </td>
                      <td className="is-number">{formatNumber(variant.thresholds.alert)}</td>
                      <td className="is-number">{formatNumber(variant.thresholds.control)}</td>
                      <td className="is-number">{formatNumber(variant.thresholds.damage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4>Niveis de leitura</h4>
              <p className="pests__levels">
                {LEVEL_LABEL.alert} acima de {formatNumber(group.variants[0]?.thresholds.alert ?? null)},{' '}
                {LEVEL_LABEL.control} acima de {formatNumber(group.variants[0]?.thresholds.control ?? null)} e{' '}
                {LEVEL_LABEL.damage} acima de {formatNumber(group.variants[0]?.thresholds.damage ?? null)}.
                {decision && <span className="pests__describe"> {describeThresholds(decision.variant)}</span>}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
