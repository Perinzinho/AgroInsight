import OpenAI from 'openai'
import type { Response, ResponseCreateParamsNonStreaming, ResponseOutputItem } from 'openai/resources/responses/responses'
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { AiProviderId } from '../../src/shared/aiContracts'
import type { Config } from '../config'
import { invalidResponse, PublicError } from '../errors'
import { defaultSelection, providerKey } from './providers'

export interface Provider {
  separateFinal?: boolean
  create(params: ResponseCreateParamsNonStreaming, signal: AbortSignal): Promise<Response>
}
export function createProvider(config: Config, id: AiProviderId = defaultSelection(config).provider): Provider {
  const baseURL = id === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
    : id === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
  const client = new OpenAI({ apiKey: providerKey(config, id), baseURL, maxRetries: 0, timeout: config.AI_TIMEOUT_MS })
  if (id === 'openai') return { create: (params, signal) => client.responses.create(params, { signal }) }
  return createChatProvider(client, id)
}

// Keep the agent's tool/evidence loop while adapting Chat Completions providers.
// Weak keys retain provider extensions (e.g. thought signatures/reasoning_details)
// only as long as that turn's output items are in use, without shared conversation state.
function createChatProvider(client: OpenAI, id: 'gemini' | 'openrouter'): Provider {
  const originals = new WeakMap<object, ChatCompletionAssistantMessageParam>()
  return {
    separateFinal: true,
    async create(params, signal) {
      if (!params.model) throw invalidResponse()
      const final = params.tool_choice === 'none'
      const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: `${params.instructions ?? ''}${final ? '' : '\nConsulte as ferramentas necessárias. Quando houver dados suficientes, responda apenas PRONTO; a resposta estruturada será solicitada na próxima etapa.'}` }]
      const included = new Set<ChatCompletionAssistantMessageParam>()
      if (!Array.isArray(params.input)) throw invalidResponse()
      for (const item of params.input) {
        const original = originals.get(item)
        if (original) {
          if (!included.has(original)) { messages.push(original); included.add(original) }
        } else if (item.type === 'function_call_output') {
          if (typeof item.output !== 'string' || !item.call_id) throw invalidResponse()
          messages.push({ role: 'tool', tool_call_id: item.call_id, content: item.output })
        } else if ('role' in item && 'content' in item && ['developer', 'system', 'user', 'assistant'].includes(item.role)) {
          if (typeof item.content !== 'string') throw invalidResponse()
          const role = item.role === 'developer' ? 'system' : item.role as 'system' | 'user' | 'assistant'
          messages.push({ role, content: item.content })
        } else { throw invalidResponse() }
      }
      const tools: ChatCompletionTool[] = (params.tools ?? []).map((tool) => {
        if (tool.type !== 'function') throw invalidResponse()
        return { type: 'function', function: { name: tool.name, description: tool.description ?? undefined, parameters: tool.parameters ?? {} } }
      })
      const format = params.text?.format
      if (final && format?.type !== 'json_schema') throw invalidResponse()
      const completion = await client.chat.completions.create({
        model: params.model, messages, stream: false,
        max_tokens: params.max_output_tokens,
        ...(id === 'gemini' ? { reasoning_effort: 'low' as const } : {}),
        ...(final && format?.type === 'json_schema' ? {
          response_format: { type: 'json_schema' as const, json_schema: { name: format.name, strict: true, schema: format.schema } },
        } : { tools, tool_choice: params.tool_choice === 'required' ? 'required' as const : 'auto' as const }),
        ...(id === 'openrouter' ? { provider: { require_parameters: true } } : {}),
      }, { signal })
      const choice = completion.choices[0]
      if (!choice || !['stop', 'tool_calls'].includes(choice.finish_reason) || choice.message.refusal) throw invalidResponse('provider_completion')
      // Reuse the original message so signatures and provider reasoning survive tool continuations.
      const original: ChatCompletionAssistantMessageParam = { ...choice.message }
      const output: ResponseOutputItem[] = []
      for (const call of choice.message.tool_calls ?? []) {
        if (call.type !== 'function' || !call.id || !call.function.name || typeof call.function.arguments !== 'string') throw invalidResponse()
        output.push({ type: 'function_call', id: call.id, call_id: call.id, name: call.function.name, arguments: call.function.arguments, status: 'completed' })
      }
      if (choice.message.content) output.push({ type: 'message', id: `${completion.id}_message`, role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: choice.message.content, annotations: [], logprobs: [] }] })
      if (!output.length) throw invalidResponse()
      for (const item of output) originals.set(item, original)
      // Only the common fields consumed by the agent are needed from Responses.
      return { id: completion.id, object: 'response', created_at: completion.created, model: completion.model, status: 'completed', output,
        usage: completion.usage ? { input_tokens: completion.usage.prompt_tokens, output_tokens: completion.usage.completion_tokens, total_tokens: completion.usage.total_tokens } : undefined,
      } as Response
    },
  }
}
export function providerError(error: unknown): PublicError {
  if (error instanceof PublicError) return error
  if (error instanceof OpenAI.APIError) {
    if ([401, 402, 403].includes(error.status ?? 0) || error.code === 'insufficient_quota') {
      return new PublicError('PROVIDER_AUTH_OR_QUOTA', 'Verifique a configuração e a cota da API no servidor.', 503)
    }
    if (error.status === 429) return new PublicError('RATE_LIMITED', 'O provedor atingiu um limite de uso. Aguarde e tente novamente.', 429, true)
  }
  return new PublicError('PROVIDER_ERROR', 'Não foi possível consultar o provedor de IA. Tente novamente.', 502, true)
}
