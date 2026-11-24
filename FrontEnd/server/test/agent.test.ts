import { beforeAll, describe, expect, it, vi } from 'vitest'
import OpenAI from 'openai'
import type { Dataset } from '../../src/shared/agroContracts'
import { readConfig } from '../config'
import { runAgent, parseAnswer } from '../ai/agent'
import { providerError } from '../ai/client'
import type { Provider } from '../ai/client'
import { dispatchTool } from '../ai/tools'
import { createQueries } from '../ai/queries'
import { EvidenceRegistry } from '../data/evidenceRegistry'
import { estimateInputTokens } from '../ai/tokenBudget'
import { answer, finalResponse, loadData, requestFor, response } from './helpers'

let dataset: Dataset
beforeAll(async () => { dataset = await loadData() })
const usageFor = () => ({ providerCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 })
function run(provider: Provider, env: NodeJS.ProcessEnv = {}) {
  return runAgent({ request: requestFor(dataset.manifest.generatedAt), dataset, provider,
    config: readConfig({ OPENAI_API_KEY: 'test-only', ...env }), signal: new AbortController().signal, requestId: 'test-request', usage: usageFor() })
}

describe('análise com recuperação determinística', () => {
  it('entrega fatos e fontes antes da primeira chamada sem exigir ferramentas ou schema nativo', async () => {
    const create = vi.fn<Provider['create']>().mockResolvedValue(finalResponse())
    const result = await run({ create })
    expect(create).toHaveBeenCalledTimes(1)
    const params = create.mock.calls[0][0]
    expect(params.tools).toBeUndefined()
    expect(params.text).toBeUndefined()
    expect(params.store).toBe(false)
    expect(JSON.stringify(params.input)).toContain('climate-rain')
    expect(JSON.stringify(params.input)).toContain('traps_events.csv')
    expect(result.evidence.find((e) => e.id === 'climate-rain')?.source).toBe(dataset.climate.station.name)
    expect(JSON.stringify(create.mock.calls)).not.toContain('test-only')
  })
  it('rejeita resposta inconclusiva e permite uma correção com os fatos disponíveis', async () => {
    const create = vi.fn<Provider['create']>().mockResolvedValueOnce(finalResponse({ ...answer, summary: 'Não posso concluir nada sem produtividade.', findings: [] })).mockResolvedValueOnce(finalResponse())
    const result = await run({ create })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][0].instructions).toContain('não explorou os fatos disponíveis')
    expect(result.answer.findings).toHaveLength(3)
  })
  it('não aceita três achados repetidos do mesmo domínio como investigação ampla', async () => {
    const repeated = { ...answer, findings: [1, 2, 3].map((n) => ({ ...answer.findings[0], id: `rain-${n}` })) }
    const create = vi.fn<Provider['create']>().mockResolvedValue(finalResponse(repeated))
    await expect(run({ create })).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
    expect(create).toHaveBeenCalledTimes(2)
  })
  it('pergunta específica não exige achados de outros domínios', async () => {
    const create = vi.fn<Provider['create']>().mockResolvedValue(finalResponse({ ...answer, findings: [answer.findings[0]] }))
    await expect(runAgent({ request: { ...requestFor(dataset.manifest.generatedAt), mode: 'chat', message: 'Quanto choveu?', history: [{ role: 'user', content: 'O que causou a queda da safra?' }] }, dataset,
      provider: { create }, config: readConfig(), signal: new AbortController().signal, requestId: 'focused', usage: usageFor() })).resolves.toHaveProperty('answer.findings.length', 1)
    const content = (create.mock.calls[0][0].input as { content: string }[]).at(-1)!.content
    expect(JSON.parse(content.split('\n')[1]).questionFocus).toEqual(['climate'])
  })
  it.each([
    { ...answer, findings: [{ ...answer.findings[0], evidenceIds: ['imaginary'] }] },
    { ...answer, findings: [{ ...answer.findings[0], priority: 4 }] },
    { ...answer, arbitraryUrl: 'https://evil.example' },
    { summary: 'Sem contrato' },
  ])('não publica schema ou evidências inválidas após uma tentativa de correção', async (value) => {
    const create = vi.fn<Provider['create']>().mockResolvedValue(finalResponse(value))
    await expect(run({ create })).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
    expect(create).toHaveBeenCalledTimes(2)
  })
  it('aceita JSON cercado por markdown e o invólucro answer sem modificar seus valores', () => {
    expect(parseAnswer(`\x60\x60\x60json\n${JSON.stringify(answer)}\n\x60\x60\x60`)).toEqual(answer)
    expect(parseAnswer(JSON.stringify({ answer }))).toEqual(answer)
    expect(() => parseAnswer('sem JSON')).toThrow()
    expect(() => parseAnswer('{bad}')).toThrow()
  })
  it('normaliza apenas listas vazias omitidas, sem completar afirmações ou evidenceIds', () => {
    const parsed = parseAnswer(JSON.stringify({ summary: 'Resposta', findings: [{ id: 'x', title: 'X' }] }))
    expect(parsed).toEqual({ summary: 'Resposta', findings: [{ id: 'x', title: 'X', limitations: [] }], limitations: [], followUpQuestions: [] })
  })
  it('corrige JSON malformado uma vez, sem reenviar texto inválido como instrução', async () => {
    const bad = response([{ type: 'message', role: 'assistant', id: 'bad', status: 'completed', content: [{ type: 'output_text', text: 'private-bad-json', annotations: [], logprobs: [] }] }])
    const create = vi.fn<Provider['create']>().mockResolvedValueOnce(bad).mockResolvedValueOnce(finalResponse())
    await expect(run({ create })).resolves.toHaveProperty('answer')
    expect(create.mock.calls[1][0].instructions).toContain('não era JSON válido')
    expect(JSON.stringify(create.mock.calls[1][0])).not.toContain('private-bad-json')
  })
  it('não repete recusas', async () => {
    const refusal = response([{ type: 'message', role: 'assistant', id: 'refusal', status: 'completed', content: [{ type: 'refusal', refusal: 'Não posso responder.' }] }])
    for (const output of [refusal]) {
      const create = vi.fn<Provider['create']>().mockResolvedValue(output)
      await expect(run({ create })).rejects.toMatchObject({ code: 'INVALID_AI_RESPONSE' })
      expect(create).toHaveBeenCalledTimes(1)
    }
  })
  it('repete uma saída truncada com instrução de concisão e contabiliza seu uso', async () => {
    const create = vi.fn<Provider['create']>().mockResolvedValueOnce(response([], 'incomplete')).mockResolvedValueOnce(finalResponse())
    const usage = usageFor()
    await runAgent({ request: requestFor(dataset.manifest.generatedAt), dataset, provider: { create }, config: readConfig(), signal: new AbortController().signal, requestId: 'shorter', usage })
    expect(create.mock.calls[1][0].instructions).toContain('excedeu o limite de saída')
    expect(usage).toMatchObject({ providerCalls: 2, inputTokens: 200, outputTokens: 60 })
  })
  it('aplica orçamento de entrada antes de qualquer chamada paga', async () => {
    const create = vi.fn<Provider['create']>()
    await expect(run({ create }, { AI_MAX_INPUT_TOKENS: '1' })).rejects.toMatchObject({ code: 'CONTEXT_LIMIT' })
    expect(create).not.toHaveBeenCalled()
  })
  it('remove histórico antigo antes de comprometer fatos atuais', async () => {
    const create = vi.fn<Provider['create']>().mockResolvedValue(finalResponse())
    await runAgent({ request: { ...requestFor(dataset.manifest.generatedAt), history: Array.from({ length: 6 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'old-message '.repeat(900) })) },
      dataset, provider: { create }, config: readConfig({ AI_MAX_INPUT_TOKENS: '7000' }), signal: new AbortController().signal, requestId: 'budget', usage: usageFor() })
    const params = create.mock.calls[0][0]
    expect(estimateInputTokens({ instructions: params.instructions, input: params.input })).toBeLessThan(6700)
    expect(JSON.stringify(params.input)).toContain('climate-rain')
    expect((params.input as unknown[]).length).toBeLessThan(7)
  })
  it.each(['__proto__', 'constructor', 'readFile', 'web_search'])('consultas locais continuam rejeitando ferramenta %s', (name) => {
    expect(() => dispatchTool(createQueries(dataset, requestFor('v').filters, new EvidenceRegistry()), name, '{}')).toThrow()
  })
  it('respeita aborto antes de consultar o provedor', async () => {
    const controller = new AbortController(); controller.abort()
    const create = vi.fn<Provider['create']>()
    await expect(runAgent({ request: requestFor(dataset.manifest.generatedAt), dataset, config: readConfig(), provider: { create }, signal: controller.signal, requestId: 'abort', usage: usageFor() })).rejects.toThrow()
    expect(create).not.toHaveBeenCalled()
  })
  it.each([[400, 'PROVIDER_REQUEST_REJECTED'], [401, 'PROVIDER_AUTH_OR_QUOTA'], [403, 'PROVIDER_AUTH_OR_QUOTA'], [404, 'PROVIDER_MODEL_UNAVAILABLE'],
    [422, 'PROVIDER_REQUEST_REJECTED'], [429, 'RATE_LIMITED'], [500, 'PROVIDER_ERROR'], [503, 'PROVIDER_UNAVAILABLE']])('normaliza status externo %s sem expor detalhes', (status, code) => {
    const error = new OpenAI.APIError(Number(status), { message: 'private-secret' }, 'private-secret', new Headers())
    const normalized = providerError(error)
    expect(normalized.code).toBe(code)
    expect(normalized.message).not.toContain('private-secret')
  })
  it('distingue timeout do SDK de falha de conexão sem revelar detalhes privados', () => {
    const timeout = providerError(new OpenAI.APIConnectionTimeoutError({ message: 'private-timeout-detail' }))
    expect(timeout).toMatchObject({ code: 'PROVIDER_TIMEOUT', status: 504, retryable: true })
    const connection = providerError(new OpenAI.APIConnectionError({ message: 'private-connection-detail', cause: new Error('private-certificate') }))
    expect(connection).toMatchObject({ code: 'PROVIDER_CONNECTION', status: 503, retryable: true })
    expect(`${timeout.message} ${connection.message}`).not.toContain('private-')
  })
  it('trata falha de rede sem retry automático', async () => {
    const create = vi.fn<Provider['create']>().mockRejectedValue(new Error('private-network-detail'))
    await expect(run({ create })).rejects.toMatchObject({ code: 'PROVIDER_ERROR' })
    expect(create).toHaveBeenCalledTimes(1)
  })
})
