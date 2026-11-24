import { assistResponseSchema, modelCatalogSchema, statusSchema } from '../../shared/aiContracts'
import type { AiProviderId, AssistRequest } from '../../shared/aiContracts'

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
  if (!response.ok) throw new AiClientError('UNAVAILABLE', 'A API local está indisponível. Inicie o backend; os indicadores por regras continuam disponíveis.')
  return statusSchema.parse(await response.json())
}
export async function getAiModels(provider: AiProviderId, signal: AbortSignal) {
  const response = await fetch(`/api/ai/models?provider=${encodeURIComponent(provider)}`, { signal })
  if (!response.ok) throw new AiClientError('MODEL_CATALOG_UNAVAILABLE', 'Não foi possível carregar os modelos. Verifique a configuração do provedor e tente novamente.')
  const result = modelCatalogSchema.safeParse(await response.json())
  if (!result.success || result.data.provider !== provider) throw new AiClientError('MODEL_CATALOG_UNAVAILABLE', 'A lista de modelos recebida é inválida. Tente novamente.')
  return result.data
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
  if (request.selection && (result.data.selection?.provider !== request.selection.provider || result.data.selection?.model !== request.selection.model)) {
    throw new AiClientError('MODEL_CHANGED', 'O provedor ou modelo da resposta não corresponde ao selecionado. Inicie uma nova conversa.', false)
  }
  const canonical = (f: AssistRequest['filters']) => JSON.stringify([f.from, f.to, [...new Set(f.trapCodes)].sort(), [...new Set(f.pestKeys)].sort()])
  if (result.data.datasetVersion !== request.datasetVersion || canonical(result.data.effectiveFilters) !== canonical(request.filters)) {
    throw new AiClientError('DATASET_CHANGED', 'O contexto da resposta mudou. Recarregue os dados e inicie uma nova conversa.', false)
  }
  return result.data
}
