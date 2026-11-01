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
  return createChatProvider(client, selection.provider, config.AI_MAX_INPUT_TOKENS)
}
export function providerError(error: unknown): PublicError {
  if (error instanceof PublicError) return error
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new PublicError('PROVIDER_TIMEOUT', 'O modelo selecionado não respondeu no prazo. Tente novamente ou escolha outro modelo.', 504, true)
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new PublicError('PROVIDER_CONNECTION', 'Não foi possível conectar ao provedor de IA. Verifique a conexão do servidor e tente novamente.', 503, true)
  }
  if (error instanceof OpenAI.APIError) {
    if ([401, 402, 403].includes(error.status ?? 0) || error.code === 'insufficient_quota') {
      return new PublicError('PROVIDER_AUTH_OR_QUOTA', 'Verifique a configuração e a cota da API no servidor.', 503)
    }
    if (error.status === 429) return new PublicError('RATE_LIMITED', 'O provedor atingiu um limite de uso. Aguarde e tente novamente.', 429, true)
    if ([400, 422].includes(error.status ?? 0)) return new PublicError('PROVIDER_REQUEST_REJECTED', 'O modelo selecionado rejeitou o formato da consulta. Escolha outro modelo.', 502)
    if (error.status === 404) return new PublicError('PROVIDER_MODEL_UNAVAILABLE', 'O modelo selecionado não está disponível para esta chave. Atualize a lista e escolha outro modelo.', 503)
    if (error.status === 503) return new PublicError('PROVIDER_UNAVAILABLE', 'O provedor de IA está temporariamente indisponível. Aguarde ou escolha outro modelo.', 503, true)
  }
  return new PublicError('PROVIDER_ERROR', 'Não foi possível consultar o provedor de IA. Tente novamente.', 502, true)
}
