import { useState } from 'react'
import type { Filters } from '../../shared/agroContracts'
import { formatDay } from '../../core/utils/format'
import AgroIcon from '../../core/components/agroIcon'
import { useAiAssistant } from './useAiAssistant'
import AiFindings from './aiFindings'

const suggestions = ['O que merece atenção neste período?', 'Quais pragas tiveram mais detecções?', 'Como ficou o balanço hídrico?', 'Há registros de pulverização nesse período?', 'Quais limitações impedem uma conclusão?']
export default function AiConversation({ filters, datasetVersion, contextChanged, onReload }: {
  filters: Filters; datasetVersion: string; contextChanged: boolean; onReload: () => void;
}) {
  const ai = useAiAssistant(filters, datasetVersion)
  const [message, setMessage] = useState('')
  const unavailable = ai.status !== null && (!ai.status.dataReady || !ai.selectionReady)
  const disabled = ai.pending || ai.checkingStatus || !ai.selectionReady || !ai.status?.dataReady
  const submit = () => { if (!disabled && message.trim()) { ai.send('chat', message); setMessage('') } }
  return (
    <section className="ai-conversation" aria-labelledby="ai-title">
      <header className="ai-conversation__heading">
        <div><h3 id="ai-title"><AgroIcon name="recommendations" /> Análise por IA</h3>
          <p>Gere indicadores e recomendações para o período com fontes e limitações, ou tire dúvidas na conversa.</p></div>
        <button type="button" onClick={() => ai.send('analysis')} disabled={disabled}>Analisar período</button>
      </header>
      <div className="ai-conversation__settings" role="group" aria-label="Configuração da IA">
        <div><label htmlFor="ai-provider">Provedor de IA</label>
          <select id="ai-provider" value={ai.selection?.provider ?? ''} disabled={ai.checkingStatus || !ai.status?.providers.length}
            onChange={(event) => {
              const option = ai.status?.providers.find((item) => item.id === event.target.value)
              if (option) ai.changeSelection({ provider: option.id, model: option.defaultModel })
            }}>
            {!ai.status?.providers.length && <option value="">{ai.checkingStatus ? 'Carregando provedores…' : 'Provedores indisponíveis'}</option>}
            {ai.status?.providers.map((option) => <option key={option.id} value={option.id}>{option.name}{option.configured ? '' : ' · Não configurado'}</option>)}
          </select></div>
        <div><label htmlFor="ai-model">Modelo</label>
          <select id="ai-model" value={ai.selection?.model ?? ''} disabled={ai.checkingStatus || !ai.selectedProvider}
            onChange={(event) => { if (ai.selection) ai.changeSelection({ ...ai.selection, model: event.target.value }) }}>
            {!ai.selectedProvider && <option value="">Selecione um provedor</option>}
            {ai.selectedProvider?.models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select></div>
      </div>
      <p className="ai-conversation__scope">{formatDay(filters.from)} a {formatDay(filters.to)} · Horário da propriedade: America/Sao_Paulo. As medições podem ser históricas.</p>
      {contextChanged && <p role="status">Os filtros ou a versão da base mudaram. Uma nova conversa foi iniciada.</p>}
      {unavailable && <p role="status">{ai.status?.message ?? `Configure a chave de ${ai.selectedProvider?.name ?? 'IA'} no servidor para usar este provedor.`}</p>}
      <div className="ai-conversation__suggestions" role="group" aria-label="Perguntas sugeridas">
        {suggestions.map((text) => <button key={text} type="button" disabled={disabled} onClick={() => ai.send('chat', text)}>{text}</button>)}
      </div>
      <div className="ai-conversation__messages" aria-label="Conversa">
        {ai.messages.map((item, i) => item.role === 'user'
          ? <article className="ai-conversation__user" key={i}><strong>Você</strong><p>{item.content}</p></article>
          : <article className="ai-conversation__answer" key={i}>
            <strong>Assistente · Análise por IA</strong>
            {item.response.selection && <small>{ai.status?.providers.find((option) => option.id === item.response.selection?.provider)?.name ?? item.response.selection.provider} · {item.response.selection.model}</small>}
            <p>{item.response.answer.summary}</p>
            <small>Período: {formatDay(item.response.effectiveFilters.from)} a {formatDay(item.response.effectiveFilters.to)}. Links abrem as telas existentes; não codificam um período.</small>
            {item.mode === 'chat' && <AiFindings response={item.response} />}
            {item.response.answer.limitations.length > 0 && <details open><summary>Limitações da análise</summary><ul>{item.response.answer.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
            <details><summary>Cobertura e fontes consultadas</summary><ul>{item.response.evidence.map((evidence) => <li key={evidence.id}>{evidence.label}: {evidence.value ?? 'Sem dados'} {evidence.unit} · {evidence.source} · {evidence.scope} <a href={evidence.href}>{evidence.href === '#/operacoes' ? 'Abrir histórico de operações' : 'Consultar dados'}</a></li>)}</ul></details>
            <div className="ai-conversation__suggestions">{item.response.answer.followUpQuestions.map((text, index) => <button type="button" key={index} disabled={disabled} onClick={() => ai.send('chat', text)}>{text}</button>)}</div>
          </article>)}
      </div>
      <div role="status" aria-live="polite">{ai.pending ? 'Consultando os registros e preparando a análise…' : ai.notice || (ai.messages.at(-1)?.role === 'assistant' ? 'Análise concluída.' : '')}</div>
      {ai.error && <div role="alert"><p>{ai.error.message}</p>{ai.error.retryable && <button type="button" disabled={disabled} onClick={ai.retry}>Tentar novamente</button>}
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
      <section className="ai-conversation__indicators" aria-labelledby="ai-indicators-title" aria-busy={ai.analysisPending}>
        <h3 id="ai-indicators-title">Indicadores por IA</h3>
        {ai.analysisPending && <p role="status">{ai.analysis ? 'Atualizando os indicadores com a IA…' : 'Gerando indicadores com a IA…'}</p>}
        {!ai.analysis && !ai.analysisPending && <p>Selecione o provedor e o modelo e clique em Analisar período para gerar os indicadores e as recomendações.</p>}
        {ai.analysis && <>
          <p className="ai-conversation__scope">Última análise concluída · {formatDay(ai.analysis.effectiveFilters.from)} a {formatDay(ai.analysis.effectiveFilters.to)}{ai.analysis.selection ? ` · ${ai.analysis.selection.provider} · ${ai.analysis.selection.model}` : ''}</p>
          {ai.analysis.answer.findings.length > 0 ? <AiFindings response={ai.analysis} /> : <p>A IA não identificou recomendações para os filtros selecionados. Consulte o resumo e as limitações da análise.</p>}
        </>}
      </section>
    </section>
  )
}
