import { useEffect, useRef, useState } from 'react'
import type { Filters } from '../../shared/agroContracts'
import type { AiAssistResponse, AiSelection, AssistRequest } from '../../shared/aiContracts'
import { AiClientError, assist } from './aiClient'

export type ConversationMessage = { role: 'user'; content: string } | { role: 'assistant'; response: AiAssistResponse }
export function useAiAssistant(filters: Filters, datasetVersion: string, selection: AiSelection) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [error, setError] = useState<AiClientError | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const running = useRef<AbortController | null>(null)
  const lastRequest = useRef<AssistRequest | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; running.current?.abort(); running.current = null }
  }, [])

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
        setMessages((current) => [...current, { role: 'assistant', response }])
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
    if (running.current || (mode === 'chat' && !message?.trim())) return
    // Only completed exchanges belong in the next turn's context.
    const history: AssistRequest['history'] = messages.flatMap((item, index) => {
      const question = messages[index - 1]
      return item.role === 'assistant' && question?.role === 'user'
        ? [{ role: 'user' as const, content: question.content.slice(0, 2000) },
          { role: 'assistant' as const, content: item.response.answer.summary.slice(0, 2000) }]
        : []
    }).slice(-12)
    while (history.reduce((sum, item) => sum + item.content.length, 0) > 12000) history.splice(0, 2)
    void execute({ mode, message: message?.trim(), filters: structuredClone(filters), datasetVersion, history, selection: { ...selection } }, true)
  }
  function cancel() {
    running.current?.abort(); running.current = null
    setPending(false); setNotice('Análise cancelada. O processamento já realizado pode ser cobrado pelo provedor.')
  }
  function clear() {
    cancel(); setMessages([]); setError(null); setNotice('Conversa limpa.'); lastRequest.current = null
  }
  return { messages, error, pending, notice, send, cancel, clear,
    retry: () => { if (lastRequest.current) void execute(lastRequest.current, false) } }
}
