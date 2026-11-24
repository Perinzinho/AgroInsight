import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Dataset } from '../../src/shared/agroContracts'
import { readConfig } from '../config'
import { createProvider } from '../ai/client'
import { runAgent } from '../ai/agent'
import { answer, loadData, requestFor } from './helpers'

let dataset: Dataset
beforeAll(async () => { dataset = await loadData() })
afterEach(() => vi.unstubAllGlobals())
const completion = (content: string | null = JSON.stringify(answer), finish_reason = 'stop', extra = {}) => new Response(JSON.stringify({
  id: 'completion', object: 'chat.completion', created: 0, model: 'test', choices: [{ index: 0, finish_reason, message: { role: 'assistant', content, ...extra } }],
  usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

async function run(provider: 'gemini' | 'openrouter' | 'openai') {
  const config = readConfig({ GEMINI_API_KEY: 'gemini-test', OPENROUTER_API_KEY: 'router-test', OPENAI_API_KEY: 'openai-test' })
  const selection = { provider, model: provider === 'gemini' ? 'gemini-test' : provider === 'openai' ? 'gpt-test' : 'vendor/model' }
  return runAgent({ request: { ...requestFor(dataset.manifest.generatedAt), selection }, dataset, config,
    provider: createProvider(config, selection), signal: new AbortController().signal, requestId: 'provider-test',
    usage: { providerCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 } })
}

describe('chat textual entre provedores', () => {
  it.each(['gemini', 'openrouter', 'openai'] as const)('%s usa a seleção explícita sem exigir tools ou structured outputs', async (provider) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(completion())
    vi.stubGlobal('fetch', fetcher)
    const result = await run(provider)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, options] = fetcher.mock.calls[0]
    const base = { gemini: 'https://generativelanguage.googleapis.com/v1beta/openai', openrouter: 'https://openrouter.ai/api/v1', openai: 'https://api.openai.com/v1' }
    expect(String(url)).toBe(`${base[provider]}/chat/completions`)
    expect(new Headers(options?.headers).get('authorization')).toBe(`Bearer ${provider === 'gemini' ? 'gemini-test' : provider === 'openai' ? 'openai-test' : 'router-test'}`)
    const body = JSON.parse(String(options?.body))
    expect(body.model).toBe(result.selection?.model)
    expect(body.tools).toBeUndefined()
    expect(body.tool_choice).toBeUndefined()
    expect(body.response_format).toBeUndefined()
    expect(body.provider).toBeUndefined()
    expect(body.temperature).toBeUndefined()
    expect(body[provider === 'openai' ? 'max_completion_tokens' : 'max_tokens']).toBe(2000)
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user'])
    expect(body.messages[1].content).toContain('climate-rain')
    expect(result.answer.summary).toBe(answer.summary)
    expect(result.evidence.some((e) => e.id === 'climate-rain')).toBe(true)
  })
  it.each(['content_filter'])('não publica saída %s', async (reason) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(completion(JSON.stringify(answer), reason))
    vi.stubGlobal('fetch', fetcher)
    await expect(run('openrouter')).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('uma resposta truncada permite nova geração curta com contabilização do primeiro uso', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(completion('{"summary":', 'length')).mockResolvedValueOnce(completion())
    vi.stubGlobal('fetch', fetcher)
    await expect(run('gemini')).resolves.toHaveProperty('answer.summary', answer.summary)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).messages[0].content).toContain('excedeu o limite de saída')
  })
  it('rejeita chamadas de ferramentas não solicitadas e recusas', async () => {
    for (const extra of [{ refusal: 'recusa' }, { tool_calls: [{ id: 'tool', type: 'function', function: { name: 'web_search', arguments: '{}' } }] }]) {
      vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(completion(null, 'stop', extra)))
      await expect(run('gemini')).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
    }
  })
  it('normaliza falta de crédito do OpenRouter sem expor a resposta externa', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-credit-details' } }), { status: 402 })))
    await expect(run('openrouter')).rejects.toMatchObject({ code: 'PROVIDER_AUTH_OR_QUOTA' })
  })
  it('limites e evidências são validados mesmo sem schema de geração nativo', async () => {
    const oversized = { ...answer, limitations: Array.from({ length: 13 }, () => 'Limitação de teste.') }
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => completion(JSON.stringify(oversized)))
    vi.stubGlobal('fetch', fetcher)
    await expect(run('gemini')).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
