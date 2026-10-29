import { describe, expect, it, vi } from 'vitest'
import { readConfig } from '../config'
import { availableProviders, createModelStore, defaultSelection } from '../ai/models'

const signal = () => new AbortController().signal
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })
describe('catálogo de modelos', () => {
  it('sem chaves não faz consultas externas nem expõe segredos no status', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const config = readConfig({})
    const store = createModelStore(config, fetcher)
    expect(defaultSelection(config).provider).toBe('gemini')
    expect(availableProviders(config).every((p) => !p.configured)).toBe(true)
    expect((await store.list('gemini', signal())).models).toHaveLength(1)
    expect((await store.list('openrouter', signal())).models).toHaveLength(1)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('prefere o provedor configurado e respeita o padrão administrativo', () => {
    expect(defaultSelection(readConfig({ OPENROUTER_API_KEY: 'private' })).provider).toBe('openrouter')
    expect(defaultSelection(readConfig({ GEMINI_API_KEY: 'private', OPENROUTER_API_KEY: 'private', AI_DEFAULT_PROVIDER: 'openrouter' })).provider).toBe('openrouter')
    expect(JSON.stringify(availableProviders(readConfig({ GEMINI_API_KEY: 'private' })))).not.toContain('private')
  })
  it('pagina o Gemini e filtra modelos não textuais ou sem geração', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ nextPageToken: 'page-2', models: [
      { name: 'models/gemini-test', displayName: 'Gemini de teste', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-test-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
    ] })).mockResolvedValueOnce(json({ models: [
      { name: 'models/gemini-other', displayName: 'Outro Gemini', supportedGenerationMethods: ['generateContent'] },
    ] }))
    const store = createModelStore(readConfig({ GEMINI_API_KEY: 'secret', GEMINI_MODEL: 'gemini-test' }), fetcher)
    const catalog = await store.list('gemini', signal())
    expect(catalog.models.map((m) => m.id)).toEqual(['gemini-test', 'gemini-other'])
    expect(catalog.defaultModel).toBe('gemini-test')
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get('pageToken')).toBe('page-2')
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('x-goog-api-key')).toBe('secret')
    expect(await store.list('gemini', signal())).toBe(catalog)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('OpenRouter oferece apenas modelos textuais com ferramentas e remove duplicados', async () => {
    const model = { id: 'vendor/model', name: 'Modelo', supported_parameters: ['tools'], architecture: { output_modalities: ['text'] } }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ data: [model, model,
      { ...model, id: 'vendor/no-tools', supported_parameters: [] },
      { ...model, id: 'vendor/image', architecture: { output_modalities: ['image'] } },
    ] }))
    const store = createModelStore(readConfig({ OPENROUTER_API_KEY: 'secret' }), fetcher)
    expect((await store.list('openrouter', signal())).models).toEqual([{ id: model.id, name: model.name }])
    expect(String(fetcher.mock.calls[0][0])).toBe('https://openrouter.ai/api/v1/models')
  })
  it('falha do catálogo é controlada, não armazena erro e pode ser tentada novamente', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('private-key')).mockResolvedValueOnce(json({ data: [
      { id: 'v/model', name: 'Modelo', supported_parameters: ['tools'] },
    ] }))
    const store = createModelStore(readConfig({ OPENROUTER_API_KEY: 'private-key' }), fetcher)
    await expect(store.list('openrouter', signal())).rejects.toMatchObject({ code: 'MODEL_CATALOG_UNAVAILABLE' })
    expect((await store.list('openrouter', signal())).models).toHaveLength(1)
  })
  it('respeita aborto antes de consultar o catálogo', async () => {
    const controller = new AbortController(); controller.abort()
    const fetcher = vi.fn<typeof fetch>()
    await expect(createModelStore(readConfig({}), fetcher).list('gemini', controller.signal)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
