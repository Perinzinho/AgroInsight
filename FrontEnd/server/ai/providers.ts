import type { AiProviderId, AiProviderOption, AiSelection, AssistRequest } from '../../src/shared/aiContracts'
import type { Config } from '../config'
import { PublicError } from '../errors'

export function providerKey(config: Config, id: AiProviderId): string {
  switch (id) {
    case 'gemini': return config.GEMINI_API_KEY
    case 'openrouter': return config.OPENROUTER_API_KEY
    case 'openai': return config.OPENAI_API_KEY
  }
}
export function providerOptions(config: Config): AiProviderOption[] {
  return [
    { id: 'gemini' as const, name: 'Gemini', defaultModel: config.GEMINI_MODEL, models: config.GEMINI_MODELS },
    { id: 'openrouter' as const, name: 'OpenRouter', defaultModel: config.OPENROUTER_MODEL, models: config.OPENROUTER_MODELS },
    { id: 'openai' as const, name: 'OpenAI', defaultModel: config.OPENAI_MODEL, models: config.OPENAI_MODELS },
  ].map((option) => ({ ...option, configured: Boolean(providerKey(config, option.id)), models: [...new Set([option.defaultModel, ...option.models])] }))
}
export function defaultSelection(config: Config): AiSelection {
  const options = providerOptions(config)
  const option = options.find((item) => item.id === config.AI_PROVIDER) ?? options.find((item) => item.configured) ?? options[0]
  return { provider: option.id, model: option.defaultModel }
}
export function resolveSelection(config: Config, request: Pick<AssistRequest, 'provider' | 'model'>): AiSelection {
  const selection = request.provider && request.model ? { provider: request.provider, model: request.model } : defaultSelection(config)
  const option = providerOptions(config).find((item) => item.id === selection.provider)!
  if (!option.models.includes(selection.model)) throw new PublicError('INVALID_REQUEST', 'Selecione um modelo disponível para este provedor.', 400)
  if (!option.configured) throw new PublicError('AI_NOT_CONFIGURED', `Configure a chave de ${option.name} no servidor para usar este provedor.`, 503)
  return selection
}
