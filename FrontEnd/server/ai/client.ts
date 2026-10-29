import OpenAI from 'openai'
import type { Response, ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses'
import type { AiSelection } from '../../src/shared/aiContracts'
import type { Config } from '../config'
import { PublicError } from '../errors'
import { providerSettings } from './models'
import { createChatProvider } from './chatProvider'

export interface Provider {
  create(params: ResponseCreateParamsNonStreaming, signal: AbortSignal): Promise<Pick<Response, 'status' | 'output'> & {
    usage?: { input_tokens: number; output_tokens: number; total_tokens: number }
  }>
}
export function createProvider(config: Config, selection: AiSelection): Provider {
  const settings = providerSettings(config, selection.provider)
  const client = new OpenAI({ apiKey: settings.key, baseURL: settings.baseURL, maxRetries: 0, timeout: config.AI_TIMEOUT_MS })
  if (selection.provider !== 'openai') return createChatProvider(client, selection.provider, config.AI_MAX_INPUT_TOKENS)
  return { create: (params, signal) => client.responses.create(params, { signal }) }
}
export function providerError(error: unknown): PublicError {
  if (error instanceof PublicError) return error
  if (error instanceof OpenAI.APIError) {
    if ([401, 402, 403].includes(error.status ?? 0) || error.code === 'insufficient_quota') {
      return new PublicError('PROVIDER_AUTH_OR_QUOTA', 'Verifique a configuração e a cota da API no servidor.', 503)
    }
    if (error.status === 429) return new PublicError('RATE_LIMITED', 'O provedor atingiu um limite de uso. Aguarde e tente novamente.', 429, true)
  }
  return new PublicError('PROVIDER_ERROR', 'Não foi possível consultar o provedor de IA. Tente novamente.', 502, true)
}
