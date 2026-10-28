import { useMemo } from 'react'
import { useAgro } from '../../data/agroContext'
import { buildRecommendationAnalysis } from './recommendationMessages'
import './recommendations.css'

export default function Recommendations() {
  const { data, filters } = useAgro()
  const analysis = useMemo(() => data ? buildRecommendationAnalysis(data, filters) : null, [data, filters])
  if (!analysis) return null

  return (
    <section className="recommendations" aria-labelledby="recommendations-title">
      <header className="recommendations__heading">
        <h2 id="recommendations-title">Recomendações</h2>
        <p>Ações priorizadas a partir dos dados de {analysis.period}.</p>
      </header>
      <ol className="recommendations__list">
        {analysis.recommendations.map((item) => (
          <li className="recommendations__item" key={item.id}>
            <span className={`recommendations__priority recommendations__priority--${item.priority}`} aria-label={`Prioridade ${item.priority}`}>P{item.priority}</span>
            <div className="recommendations__item-body">
              <h3>{item.title}</h3>
              <p className="recommendations__message">{item.evidence} {item.action}</p>
              <div className="recommendations__item-footer">
                <small>Fonte: {item.source}</small>
                <a href={item.href}>Consultar dados <span aria-hidden="true">→</span><span className="recommendations__sr-only">: {item.title}</span></a>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {analysis.partialOperations && <p className="recommendations__scope">As ordens de serviço selecionadas são analisadas por seus totais completos, incluindo trechos fora do período.</p>}
      {(filters.trapCodes.length > 0 || filters.pestKeys.length > 0) && <p className="recommendations__scope">Os filtros de armadilha e praga se aplicam às detecções. Clima e operações seguem o período.</p>}
    </section>
  )
}
