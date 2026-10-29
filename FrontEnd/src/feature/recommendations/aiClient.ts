import { assistResponseSchema, statusSchema } from '../../shared/aiContracts'
import type { AssistRequest } from '../../shared/aiContracts'

export class AiClientError extends Error {
  readonly code: string
  readonly retryable: boolean
  constructor(code: string, message: string, retryable = true) {
    super(message)
    this.code = code
    this.retryable = retryable
  }
}
export async function getAiStatus(signal: AbortSignal) {
  const response = await fetch('/api/ai/status', { signal })
  if (!response.ok) throw new AiClientError('UNAVAILABLE', 'A API local está indisponível. Inicie o backend para gerar indicadores e recomendações por IA.')
  return statusSchema.parse(await response.json())
}
export async function assist(request: AssistRequest, signal: AbortSignal) {
  const response = await fetch('/api/ai/assist', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal,
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (body && typeof body === 'object' && 'error' in body && body.error && typeof body.error === 'object') {
      const error = body.error
      if ('code' in error && typeof error.code === 'string' && 'message' in error && typeof error.message === 'string') {
        throw new AiClientError(error.code, error.message, 'retryable' in error && error.retryable === true)
      }
    }
    throw new AiClientError('UNAVAILABLE', 'Não foi possível consultar a IA. Tente novamente.')
  }
  const result = assistResponseSchema.safeParse(body)
  if (!result.success) throw new AiClientError('INVALID_AI_RESPONSE', 'A IA retornou uma resposta inválida. Tente novamente.')
  const canonical = (f: AssistRequest['filters']) => JSON.stringify([f.from, f.to, [...new Set(f.trapCodes)].sort(), [...new Set(f.pestKeys)].sort()])
  if (result.data.datasetVersion !== request.datasetVersion || canonical(result.data.effectiveFilters) !== canonical(request.filters)) {
    throw new AiClientError('DATASET_CHANGED', 'O contexto da resposta mudou. Recarregue os dados e inicie uma nova conversa.', false)
  }
  if (request.provider && (!result.data.selection || result.data.selection.provider !== request.provider || result.data.selection.model !== request.model)) {
    throw new AiClientError('INVALID_AI_RESPONSE', 'A resposta não corresponde ao provedor e modelo selecionados. Tente novamente.')
  }
  return result.data
}
