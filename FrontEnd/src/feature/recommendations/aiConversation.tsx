import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Filters } from '../../shared/agroContracts'
import { formatDay, formatNumber } from '../../core/utils/format'
import AgroIcon, { type AgroIconName } from '../../core/components/agroIcon'
import { useAiAssistant } from './useAiAssistant'
import { useAiSettings } from './useAiSettings'
import { providerLabels, providerIdSchema } from '../../shared/aiContracts'

const suggestions: { label: string; question: string; icon: AgroIconName }[] = [
  { label: 'Pragas em destaque', question: 'Quais pragas tiveram mais detecções?', icon: 'pests' },
  { label: 'Chuva e clima', question: 'Como ficou o balanço hídrico?', icon: 'climate' },
  { label: 'Operações no campo', question: 'Há registros de pulverização na base?', icon: 'operations' },
]

type ConversationProps = {
  filters: Filters; datasetVersion: string; contextChanged: boolean; onReload: () => void;
}

export default function AiConversation(props: ConversationProps) {
  const settings = useAiSettings()
  const [message, setMessage] = useState('')
  const scope = JSON.stringify([settings.selection.provider, settings.selection.model, props.datasetVersion,
    props.filters.from, props.filters.to, [...props.filters.trapCodes].sort(), [...props.filters.pestKeys].sort()])
  return <ConversationSession key={scope} {...props} settings={settings} message={message} setMessage={setMessage} />
}

function ConversationSession({ filters, datasetVersion, contextChanged, onReload, settings, message, setMessage }: ConversationProps & {
  settings: ReturnType<typeof useAiSettings>; message: string; setMessage: (value: string) => void;
}) {
  const ai = useAiAssistant(filters, datasetVersion, settings.selection)
  const input = useRef<HTMLTextAreaElement>(null)
  const endOfMessages = useRef<HTMLDivElement>(null)
  const unavailable = settings.status !== null && settings.unavailable
  const disabled = ai.pending || unavailable || settings.checkingStatus || settings.modelsLoading
  const selectedProvider = settings.providers.find((provider) => provider.id === settings.selection.provider)!
  const hasMessages = ai.messages.length > 0
  const unavailableMessage = settings.status?.message ?? (!selectedProvider.configured
    ? `${providerLabels[selectedProvider.id]} não está configurado no servidor. Os indicadores por regras continuam disponíveis.`
    : 'Escolha um modelo disponível para continuar.')
  const submit = () => { if (!disabled && message.trim()) { ai.send('chat', message); setMessage('') } }
  const newConversation = () => { ai.clear(); setMessage(''); input.current?.focus() }

  useLayoutEffect(() => {
    if (!input.current) return
    input.current.style.height = 'auto'
    input.current.style.height = `${Math.min(input.current.scrollHeight, 180)}px`
  }, [message])

  useEffect(() => {
    if (!hasMessages) return
    endOfMessages.current?.scrollIntoView?.({ block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [ai.messages.length, ai.pending, hasMessages])

  return (
    <section className={`ai-conversation${hasMessages ? ' ai-conversation--active' : ''}`} aria-labelledby="ai-title">
      <header className="ai-conversation__toolbar">
        <div className="ai-conversation__identity">
          <AgroIcon name="recommendations" width="20" height="20" />
          <h1 id="ai-title">Assistente de campo</h1>
          <span className="ai-conversation__beta">IA</span>
        </div>
        <button className="ai-conversation__new" type="button" onClick={newConversation} aria-label="Nova conversa"
          disabled={!hasMessages && !message} title="Começar uma nova conversa">
          <AgroIcon name="plus" width="16" height="16" /><span>Nova conversa</span>
        </button>
      </header>

      <div className="ai-conversation__workspace">
        {!hasMessages && <div className="ai-conversation__welcome">
          <div className="ai-conversation__welcome-mark"><AgroIcon name="leaf" width="30" height="30" /></div>
          <h2>O que vamos entender<br />do campo hoje?</h2>
          <p>Converse com os dados da sua propriedade.<br className="ai-conversation__desktop-break" /> Descubra o que merece um olhar mais atento.</p>
        </div>}

        {hasMessages && <div className="ai-conversation__messages" aria-label="Conversa" aria-busy={ai.pending}>
          {ai.messages.map((item, i) => item.role === 'user'
            ? <article className="ai-conversation__user" key={i}><strong className="recommendations__sr-only">Você</strong><p>{item.content}</p></article>
            : <article className="ai-conversation__answer" key={i}>
              <div className="ai-conversation__answer-heading"><span className="ai-conversation__avatar"><AgroIcon name="leaf" width="18" height="18" /></span>
                <strong>AgroInsight</strong>
                {item.response.selection && <small>{providerLabels[item.response.selection.provider]} · {item.response.selection.model}</small>}
              </div>
              <p className="ai-conversation__answer-summary">{item.response.answer.summary}</p>
              {item.response.answer.findings.map((finding) => <section className="ai-conversation__finding" key={finding.id}>
                <h3 aria-label={`Prioridade ${finding.priority} · ${finding.title}`}><span aria-hidden="true" className={`recommendations__priority recommendations__priority--${finding.priority}`}>P{finding.priority}</span>{finding.title}</h3>
                <p>{finding.explanation}</p><p><strong>Verificação sugerida:</strong> {finding.suggestedAction}</p>
                <ul className="ai-conversation__evidence">{finding.evidenceIds.map((id) => {
                  const evidence = item.response.evidence.find((e) => e.id === id)!
                  return <li key={id}><strong>{evidence.label}:</strong> {typeof evidence.value === 'number' ? formatNumber(evidence.value, Number.isInteger(evidence.value) ? 0 : 2) : evidence.value ?? 'Sem dados'} {evidence.unit}
                    <small>Fonte: {evidence.source} · {evidence.scope}{evidence.from && evidence.to ? ` · ${formatDay(evidence.from)} a ${formatDay(evidence.to)}` : ''}</small>
                    <a href={evidence.href}>{evidence.href === '#/operacoes' ? 'Abrir histórico de operações' : 'Consultar dados'} <AgroIcon name="arrowUpRight" width="12" height="12" /></a></li>
                })}</ul>
                {finding.limitations.length > 0 && <ul className="ai-conversation__limitations" aria-label="Limitações do achado">{finding.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
              </section>)}
              {item.response.answer.limitations.length > 0 && <details className="ai-conversation__sources" open><summary>Limitações da análise</summary><ul>{item.response.answer.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
              <details className="ai-conversation__sources"><summary>Cobertura e fontes consultadas</summary>
                <p>Período: {formatDay(item.response.effectiveFilters.from)} a {formatDay(item.response.effectiveFilters.to)}. Os links abrem as telas existentes, sem aplicar um período.</p>
                <ul>{item.response.evidence.map((evidence) => <li key={evidence.id}>{evidence.label}: {evidence.value ?? 'Sem dados'} {evidence.unit} · {evidence.source} · {evidence.scope} <a href={evidence.href}>{evidence.href === '#/operacoes' ? 'Abrir histórico de operações' : 'Consultar dados'}</a></li>)}</ul>
              </details>
              <div className="ai-conversation__followups">{item.response.answer.followUpQuestions.map((text, index) => <button type="button" key={index} disabled={disabled} onClick={() => ai.send('chat', text)}>{text}<AgroIcon name="arrow" width="14" height="14" /></button>)}</div>
            </article>)}
        </div>}

        <div className="ai-conversation__feedback" role="status" aria-live="polite">
          {ai.pending ? <span className="ai-conversation__thinking"><AgroIcon name="leaf" width="17" height="17" /> Consultando os registros da propriedade…</span>
            : ai.notice || (hasMessages && ai.messages.at(-1)?.role === 'assistant' ? 'Análise concluída.' : '')}
        </div>
        {settings.notice && <p className="ai-conversation__notice" role="status">{settings.notice}</p>}
        {contextChanged && <p className="ai-conversation__notice" role="status">A base de dados mudou. Uma nova conversa foi iniciada.</p>}
        {ai.error && <div className="ai-conversation__error" role="alert"><p>{ai.error.message}</p>
          {ai.error.retryable && <button type="button" disabled={ai.pending} onClick={ai.retry}>Tentar novamente</button>}
          {ai.error.code === 'DATASET_CHANGED' && <button type="button" onClick={onReload}>Recarregar dados</button>}
        </div>}
        <div ref={endOfMessages} />

        <div className="ai-conversation__compose-area">
          <form className="ai-conversation__composer" onSubmit={(event) => { event.preventDefault(); submit() }}>
            <label className="recommendations__sr-only" htmlFor="ai-question">Pergunte sobre os registros</label>
            <textarea ref={input} id="ai-question" rows={2} maxLength={2000} value={message}
              aria-describedby="ai-input-hint" placeholder="Pergunte algo sobre sua propriedade…" onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() } }} />
            <div className="ai-conversation__composer-toolbar">
              <div className="ai-conversation__settings">
                <label className="ai-conversation__provider"><span className="recommendations__sr-only">Provedor de IA</span>
                  <span aria-hidden="true" className={`ai-conversation__connection-dot${selectedProvider.configured ? ' is-configured' : ''}`} />
                  <select value={settings.selection.provider} onChange={(event) => settings.chooseProvider(providerIdSchema.parse(event.target.value))}>
                    {settings.providers.filter((provider) => provider.id !== 'openai' || provider.configured).map((provider) => <option key={provider.id} value={provider.id}>{providerLabels[provider.id]}</option>)}
                  </select>
                </label>
                <span className="ai-conversation__settings-divider" />
                <label className="ai-conversation__model"><span className="recommendations__sr-only">Modelo</span>
                  <select value={settings.selection.model} disabled={settings.modelsLoading || settings.checkingStatus} onChange={(event) => settings.chooseModel(event.target.value)}>
                    {!settings.models.some((model) => model.id === settings.selection.model) && <option value={settings.selection.model} disabled>Modelo indisponível · {settings.selection.model}</option>}
                    {settings.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                  </select>
                </label>
                <button className="ai-conversation__icon-button" type="button" onClick={settings.refreshModels} disabled={settings.modelsLoading || settings.checkingStatus} aria-label="Atualizar modelos" title="Atualizar modelos"><AgroIcon name="refresh" width="15" height="15" /></button>
              </div>
              {ai.pending
                ? <button className="ai-conversation__send" type="button" onClick={ai.cancel} aria-label="Cancelar" title="Cancelar análise"><AgroIcon name="stop" width="18" height="18" /></button>
                : <button className="ai-conversation__send" type="submit" disabled={disabled || !message.trim()} aria-label="Enviar" title="Enviar pergunta"><AgroIcon name="send" width="20" height="20" /></button>}
            </div>
          </form>
          <div className="ai-conversation__input-hint" id="ai-input-hint"><span>Enter envia <span aria-hidden="true">·</span> Shift+Enter para uma nova linha</span>{message.length > 0 && <span>{message.length}/2.000</span>}</div>

          <div className={hasMessages ? 'ai-conversation__quick-actions' : 'ai-conversation__suggestions'} role="group" aria-label="Perguntas sugeridas">
            <button type="button" disabled={disabled} onClick={() => ai.send('analysis')}><AgroIcon name="recommendations" width="16" height="16" />Analisar propriedade</button>
            {suggestions.map(({ label, question, icon }) => <button key={question} type="button" disabled={disabled} title={question} aria-label={`${label}: ${question}`} onClick={() => ai.send('chat', question)}><AgroIcon name={icon} width="16" height="16" />{label}</button>)}
          </div>

          {(settings.checkingStatus || settings.modelsLoading) && <p className="ai-conversation__notice" role="status">{settings.checkingStatus ? 'Verificando conexão…' : 'Carregando modelos…'}</p>}
          {settings.modelsError && <p className="ai-conversation__error" role="alert">{settings.modelsError.message}</p>}
          {unavailable && !settings.modelsError && <div className="ai-conversation__connection">
            <AgroIcon name="info" width="16" height="16" />
            <div><p role="status">{unavailableMessage}</p>
              <details><summary>Como conectar a IA</summary><p>Configure a chave do provedor no servidor e reinicie a API. Depois, verifique a disponibilidade aqui para começar a conversar.</p></details>
            </div>
            <button type="button" onClick={settings.refreshStatus} disabled={settings.checkingStatus}>{settings.checkingStatus ? 'Verificando…' : 'Verificar disponibilidade'}</button>
          </div>}
        </div>
      </div>

      <footer className="ai-conversation__context">
        <span><AgroIcon name="quality" width="14" height="14" />Toda a base da propriedade <span aria-hidden="true">·</span> {formatDay(filters.from)} a {formatDay(filters.to)}</span>
        <small>A IA pode errar. Confira as fontes antes de decidir.</small>
      </footer>
    </section>
  )
}
