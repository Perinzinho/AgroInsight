import { zodTextFormat } from 'openai/helpers/zod'
import { getEncoding } from 'js-tiktoken'
import type { ResponseInput, ResponseInputItem } from 'openai/resources/responses/responses'
import type { AssistRequest, AiAssistResponse } from '../../src/shared/aiContracts'
import { answerSchema, assistResponseSchema } from '../../src/shared/aiContracts'
import type { Dataset } from '../../src/shared/agroContracts'
import type { Config } from '../config'
import { defaultSelection } from './providers'
import { EvidenceRegistry } from '../data/evidenceRegistry'
import { invalidResponse, PublicError } from '../errors'
import type { Provider } from './client'
import { providerError } from './client'
import { createQueries } from './queries'
import { analysisPrompt, instructions } from './instructions'
import { dispatchTool, toolDefinitions } from './tools'
import { createToolContext } from './context'

export interface TurnUsage { providerCalls: number; toolCalls: number; inputTokens: number; outputTokens: number; maxEstimatedInputTokens?: number }
const tokenizer = getEncoding('o200k_base')
const answerFormat = zodTextFormat(answerSchema, 'agroinsight_answer')
function estimateInputTokens(input: ResponseInput, separateFinal: boolean, final: boolean) {
  // Count tool output and message text as received by the model, without counting
  // the extra escaping introduced when those strings are embedded in HTTP JSON.
  // Chat providers receive either tool definitions or the final response schema.
  const framing = { instructions,
    ...(!separateFinal || !final ? { tools: toolDefinitions } : {}),
    ...(!separateFinal || final ? { schema: answerFormat.schema } : {}),
  }
  return tokenizer.encode(JSON.stringify(framing)).length + 512
    + input.reduce((total, item) => {
      const content = 'content' in item && typeof item.content === 'string' ? item.content
        : item.type === 'function_call_output' && typeof item.output === 'string' ? item.output : JSON.stringify(item)
      return total + tokenizer.encode(content).length + 32
    }, 0)
}
export async function runAgent(args: {
  request: AssistRequest; dataset: Dataset; config: Config; provider: Provider;
  signal: AbortSignal; requestId: string; usage: TurnUsage;
}): Promise<AiAssistResponse> {
  const { request, dataset, config, provider, signal, requestId, usage } = args
  const selection = request.provider && request.model ? { provider: request.provider, model: request.model } : defaultSelection(config)
  const registry = new EvidenceRegistry()
  const serializeTool = createToolContext()
  const queries = createQueries(dataset, request.filters, registry)
  const f = request.filters
  const scope = `${f.from} a ${f.to}; armadilhas: ${f.trapCodes.join(', ') || 'todas'}; pragas: ${f.pestKeys.join(', ') || 'todas'}`
  const coverage = registry.add({ id: 'coverage', label: 'Cobertura das fontes importadas', value: JSON.stringify(dataset.manifest.coverage),
    unit: null, source: 'manifest.json', href: '#/qualidade', from: f.from, to: f.to, scope: `Cobertura global das fontes, não totais filtrados. Filtro solicitado: ${scope}` })
  const input: ResponseInput = [
    { role: 'developer', content: JSON.stringify({ timezone: dataset.manifest.datasetTimezone,
      currentLocalDay: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      effectiveFilters: f, datasetGeneratedAt: dataset.manifest.generatedAt, coverageEvidence: coverage,
      warningCount: dataset.manifest.warnings.length }) },
    ...request.history.map((h): ResponseInputItem => ({ role: h.role, content: h.content })),
    { role: 'user', content: request.mode === 'analysis' ? analysisPrompt : request.message! },
  ]
  let rounds = 0
  let forceFinal = false
  const deadline = performance.now() + config.AI_TIMEOUT_MS
  try {
    while (usage.providerCalls < config.AI_MAX_PROVIDER_CALLS) {
      signal.throwIfAborted()
      if (performance.now() >= deadline) throw new PublicError('AI_TIMEOUT', 'A análise excedeu o tempo disponível.', 504, true)
      // Approximate local budget with room for framing; each provider's usage is authoritative.
      const estimatedTokens = estimateInputTokens(input, Boolean(provider.separateFinal), forceFinal)
      usage.maxEstimatedInputTokens = Math.max(usage.maxEstimatedInputTokens ?? 0, estimatedTokens)
      if (estimatedTokens > config.AI_MAX_INPUT_TOKENS) throw new PublicError('CONTEXT_LIMIT', 'O contexto atingiu o orçamento desta análise. Limpe a conversa ou reduza o período.', 413, true)
      usage.providerCalls++
      const response = await provider.create({
        model: selection.model, store: false, instructions, input,
        tools: toolDefinitions, tool_choice: forceFinal ? 'none' : usage.toolCalls === 0 ? 'required' : 'auto',
        parallel_tool_calls: false, max_output_tokens: config.AI_MAX_OUTPUT_TOKENS,
        text: { format: answerFormat },
      }, signal)
      usage.inputTokens += response.usage?.input_tokens ?? 0
      usage.outputTokens += response.usage?.output_tokens ?? 0
      signal.throwIfAborted()
      if (response.status !== 'completed' || response.output.some((item) => item.type === 'message' && item.content.some((c) => c.type === 'refusal'))) throw invalidResponse()
      const calls = response.output.filter((item) => item.type === 'function_call')
      if (calls.length) {
        if (forceFinal) throw invalidResponse()
        input.push(...response.output.filter((item) => item.type === 'function_call' || item.type === 'message' || item.type === 'reasoning'))
        rounds++
        for (const call of calls) {
          let output: unknown
          if (rounds > config.AI_MAX_TOOL_ROUNDS || usage.toolCalls >= config.AI_MAX_TOOL_CALLS) {
            forceFinal = true
            output = { error: 'Limite de ferramentas atingido; finalize com os fatos já recebidos.' }
          } else {
            signal.throwIfAborted()
            usage.toolCalls++
            output = dispatchTool(queries, call.name, call.arguments)
          }
          input.push({ type: 'function_call_output', call_id: call.call_id, output: serializeTool(output) })
        }
        if (rounds >= config.AI_MAX_TOOL_ROUNDS || usage.toolCalls >= config.AI_MAX_TOOL_CALLS || usage.providerCalls >= config.AI_MAX_PROVIDER_CALLS - 1) forceFinal = true
        continue
      }
      if (usage.toolCalls === 0) throw invalidResponse()
      // Gemini/OpenRouter use a separate schema-only call, avoiding incompatible
      // combinations of tool calling and structured output on some endpoints.
      if (provider.separateFinal && !forceFinal) { forceFinal = true; continue }
      let parsed: unknown
      try {
        const text = response.output.filter((item) => item.type === 'message')
          .flatMap((item) => item.content).filter((c) => c.type === 'output_text').map((c) => c.text).join('')
        parsed = JSON.parse(text)
      } catch { throw invalidResponse('json') }
      const result = answerSchema.safeParse(parsed)
      if (!result.success) throw invalidResponse('schema', result.error.issues.slice(0, 8).map((issue) => issue.path.map(String).join('.')))
      const ids = result.data.findings.flatMap((finding) => finding.evidenceIds)
      const evidence = registry.resolve(['coverage', ...ids])
      const answer = { ...result.data, findings: [...result.data.findings].sort((a, b) => a.priority - b.priority) }
      return assistResponseSchema.parse({ requestId, generatedAt: new Date().toISOString(), datasetVersion: dataset.manifest.generatedAt,
        effectiveFilters: f, answer, evidence, selection })
    }
    throw new PublicError('AI_LIMIT_REACHED', 'A análise atingiu o limite de consultas. Faça uma pergunta mais específica.', 429, true)
  } catch (error) { throw providerError(error) }
}
