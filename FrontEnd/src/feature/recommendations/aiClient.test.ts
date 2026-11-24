import { afterEach, describe, expect, it, vi } from 'vitest'
import { assist, getAiModels, getAiStatus } from './aiClient'
import type { AssistRequest } from '../../shared/aiContracts'

const request: AssistRequest = { mode: 'chat', message: 'Choveu?', filters: { from: '2026-02-19', to: '2026-02-25', trapCodes: [], pestKeys: [] }, datasetVersion: 'v1', history: [] }
const output = { requestId: 'id', generatedAt: '2026-10-27T12:00:00Z', datasetVersion: 'v1', effectiveFilters: request.filters,
  answer: { summary: 'Histórico.', findings: [], limitations: ['Sem previsão.'], followUpQuestions: [] }, evidence: [] }
afterEach(() => { vi.unstubAllGlobals() })
describe('cliente HTTP da análise', () => {
  it('usa caminho relativo, contrato JSON e sinal de cancelamento', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => output })
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    expect(await assist(request, signal)).toEqual(output)
    expect(fetcher).toHaveBeenCalledWith('/api/ai/assist', expect.objectContaining({ method: 'POST', body: JSON.stringify(request), signal }))
  })
  it.each([
    { ...output, evidence: [{ id: 'fake', href: 'https://evil.example' }] },
    { ...output, answer: { ...output.answer, findings: [{ id: 'fake', priority: 1, title: 'Fake', explanation: 'Fake', suggestedAction: 'Fake', evidenceIds: ['unknown'], limitations: [] }] } },
    { ...output, answer: { ...output.answer, extra: 'Invalid' } },
  ])('rejeita links, evidências e formatos arbitrários', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
    await expect(assist(request, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
  })
  it('rejeita sucesso de outro contexto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...output, datasetVersion: 'v2' }) }))
    await expect(assist(request, new AbortController().signal)).rejects.toMatchObject({ code: 'DATASET_CHANGED' })
  })
  it('rejeita resposta com provedor ou modelo diferente do escolhido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...output, selection: { provider: 'openrouter', model: 'vendor/model' } }) }))
    await expect(assist({ ...request, selection: { provider: 'gemini', model: 'gemini-test' } }, new AbortController().signal)).rejects.toMatchObject({ code: 'MODEL_CHANGED' })
  })
  it('consulta modelos pelo backend e rejeita um catálogo de outro provedor', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ provider: 'openrouter', defaultModel: 'v/model', models: [{ id: 'v/model', name: 'Modelo' }] }) })
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    await expect(getAiModels('openrouter', signal)).resolves.toHaveProperty('defaultModel', 'v/model')
    expect(fetcher).toHaveBeenCalledWith('/api/ai/models?provider=openrouter', { signal })
    await expect(getAiModels('gemini', signal)).rejects.toMatchObject({ code: 'MODEL_CATALOG_UNAVAILABLE' })
  })
  it('trata indisponibilidade e JSON de erro controlado', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: { code: 'AI_NOT_CONFIGURED', message: 'Não configurada.', retryable: false } }) })
    vi.stubGlobal('fetch', fetcher)
    await expect(getAiStatus(new AbortController().signal)).rejects.toThrow('API local')
    await expect(assist(request, new AbortController().signal)).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED', retryable: false })
  })
})
