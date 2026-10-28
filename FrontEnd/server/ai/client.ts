import OpenAI from 'openai'
import type { Response, ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses'
import type { Config } from '../config'
import { PublicError } from '../errors'

export interface Provider {
  create(params: ResponseCreateParamsNonStreaming, signal: AbortSignal): Promise<Response>
}
export function createProvider(config: Config): Provider {
  const client = new OpenAI({ apiKey: config.OPENAI_API_KEY, maxRetries: 0, timeout: config.AI_TIMEOUT_MS })
  return { create: (params, signal) => client.responses.create(params, { signal }) }
}
export function providerError(error: unknown): PublicError {
  if (error instanceof PublicError) return error
  if (error instanceof OpenAI.APIError) {
    if ([401, 403].includes(error.status ?? 0) || error.code === 'insufficient_quota') {
      return new PublicError('PROVIDER_AUTH_OR_QUOTA', 'Verifique a configuração e a cota da API no servidor.', 503)
    }
    if (error.status === 429) return new PublicError('RATE_LIMITED', 'O provedor atingiu um limite de uso. Aguarde e tente novamente.', 429, true)
  }
  return new PublicError('PROVIDER_ERROR', 'Não foi possível consultar o provedor de IA. Tente novamente.', 502, true)
}
