import type { AiAssistResponse } from '../../shared/aiContracts'
import { formatDay, formatNumber } from '../../core/utils/format'

export default function AiFindings({ response }: { response: AiAssistResponse }) {
  return <ol className="recommendations__list">
    {response.answer.findings.map((finding) => <li className="recommendations__item" key={finding.id}>
      <span className={`recommendations__priority recommendations__priority--${finding.priority}`} aria-label={`Prioridade ${finding.priority}`}>P{finding.priority}</span>
      <div className="recommendations__item-body">
        <h4>Prioridade {finding.priority} · {finding.title}</h4>
        <p className="recommendations__message">{finding.explanation}</p>
        <p className="recommendations__message"><strong>Verificação sugerida:</strong> {finding.suggestedAction}</p>
        <ul className="recommendations__evidence" aria-label="Evidências da recomendação">{finding.evidenceIds.map((id) => {
          const evidence = response.evidence.find((item) => item.id === id)!
          return <li key={id}>
            <strong>{evidence.label}:</strong> {typeof evidence.value === 'number' ? formatNumber(evidence.value, Number.isInteger(evidence.value) ? 0 : 2) : evidence.value ?? 'Sem dados'} {evidence.unit}
            <div className="recommendations__item-footer">
              <small>Fonte: {evidence.source} · {evidence.scope}{evidence.from && evidence.to ? ` · ${formatDay(evidence.from)} a ${formatDay(evidence.to)}` : ''}</small>
              <a href={evidence.href}>{evidence.href === '#/operacoes' ? 'Abrir histórico de operações' : 'Consultar dados'}<span className="recommendations__sr-only">: {finding.title}</span></a>
            </div>
          </li>
        })}</ul>
        {finding.limitations.length > 0 && <ul aria-label="Limitações do achado">{finding.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      </div>
    </li>)}
  </ol>
}
