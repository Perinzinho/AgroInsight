import { zodTextFormat } from 'openai/helpers/zod'
import type { ResponseInput, ResponseInputItem } from 'openai/resources/responses/responses'
import type { AssistRequest, AiAssistResponse } from '../../src/shared/aiContracts'
import { answerSchema, assistResponseSchema } from '../../src/shared/aiContracts'
import type { Dataset } from '../../src/shared/agroContracts'
import type { Config } from '../config'
import { EvidenceRegistry } from '../data/evidenceRegistry'
import { invalidResponse, PublicError } from '../errors'
import type { Provider } from './client'
import { providerError } from './client'
import { createQueries } from './queries'
import { instructions } from './instructions'
import { dispatchTool, toolDefinitions } from './tools'
import { estimateInputTokens } from './tokenBudget'

export interface TurnUsage { providerCalls: number; toolCalls: number; inputTokens: number; outputTokens: number }
const answerFormat = zodTextFormat(answerSchema, 'agroinsight_answer')
export async function runAgent(args: {
  request: AssistRequest; dataset: Dataset; config: Config; provider: Provider;
  signal: AbortSignal; requestId: string; usage: TurnUsage;
}): Promise<AiAssistResponse> {
  const { request, dataset, config, provider, signal, requestId, usage } = args
  const registry = new EvidenceRegistry()
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
    { role: 'user', content: request.mode === 'analysis' ? 'Analise o período e os filtros atuais: consulte consultarResumo e aprofunde apenas o necessário. Priorize fatos, cobertura, fontes e limitações.' : request.message! },
  ]
  let rounds = 0
  let forceFinal = false
  const deadline = performance.now() + config.AI_TIMEOUT_MS
  try {
    while (usage.providerCalls < config.AI_MAX_PROVIDER_CALLS) {
      signal.throwIfAborted()
      if (performance.now() >= deadline) throw new PublicError('AI_TIMEOUT', 'A análise excedeu o tempo disponível.', 504, true)
      // GPT-4.1 tokenizer, with room for protocol framing; provider usage remains authoritative.
      const estimatedTokens = estimateInputTokens({ instructions, input, tools: toolDefinitions, schema: answerFormat.schema })
      if (estimatedTokens > config.AI_MAX_INPUT_TOKENS) throw new PublicError('CONTEXT_LIMIT', 'O contexto atingiu o orçamento desta análise. Limpe a conversa ou reduza o período.', 413, true)
      usage.providerCalls++
      const response = await provider.create({
        model: request.selection?.model ?? config.OPENAI_MODEL, store: false, instructions, input,
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
          input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) })
        }
        if (rounds >= config.AI_MAX_TOOL_ROUNDS || usage.toolCalls >= config.AI_MAX_TOOL_CALLS || usage.providerCalls >= config.AI_MAX_PROVIDER_CALLS - 1) forceFinal = true
        continue
      }
      if (usage.toolCalls === 0) throw invalidResponse()
      let parsed: unknown
      try {
        const text = response.output.filter((item) => item.type === 'message')
          .flatMap((item) => item.content).filter((c) => c.type === 'output_text').map((c) => c.text).join('')
        parsed = JSON.parse(text)
      } catch { throw invalidResponse() }
      const result = answerSchema.safeParse(parsed)
      if (!result.success) throw invalidResponse()
      const ids = result.data.findings.flatMap((finding) => finding.evidenceIds)
      const evidence = registry.resolve(['coverage', ...ids])
      const answer = { ...result.data, findings: [...result.data.findings].sort((a, b) => a.priority - b.priority) }
      return assistResponseSchema.parse({ requestId, selection: request.selection ?? { provider: 'openai', model: config.OPENAI_MODEL }, generatedAt: new Date().toISOString(), datasetVersion: dataset.manifest.generatedAt,
        effectiveFilters: f, answer, evidence })
    }
    throw new PublicError('AI_LIMIT_REACHED', 'A análise atingiu o limite de consultas. Faça uma pergunta mais específica.', 429, true)
  } catch (error) { throw providerError(error) }
}
