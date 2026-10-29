import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Dataset } from '../../src/shared/agroContracts'
import { readConfig } from '../config'
import { createProvider } from '../ai/client'
import { runAgent } from '../ai/agent'
import { answer, loadData, requestFor } from './helpers'

let dataset: Dataset
beforeAll(async () => { dataset = await loadData() })
afterEach(() => vi.unstubAllGlobals())
const completion = (message: unknown, finish_reason = 'tool_calls') => new Response(JSON.stringify({
  id: 'completion', object: 'chat.completion', created: 0, model: 'test', choices: [{ index: 0, finish_reason, message }],
  usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })
const call = (name: string, args = '{}') => ({ id: `call_${name}`, type: 'function', function: { name, arguments: args },
  extra_content: { google: { thought_signature: 'opaque-signature' } } })
const tool = () => ({ role: 'assistant', content: null, tool_calls: [call('consultarClima')],
  reasoning_details: [{ type: 'reasoning.encrypted', data: 'opaque-reasoning' }] })
const final = () => ({ role: 'assistant', content: null, tool_calls: [call('responderAnalise', JSON.stringify(answer))] })

async function run(provider: 'gemini' | 'openrouter', config = readConfig({ GEMINI_API_KEY: 'gemini-test', OPENROUTER_API_KEY: 'router-test' })) {
  const selection = { provider, model: provider === 'gemini' ? 'gemini-test' : 'vendor/model' }
  return runAgent({ request: { ...requestFor(dataset.manifest.generatedAt), selection }, dataset, config,
    provider: createProvider(config, selection), signal: new AbortController().signal, requestId: 'provider-test',
    usage: { providerCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 } })
}

describe('integração dos provedores de chat', () => {
  it.each(['gemini', 'openrouter'] as const)('%s usa o endpoint e a chave corretos, preserva metadados e finaliza com evidências', async (provider) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(completion(tool())).mockResolvedValueOnce(completion(final()))
    vi.stubGlobal('fetch', fetcher)
    const result = await run(provider)
    expect(fetcher).toHaveBeenCalledTimes(2)
    const [url, options] = fetcher.mock.calls[0]
    expect(String(url)).toBe(provider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions')
    expect(new Headers(options?.headers).get('authorization')).toBe(`Bearer ${provider === 'gemini' ? 'gemini-test' : 'router-test'}`)
    const first = JSON.parse(String(options?.body))
    expect(first.model).toBe(provider === 'gemini' ? 'gemini-test' : 'vendor/model')
    expect(first.tools.some((t: { function: { name: string } }) => t.function.name === 'responderAnalise')).toBe(false)
    const next = JSON.parse(String(fetcher.mock.calls[1][1]?.body))
    expect(next.messages).toEqual(expect.arrayContaining([
      tool(), expect.objectContaining({ role: 'tool', tool_call_id: 'call_consultarClima' }),
    ]))
    expect(next.tools.some((t: { function: { name: string } }) => t.function.name === 'responderAnalise')).toBe(true)
    expect(result.selection?.provider).toBe(provider)
    expect(result.answer.summary).toBe(answer.summary)
    expect(result.evidence.some((e) => e.id === 'climate-rain')).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/opaque-|gemini-test.*Bearer|router-test/)
  })
  it('limite de ferramentas força apenas a entrega final', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(completion(tool())).mockResolvedValueOnce(completion(final()))
    vi.stubGlobal('fetch', fetcher)
    await run('gemini', readConfig({ GEMINI_API_KEY: 'test', AI_MAX_TOOL_ROUNDS: '1' }))
    const body = JSON.parse(String(fetcher.mock.calls[1][1]?.body))
    expect(body.tools).toHaveLength(1)
    expect(body.tool_choice).toEqual({ type: 'function', function: { name: 'responderAnalise' } })
  })
  it.each([
    final(),
    { ...tool(), tool_calls: [...tool().tool_calls, ...final().tool_calls] },
  ])('rejeita finalização sem evidências consultadas', async (message) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(completion(message)))
    await expect(run('gemini')).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
  })
  it.each(['length', 'content_filter'])('não publica saída %s', async (reason) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(completion(tool(), reason)))
    await expect(run('openrouter')).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
  })
  it('normaliza falta de crédito do OpenRouter sem expor a resposta externa', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-credit-details' } }), { status: 402 })))
    await expect(run('openrouter')).rejects.toMatchObject({ code: 'PROVIDER_AUTH_OR_QUOTA' })
  })
  it('inclui os metadados privados no orçamento da continuação', async () => {
    const message = tool()
    message.reasoning_details[0].data = 'large-opaque-signature '.repeat(15000)
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(completion(message))
    vi.stubGlobal('fetch', fetcher)
    await expect(run('gemini')).rejects.toMatchObject({ code: 'CONTEXT_LIMIT' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
