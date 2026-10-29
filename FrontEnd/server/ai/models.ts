import { z } from 'zod'
import type { AiProviderId, AiSelection, ModelCatalog } from '../../src/shared/aiContracts'
import { modelCatalogSchema, selectionSchema } from '../../src/shared/aiContracts'
import type { Config } from '../config'
import { PublicError } from '../errors'

export function providerSettings(config: Config, id: AiProviderId) {
  switch (id) {
    case 'gemini': return { key: config.GEMINI_API_KEY, model: config.GEMINI_MODEL, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' }
    case 'openrouter': return { key: config.OPENROUTER_API_KEY, model: config.OPENROUTER_MODEL, baseURL: 'https://openrouter.ai/api/v1' }
    case 'openai': return { key: config.OPENAI_API_KEY, model: config.OPENAI_MODEL, baseURL: 'https://api.openai.com/v1' }
  }
}
export function availableProviders(config: Config) {
  return (['gemini', 'openrouter', 'openai'] as const).map((id) => {
    const settings = providerSettings(config, id)
    return { id, configured: Boolean(settings.key), defaultModel: settings.model }
  })
}
export function defaultSelection(config: Config): AiSelection {
  const providers = availableProviders(config)
  const selected = providers.find((p) => p.id === config.AI_DEFAULT_PROVIDER && p.configured)
    ?? providers.find((p) => p.configured) ?? providers.find((p) => p.id === config.AI_DEFAULT_PROVIDER)!
  return { provider: selected.id, model: selected.defaultModel }
}
export interface ModelStore { list(provider: AiProviderId, signal: AbortSignal): Promise<ModelCatalog> }
const geminiPage = z.object({ models: z.array(z.object({ name: z.string(), displayName: z.string().optional(),
  supportedGenerationMethods: z.array(z.string()).default([]) })), nextPageToken: z.string().optional() })
const routerPage = z.object({ data: z.array(z.object({ id: z.string(), name: z.string(),
  supported_parameters: z.array(z.string()).default([]),
  architecture: z.object({ output_modalities: z.array(z.string()).optional() }).optional() })) })

export function createModelStore(config: Config, fetcher: typeof fetch = fetch): ModelStore {
  const cache = new Map<AiProviderId, { until: number; catalog: ModelCatalog }>()
  return { async list(provider, signal) {
    signal.throwIfAborted()
    const settings = providerSettings(config, provider)
    // Configuration can be inspected without credentials or an external request.
    if (!settings.key || provider === 'openai') return { provider, defaultModel: settings.model, models: [{ id: settings.model, name: settings.model }] }
    const cached = cache.get(provider)
    if (cached && cached.until > Date.now()) return cached.catalog
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)])
    try {
      let models: ModelCatalog['models'] = []
      if (provider === 'gemini') {
        let pageToken: string | undefined
        for (let page = 0; page < 5; page++) {
          const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
          url.searchParams.set('pageSize', '1000')
          if (pageToken) url.searchParams.set('pageToken', pageToken)
          const response = await fetcher(url, { headers: { 'x-goog-api-key': settings.key }, signal: requestSignal })
          if (!response.ok) throw new Error('Catalog unavailable')
          const result = geminiPage.parse(await response.json())
          models.push(...result.models.filter((m) => m.name.startsWith('models/gemini-')
            && m.supportedGenerationMethods.includes('generateContent')
            && !/image|tts|audio|live|robotics|embedding|computer-use|omni/i.test(m.name))
            .map((m) => ({ id: m.name.slice('models/'.length), name: (m.displayName ?? m.name).slice(0, 200) })))
          pageToken = result.nextPageToken
          if (!pageToken) break
          if (page === 4) throw new Error('Catalog pagination exceeded')
        }
      } else {
        const response = await fetcher('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${settings.key}` }, signal: requestSignal,
        })
        if (!response.ok) throw new Error('Catalog unavailable')
        models = routerPage.parse(await response.json()).data.filter((m) => m.supported_parameters.includes('tools')
          && (m.architecture?.output_modalities ?? ['text']).includes('text'))
          .map((m) => ({ id: m.id, name: m.name.slice(0, 200) }))
      }
      models = [...new Map(models.filter((m) => selectionSchema.safeParse({ provider, model: m.id }).success).map((m) => [m.id, m])).values()]
        .sort((a, b) => a.name.localeCompare(b.name))
      if (!models.length) throw new Error('Empty catalog')
      const catalog = modelCatalogSchema.parse({ provider, models, defaultModel: models.some((m) => m.id === settings.model) ? settings.model : models[0].id })
      cache.set(provider, { until: Date.now() + 300000, catalog })
      return catalog
    } catch {
      signal.throwIfAborted()
      throw new PublicError('MODEL_CATALOG_UNAVAILABLE', 'Não foi possível listar os modelos. Verifique a chave do provedor no servidor e tente novamente.', 503, true)
    }
  } }
}
