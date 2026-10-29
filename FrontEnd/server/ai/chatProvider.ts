import { randomUUID } from 'node:crypto'
import type OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { ResponseOutputItem } from 'openai/resources/responses/responses'
import type { Provider } from './client'
import { invalidResponse, PublicError } from '../errors'
import { estimateInputTokens } from './tokenBudget'

const finalTool = 'responderAnalise'

// One adapter per HTTP turn. Keep raw assistant messages, including thought signatures
// and OpenRouter reasoning_details, instead of reconstructing their private metadata.
export function createChatProvider(client: Pick<OpenAI, 'chat'>, provider: 'gemini' | 'openrouter', maxInputTokens: number): Provider {
  const messages: ChatCompletionMessageParam[] = []
  let consumed = 0
  return { async create(params, signal) {
    if (!Array.isArray(params.input)) throw invalidResponse()
    if (!consumed) {
      const context = params.input.filter((item) => 'role' in item && (item.role === 'developer' || item.role === 'system'))
        .map((item) => 'content' in item ? item.content : '')
      messages.push({ role: 'system', content: `${params.instructions}\n${context.join('\n')}\nApós consultar os dados, conclua chamando ${finalTool} com a análise e suas evidências.` })
    }
    for (const item of params.input.slice(consumed)) {
      if ('type' in item && item.type === 'function_call_output') {
        if (typeof item.output !== 'string' || typeof item.call_id !== 'string') throw invalidResponse()
        messages.push({ role: 'tool', tool_call_id: item.call_id, content: item.output })
      } else if (!consumed && 'role' in item && (item.role === 'user' || item.role === 'assistant')) {
        if (typeof item.content !== 'string') throw invalidResponse()
        messages.push({ role: item.role, content: item.content })
      }
    }
    consumed = params.input.length
    const format = params.text?.format
    if (format?.type !== 'json_schema') throw invalidResponse()
    const finish: ChatCompletionTool = { type: 'function', function: {
      name: finalTool, description: 'Entregue a análise final com fatos e IDs de evidência já consultados.', parameters: format.schema,
    } }
    const tools: ChatCompletionTool[] = (params.tools ?? []).map((tool) => {
      if (tool.type !== 'function') throw invalidResponse()
      const properties = tool.parameters?.properties
      const parameters = properties && typeof properties === 'object' && Object.keys(properties).length === 0 ? undefined : tool.parameters ?? undefined
      return { type: 'function', function: { name: tool.name, description: tool.description ?? undefined, parameters } }
    })
    const first = params.tool_choice === 'required'
    const forced = params.tool_choice === 'none'
    const body = {
      model: params.model!, messages: structuredClone(messages),
      tools: forced ? [finish] : first ? tools : [...tools, finish],
      tool_choice: forced ? { type: 'function' as const, function: { name: finalTool } } : 'required' as const,
      ...(provider === 'openrouter' ? { parallel_tool_calls: false, provider: { require_parameters: true } } : {}),
      max_tokens: params.max_output_tokens,
    }
    if (estimateInputTokens(body) > maxInputTokens) throw new PublicError('CONTEXT_LIMIT', 'O contexto atingiu o orçamento desta análise. Limpe a conversa ou reduza o período.', 413, true)
    const completion = await client.chat.completions.create(body, { signal })
    signal.throwIfAborted()
    const choice = completion.choices[0]
    if (!choice || !['stop', 'tool_calls'].includes(choice.finish_reason) || choice.message.refusal) throw invalidResponse()
    const calls = choice.message.tool_calls ?? []
    const final = calls.filter((call) => call.type === 'function' && call.function.name === finalTool)
    if (final.length && (first || calls.length !== 1)) throw invalidResponse()
    let output: ResponseOutputItem[]
    if (final.length) {
      const call = final[0]
      if (call.type !== 'function') throw invalidResponse()
      output = [{ type: 'message', id: randomUUID(), role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: call.function.arguments, annotations: [], logprobs: [] }] }]
    } else {
      if (forced || !calls.length) throw invalidResponse()
      output = calls.map((call) => {
        if (call.type !== 'function' || !call.id) throw invalidResponse()
        return { type: 'function_call', id: call.id, call_id: call.id, name: call.function.name, arguments: call.function.arguments, status: 'completed' }
      })
      messages.push(structuredClone(choice.message))
    }
    return { status: 'completed', output, usage: completion.usage ? {
      input_tokens: completion.usage.prompt_tokens, output_tokens: completion.usage.completion_tokens,
      total_tokens: completion.usage.total_tokens,
      input_tokens_details: { cached_tokens: completion.usage.prompt_tokens_details?.cached_tokens ?? 0 },
      output_tokens_details: { reasoning_tokens: completion.usage.completion_tokens_details?.reasoning_tokens ?? 0 },
    } : undefined }
  } }
}
