import { useMemo, useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { buildRecommendationAnalysis } from './recommendationMessages'
import AgroIcon from '../../core/components/agroIcon'
import AiConversation from './aiConversation'
import './recommendations.css'

export default function Recommendations() {
  const { data, availableRange, reload } = useAgro()
  // O assistente usa toda a propriedade, sem herdar filtros das outras telas.
  const filters = useMemo(() => ({ from: availableRange.from, to: availableRange.to, trapCodes: [], pestKeys: [] }), [availableRange.from, availableRange.to])
  const scope = JSON.stringify([data?.manifest.generatedAt, filters.from, filters.to])
  const [initialScope] = useState(scope)
  const analysis = useMemo(() => data ? buildRecommendationAnalysis(data, filters) : null, [data, filters])
  if (!analysis) return null

  return (
    <section className="recommendations" aria-label="Assistente da propriedade">
      {data && <AiConversation filters={filters} datasetVersion={data.manifest.generatedAt} contextChanged={initialScope !== scope} onReload={reload} />}
      <details className="recommendations__rules">
      <summary><AgroIcon name="quality" width="17" height="17" /><h2>Indicadores por regras</h2><span>{analysis.recommendations.length} verificações sem IA</span><AgroIcon name="chevron" width="14" height="14" /></summary>
      <div className="recommendations__rules-body">
      <p className="recommendations__scope">Verificações calculadas a partir dos registros de {analysis.period}, disponíveis mesmo sem um provedor de IA.</p>
      <ol className="recommendations__list">
        {analysis.recommendations.map((item) => (
          <li className="recommendations__item" key={item.id}>
            <span className={`recommendations__priority recommendations__priority--${item.priority}`} aria-label={`Prioridade ${item.priority}`}>P{item.priority}</span>
            <div className="recommendations__item-body">
              <h3>{item.title}</h3>
              <p className="recommendations__message">{item.evidence} {item.action}</p>
              <div className="recommendations__item-footer">
                <small>Fonte: {item.source}</small>
                <a href={item.href}>{item.href === '#/operacoes' ? 'Abrir histórico de operações' : 'Consultar dados'} <span aria-hidden="true">→</span><span className="recommendations__sr-only">: {item.title}</span></a>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {analysis.partialOperations && <p className="recommendations__scope">As ordens de serviço selecionadas são analisadas por seus totais completos, incluindo trechos fora do período.</p>}
      </div>
      </details>
    </section>
  )
}
