import { useEffect, useRef, useState } from 'react'
import type { Filters } from '../../shared/agroContracts'
import { aiSelectionSchema } from '../../shared/aiContracts'
import type { AiAssistResponse, AiSelection, AiStatus, AssistRequest } from '../../shared/aiContracts'
import { AiClientError, assist, getAiStatus } from './aiClient'

export type ConversationMessage = { role: 'user'; content: string } | { role: 'assistant'; response: AiAssistResponse; mode: AssistRequest['mode'] }
const preferenceKey = 'agroinsight.ai.selection'
function savedSelection(): AiSelection | null {
  try {
    const parsed = aiSelectionSchema.safeParse(JSON.parse(localStorage.getItem(preferenceKey) ?? 'null'))
    return parsed.success ? parsed.data : null
  } catch { return null }
}
export function useAiAssistant(filters: Filters, datasetVersion: string) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [statusAttempt, setStatusAttempt] = useState(0)
  const [error, setError] = useState<AiClientError | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [selection, setSelection] = useState<AiSelection | null>(savedSelection)
  const selectionRef = useRef(selection)
  const selectedProvider = status?.providers.find((option) => option.id === selection?.provider)
  const selectionReady = Boolean(selectedProvider?.configured && selection && selectedProvider.models.includes(selection.model))
  const running = useRef<AbortController | null>(null)
  const lastRequest = useRef<AssistRequest | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; running.current?.abort(); running.current = null }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getAiStatus(controller.signal).then((value) => {
      if (mounted.current && !controller.signal.aborted) {
        setStatus(value)
        const current = selectionRef.current
        const next = current && value.providers.some((option) => option.id === current.provider && option.models.includes(current.model)) ? current : value.defaultSelection
        if (current && (current.provider !== next.provider || current.model !== next.model)) {
          running.current?.abort(); running.current = null; lastRequest.current = null
          setPending(false); setMessages([]); setError(null)
          setNotice('A seleção anterior não está disponível. Uma nova conversa foi iniciada com o modelo padrão.')
        }
        selectionRef.current = next; setSelection(next)
      }
    }).catch(() => {
      if (mounted.current && !controller.signal.aborted) setStatus({ configured: false, dataReady: false, datasetVersion: null,
        message: 'A API local está indisponível. Inicie o backend para gerar indicadores e recomendações por IA.',
        providers: [], defaultSelection: { provider: 'gemini', model: 'gemini-3.8-flash' } })
    }).finally(() => {
      if (mounted.current && !controller.signal.aborted) setCheckingStatus(false)
    })
    return () => controller.abort()
  }, [statusAttempt])

  async function execute(request: AssistRequest, appendUser: boolean) {
    if (running.current) return
    const controller = new AbortController()
    running.current = controller
    lastRequest.current = request
    setPending(true); setError(null); setNotice('')
    if (appendUser) setMessages((current) => [...current, { role: 'user', content: request.mode === 'analysis' ? 'Analisar período' : request.message! }])
    try {
      const response = await assist(request, controller.signal)
      if (mounted.current && running.current === controller && !controller.signal.aborted) {
        setMessages((current) => [...current, { role: 'assistant', response, mode: request.mode }])
      }
    } catch (cause) {
      if (mounted.current && running.current === controller && !controller.signal.aborted) {
        setError(cause instanceof AiClientError ? cause : new AiClientError('UNAVAILABLE', 'Não foi possível concluir a análise. Tente novamente.'))
      }
    } finally {
      if (mounted.current && running.current === controller) { running.current = null; setPending(false) }
    }
  }
  function send(mode: 'analysis' | 'chat', message?: string) {
    if (running.current || !selectionReady || !selection || !status?.dataReady || checkingStatus || (mode === 'chat' && !message?.trim())) return
    // Only completed exchanges belong in the next turn's context.
    const history: AssistRequest['history'] = messages.flatMap((item, index) => {
      const question = messages[index - 1]
      return item.role === 'assistant' && question?.role === 'user'
        ? [{ role: 'user' as const, content: question.content.slice(0, 2000) },
          { role: 'assistant' as const, content: item.response.answer.summary.slice(0, 2000) }]
        : []
    }).slice(-12)
    while (history.reduce((sum, item) => sum + item.content.length, 0) > 12000) history.splice(0, 2)
    void execute({ mode, message: message?.trim(), filters: structuredClone(filters), datasetVersion, history, ...selection }, true)
  }
  function cancel() {
    running.current?.abort(); running.current = null
    setPending(false); setNotice('Análise cancelada. O processamento já realizado pode ser cobrado pelo provedor.')
  }
  function clear() {
    cancel(); setMessages([]); setError(null); setNotice('Conversa limpa.'); lastRequest.current = null
  }
  function refreshStatus() {
    if (checkingStatus) return
    setCheckingStatus(true)
    setStatusAttempt((value) => value + 1)
  }
  function changeSelection(next: AiSelection) {
    if (next.provider === selection?.provider && next.model === selection.model) return
    const option = status?.providers.find((item) => item.id === next.provider)
    if (!option?.models.includes(next.model)) return
    cancel(); setMessages([]); setError(null); lastRequest.current = null
    selectionRef.current = next; setSelection(next); setNotice('Provedor ou modelo alterado. Uma nova conversa foi iniciada.')
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)) } catch { /* Preferences are optional. */ }
  }
  const analysis = messages.flatMap((item) => item.role === 'assistant' && item.mode === 'analysis' ? [item.response] : []).at(-1)
  const analysisPending = pending && lastRequest.current?.mode === 'analysis'
  return { messages, analysis, analysisPending, status, checkingStatus, selection, selectedProvider, selectionReady, changeSelection, error, pending, notice, send, cancel, clear, refreshStatus,
    retry: () => { if (lastRequest.current && selectionReady && status?.dataReady && !checkingStatus) void execute(lastRequest.current, false) } }
}
