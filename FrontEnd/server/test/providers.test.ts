import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Dataset } from '../../src/shared/agroContracts'
import { readConfig } from '../config'
import { createProvider } from '../ai/client'
import { defaultSelection, providerOptions, resolveSelection } from '../ai/providers'
import { runAgent } from '../ai/agent'
import { answer, loadData, requestFor } from './helpers'

let dataset: Dataset
beforeAll(async () => { dataset = await loadData() })
afterEach(() => { vi.unstubAllGlobals() })
const usageFor = () => ({ providerCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 })

describe('seleção de provedor e modelo', () => {
  it('usa a primeira chave disponível e preserva a configuração legada', () => {
    expect(defaultSelection(readConfig({})).provider).toBe('gemini')
    expect(defaultSelection(readConfig({ OPENROUTER_API_KEY: 'router' })).provider).toBe('openrouter')
    expect(defaultSelection(readConfig({ OPENAI_API_KEY: 'legacy' })).provider).toBe('openai')
    expect(defaultSelection(readConfig({ GEMINI_API_KEY: 'gemini', OPENROUTER_API_KEY: 'router', AI_PROVIDER: 'openrouter' })).provider).toBe('openrouter')
  })
  it('normaliza a lista e permite modelos administrativos sem divulgar chaves', () => {
    const config = readConfig({ GEMINI_API_KEY: 'private-key', GEMINI_MODEL: 'custom-default', GEMINI_MODELS: ' custom-model, custom-model,custom-default ' })
    const options = providerOptions(config)
    expect(options[0].models).toEqual(['custom-default', 'custom-model'])
    expect(resolveSelection(config, { provider: 'gemini', model: 'custom-model' })).toEqual({ provider: 'gemini', model: 'custom-model' })
    expect(JSON.stringify(options)).not.toContain('private-key')
    expect(() => resolveSelection(config, { provider: 'gemini', model: 'other' })).toThrow('modelo disponível')
    expect(() => resolveSelection(config, { provider: 'openrouter', model: 'google/gemini-2.5-flash' })).toThrow('chave de OpenRouter')
  })
  it.each(['../model', 'https://evil.example', 'model?secret=true', 'model with spaces'])('rejeita ID administrativo inválido: %s', (model) => {
    expect(() => readConfig({ GEMINI_MODEL: model })).toThrow()
  })
})

describe.each(['gemini', 'openrouter'] as const)('adaptador %s', (id) => {
  it('executa ferramentas e finalização JSON no endpoint correto, preservando extensões e cancelamento', async () => {
    const requests: Request[] = []
    const bodies: Record<string, unknown>[] = []
    const toolMessage = { role: 'assistant', content: null,
      reasoning_details: [{ type: 'reasoning.encrypted', data: 'opaque-reasoning' }],
      tool_calls: [
        { id: 'call_climate', type: 'function', function: { name: 'consultarClima', arguments: '{}' }, extra_content: { google: { thought_signature: 'opaque-signature' } } },
        { id: 'call_pests', type: 'function', function: { name: 'consultarPragas', arguments: '{}' } },
      ],
    }
    const messages = [toolMessage, { role: 'assistant', content: 'PRONTO' }, { role: 'assistant', content: JSON.stringify(answer) }]
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      bodies.push(await request.json() as Record<string, unknown>)
      const index = requests.length - 1
      return new Response(JSON.stringify({ id: `chat_${index}`, object: 'chat.completion', created: 1, model: 'test',
        choices: [{ index: 0, finish_reason: index === 0 ? 'tool_calls' : 'stop', message: messages[index] }],
        usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
      }), { headers: { 'Content-Type': 'application/json' } })
    }))
    const config = readConfig({ GEMINI_API_KEY: 'gemini-test-key', OPENROUTER_API_KEY: 'router-test-key' })
    const model = id === 'gemini' ? config.GEMINI_MODEL : config.OPENROUTER_MODEL
    const controller = new AbortController()
    const usage = usageFor()
    const result = await runAgent({ request: { ...requestFor(dataset.manifest.generatedAt), provider: id, model }, dataset, config,
      provider: createProvider(config, id), signal: controller.signal, requestId: 'test', usage })
    expect(requests).toHaveLength(3)
    expect(requests[0].url).toBe(id === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions')
    expect(requests[0].headers.get('Authorization')).toBe(`Bearer ${id === 'gemini' ? 'gemini-test-key' : 'router-test-key'}`)
    expect(bodies[0]).toMatchObject({ model, tool_choice: 'required', max_tokens: 2000 })
    expect(bodies[0]).not.toHaveProperty('response_format')
    expect(bodies[1].messages).toEqual(expect.arrayContaining([toolMessage,
      expect.objectContaining({ role: 'tool', tool_call_id: 'call_climate' }), expect.objectContaining({ role: 'tool', tool_call_id: 'call_pests' })]))
    expect(bodies[2]).toMatchObject({ response_format: { type: 'json_schema', json_schema: { strict: true } } })
    expect(bodies[2]).not.toHaveProperty('tools')
    if (id === 'openrouter') expect(bodies[0]).toHaveProperty('provider.require_parameters', true)
    expect(result.selection).toEqual({ provider: id, model })
    expect(result.evidence.some((item) => item.id === 'climate-rain')).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/opaque-reasoning|opaque-signature/)
    expect(usage).toMatchObject({ providerCalls: 3, toolCalls: 2, inputTokens: 300, outputTokens: 90 })
    controller.abort()
    expect(requests.every((request) => request.signal.aborted)).toBe(true)
  })
  it.each(['length', 'content_filter'])('rejeita resposta truncada/recusada: %s', async (reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'bad', choices: [{ finish_reason: reason, message: { content: '{}' } }] }), { headers: { 'Content-Type': 'application/json' } })))
    const config = readConfig({ GEMINI_API_KEY: 'test', OPENROUTER_API_KEY: 'test' })
    const provider = createProvider(config, id)
    await expect(provider.create({ model: 'test', input: [], tool_choice: 'required' }, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
  })
})
