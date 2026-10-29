import { useState } from 'react'
import type { Filters } from '../../shared/agroContracts'
import { formatDay, formatNumber } from '../../core/utils/format'
import AgroIcon from '../../core/components/agroIcon'
import { useAiAssistant } from './useAiAssistant'
import { useAiSettings } from './useAiSettings'
import { providerLabels, providerIdSchema } from '../../shared/aiContracts'

const suggestions = ['O que merece atenção neste período?', 'Quais pragas tiveram mais detecções?', 'Como ficou o balanço hídrico?', 'Há registros de pulverização nesse período?', 'Quais limitações impedem uma conclusão?']
type ConversationProps = {
  filters: Filters; datasetVersion: string; contextChanged: boolean; onReload: () => void;
}
export default function AiConversation(props: ConversationProps) {
  const settings = useAiSettings()
  const scope = JSON.stringify([settings.selection.provider, settings.selection.model, props.datasetVersion,
    props.filters.from, props.filters.to, [...props.filters.trapCodes].sort(), [...props.filters.pestKeys].sort()])
  return <ConversationSession key={scope} {...props} settings={settings} />
}
function ConversationSession({ filters, datasetVersion, contextChanged, onReload, settings }: ConversationProps & { settings: ReturnType<typeof useAiSettings> }) {
  const ai = useAiAssistant(filters, datasetVersion, settings.selection)
  const [message, setMessage] = useState('')
  const unavailable = settings.status !== null && settings.unavailable
  const disabled = ai.pending || unavailable || settings.checkingStatus || settings.modelsLoading
  const selectedProvider = settings.providers.find((provider) => provider.id === settings.selection.provider)!
  const submit = () => { if (!disabled && message.trim()) { ai.send('chat', message); setMessage('') } }
  return (
    <section className="ai-conversation" aria-labelledby="ai-title">
      <header className="ai-conversation__heading">
        <div><h3 id="ai-title"><AgroIcon name="recommendations" /> Análise por IA</h3>
          <p>Consulte os registros do período com fontes e limitações. Cada envio solicita uma análise à API.</p></div>
        <button type="button" onClick={() => ai.send('analysis')} disabled={disabled}>Analisar período</button>
      </header>
      <p className="ai-conversation__scope">{formatDay(filters.from)} a {formatDay(filters.to)} · Horário da propriedade: America/Sao_Paulo. As medições podem ser históricas.</p>
      <div className="ai-conversation__settings">
        <label>Provedor de IA<select value={settings.selection.provider} onChange={(event) => settings.chooseProvider(providerIdSchema.parse(event.target.value))}>
          {settings.providers.filter((provider) => provider.id !== 'openai' || provider.configured).map((provider) => <option key={provider.id} value={provider.id}>{providerLabels[provider.id]}{provider.configured ? '' : ' · não configurado'}</option>)}
        </select></label>
        <label>Modelo<select value={settings.selection.model} disabled={settings.modelsLoading || settings.checkingStatus} onChange={(event) => settings.chooseModel(event.target.value)}>
          {!settings.models.some((model) => model.id === settings.selection.model) && <option value={settings.selection.model} disabled>Modelo indisponível · {settings.selection.model}</option>}
          {settings.models.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.id}</option>)}
        </select></label>
        <button type="button" onClick={settings.refreshModels} disabled={settings.modelsLoading || settings.checkingStatus}>Atualizar modelos</button>
      </div>
      {settings.modelsLoading && <p role="status">Carregando modelos…</p>}
      {settings.modelsError && <p role="alert">{settings.modelsError.message}</p>}
      {settings.notice && <p role="status">{settings.notice}</p>}
      {contextChanged && <p role="status">Os filtros ou a versão da base mudaram. Uma nova conversa foi iniciada.</p>}
      {unavailable && <p role="status">{settings.status?.message ?? (!selectedProvider.configured ? `${providerLabels[selectedProvider.id]} não está configurado no servidor. Os indicadores por regras continuam disponíveis.` : 'Escolha um modelo disponível para continuar.')}</p>}
      <div className="ai-conversation__suggestions" role="group" aria-label="Perguntas sugeridas">
        {suggestions.map((text) => <button key={text} type="button" disabled={disabled} onClick={() => ai.send('chat', text)}>{text}</button>)}
      </div>
      <div className="ai-conversation__messages" aria-label="Conversa">
        {ai.messages.map((item, i) => item.role === 'user'
          ? <article className="ai-conversation__user" key={i}><strong>Você</strong><p>{item.content}</p></article>
          : <article className="ai-conversation__answer" key={i}>
            <strong>Assistente · Análise por IA</strong>
            {item.response.selection && <small>{providerLabels[item.response.selection.provider]} · {item.response.selection.model}</small>}
            <p>{item.response.answer.summary}</p>
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
          {unavailable && <button type="button" onClick={settings.refreshStatus} disabled={settings.checkingStatus}>{settings.checkingStatus ? 'Verificando disponibilidade…' : 'Verificar disponibilidade'}</button>}
        </div>
      </form>
    </section>
  )
}
