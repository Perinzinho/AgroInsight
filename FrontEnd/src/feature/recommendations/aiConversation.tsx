import { useState } from 'react'
import type { Filters } from '../../shared/agroContracts'
import { formatDay, formatNumber } from '../../core/utils/format'
import AgroIcon from '../../core/components/agroIcon'
import { useAiAssistant } from './useAiAssistant'

const suggestions = ['O que merece atenção neste período?', 'Quais pragas tiveram mais detecções?', 'Como ficou o balanço hídrico?', 'Há registros de pulverização nesse período?', 'Quais limitações impedem uma conclusão?']
export default function AiConversation({ filters, datasetVersion, contextChanged, onReload }: {
  filters: Filters; datasetVersion: string; contextChanged: boolean; onReload: () => void;
}) {
  const ai = useAiAssistant(filters, datasetVersion)
  const [message, setMessage] = useState('')
  const unavailable = ai.status !== null && (!ai.status.configured || !ai.status.dataReady)
  const disabled = ai.pending || unavailable
  const submit = () => { if (!disabled && message.trim()) { ai.send('chat', message); setMessage('') } }
  return (
    <section className="ai-conversation" aria-labelledby="ai-title">
      <header className="ai-conversation__heading">
        <div><h3 id="ai-title"><AgroIcon name="recommendations" /> Análise por IA</h3>
          <p>Consulte os registros do período com fontes e limitações. Cada envio solicita uma análise à API.</p></div>
        <button type="button" onClick={() => ai.send('analysis')} disabled={disabled}>Analisar período</button>
      </header>
      <p className="ai-conversation__scope">{formatDay(filters.from)} a {formatDay(filters.to)} · Horário da propriedade: America/Sao_Paulo. As medições podem ser históricas.</p>
      {contextChanged && <p role="status">Os filtros ou a versão da base mudaram. Uma nova conversa foi iniciada.</p>}
      {unavailable && <p role="status">{ai.status?.message}</p>}
      <div className="ai-conversation__suggestions" role="group" aria-label="Perguntas sugeridas">
        {suggestions.map((text) => <button key={text} type="button" disabled={disabled} onClick={() => ai.send('chat', text)}>{text}</button>)}
      </div>
      <div className="ai-conversation__messages" aria-label="Conversa">
        {ai.messages.map((item, i) => item.role === 'user'
          ? <article className="ai-conversation__user" key={i}><strong>Você</strong><p>{item.content}</p></article>
          : <article className="ai-conversation__answer" key={i}>
            <strong>Assistente · Análise por IA</strong><p>{item.response.answer.summary}</p>
            <small>Período: {formatDay(item.response.effectiveFilters.from)} a {formatDay(item.response.effectiveFilters.to)}. Links abrem as telas existentes; não codificam um período.</small>
            {item.response.answer.findings.map((finding) => <section className="ai-conversation__finding" key={finding.id}>
              <h4>Prioridade {finding.priority} · {finding.title}</h4><p>{finding.explanation}</p><p><strong>Verificação sugerida:</strong> {finding.suggestedAction}</p>
              <ul>{finding.evidenceIds.map((id) => {
                const evidence = item.response.evidence.find((e) => e.id === id)!
                return <li key={id}><strong>{evidence.label}:</strong> {typeof evidence.value === 'number' ? formatNumber(evidence.value, Number.isInteger(evidence.value) ? 0 : 2) : evidence.value ?? 'Sem dados'} {evidence.unit}
                  <small>Fonte: {evidence.source} · {evidence.scope}{evidence.from && evidence.to ? ` · ${formatDay(evidence.from)} a ${formatDay(evidence.to)}` : ''}</small>
                  <a href={evidence.href}>{evidence.href === '#/operacoes' ? 'Abrir histórico de operações' : 'Consultar dados'}</a></li>
              })}</ul>
              {finding.limitations.length > 0 && <ul aria-label="Limitações do achado">{finding.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
            </section>)}
            {item.response.answer.limitations.length > 0 && <details open><summary>Limitações da análise</summary><ul>{item.response.answer.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
            <details><summary>Cobertura e fontes consultadas</summary><ul>{item.response.evidence.map((evidence) => <li key={evidence.id}>{evidence.label}: {evidence.value ?? 'Sem dados'} {evidence.unit} · {evidence.source} · {evidence.scope} <a href={evidence.href}>{evidence.href === '#/operacoes' ? 'Abrir histórico de operações' : 'Consultar dados'}</a></li>)}</ul></details>
            <div className="ai-conversation__suggestions">{item.response.answer.followUpQuestions.map((text, index) => <button type="button" key={index} disabled={disabled} onClick={() => ai.send('chat', text)}>{text}</button>)}</div>
          </article>)}
      </div>
      <div role="status" aria-live="polite">{ai.pending ? 'Consultando os registros e preparando a análise…' : ai.notice || (ai.messages.at(-1)?.role === 'assistant' ? 'Análise concluída.' : '')}</div>
      {ai.error && <div role="alert"><p>{ai.error.message}</p>{ai.error.retryable && <button type="button" disabled={ai.pending} onClick={ai.retry}>Tentar novamente</button>}
        {ai.error.code === 'DATASET_CHANGED' && <button type="button" onClick={onReload}>Recarregar dados</button>}</div>}
      <form onSubmit={(event) => { event.preventDefault(); submit() }}>
        <label htmlFor="ai-question">Pergunte sobre os registros</label>
        <textarea id="ai-question" rows={3} maxLength={2000} value={message} disabled={disabled}
          placeholder="Ex.: quais sinais merecem uma verificação em campo?" onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() } }} />
        <small>Enter envia · Shift+Enter insere uma linha · {message.length}/2.000 caracteres</small>
        <div className="ai-conversation__actions"><button type="submit" disabled={disabled || !message.trim()}>Enviar</button>
          {ai.pending && <button type="button" onClick={ai.cancel}>Cancelar</button>}
          <button type="button" onClick={ai.clear} disabled={ai.messages.length === 0 && !ai.pending}>Limpar conversa</button>
          {unavailable && <button type="button" onClick={ai.refreshStatus} disabled={ai.checkingStatus}>{ai.checkingStatus ? 'Verificando disponibilidade…' : 'Verificar disponibilidade'}</button>}
        </div>
      </form>
    </section>
  )
}
