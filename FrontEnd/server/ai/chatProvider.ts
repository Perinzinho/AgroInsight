import { randomUUID } from 'node:crypto'
import type OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { AiProviderId } from '../../src/shared/aiContracts'
import type { Provider } from './client'
import { invalidResponse, PublicError } from '../errors'
import { estimateInputTokens } from './tokenBudget'

// Plain text chat is the common denominator. JSON and evidence are validated
// locally, without requiring function calling or a provider's schema dialect.
export function createChatProvider(client: Pick<OpenAI, 'chat'>, provider: AiProviderId, maxInputTokens: number): Provider {
  return { async create(params, signal) {
    if (!Array.isArray(params.input)) throw invalidResponse()
    const context: string[] = [params.instructions ?? '']
    const conversation: ChatCompletionMessageParam[] = []
    for (const item of params.input) {
      if (!('role' in item) || !('content' in item) || typeof item.content !== 'string') throw invalidResponse()
      if (item.role === 'developer' || item.role === 'system') context.push(item.content)
      else if (item.role === 'user' || item.role === 'assistant') conversation.push({ role: item.role, content: item.content })
      else throw invalidResponse()
    }
    const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: context.join('\n') }, ...conversation]
    const body = { model: params.model!, messages,
      ...(provider === 'openai' ? { max_completion_tokens: params.max_output_tokens } : { max_tokens: params.max_output_tokens }) }
    if (estimateInputTokens(body) > maxInputTokens) throw new PublicError('CONTEXT_LIMIT', 'O contexto atingiu o orçamento desta análise. Limpe a conversa ou faça uma pergunta mais específica.', 413, true)
    const completion = await client.chat.completions.create(body, { signal })
    signal.throwIfAborted()
    const choice = completion.choices[0]
    if (!choice || !['stop', 'length'].includes(choice.finish_reason) || choice.message.refusal || choice.message.tool_calls?.length || !choice.message.content) throw invalidResponse()
    const status = choice.finish_reason === 'length' ? 'incomplete' as const : 'completed' as const
    return { status, output: [{ type: 'message', id: randomUUID(), role: 'assistant', status,
      content: [{ type: 'output_text', text: choice.message.content, annotations: [], logprobs: [] }] }],
    usage: completion.usage ? { input_tokens: completion.usage.prompt_tokens, output_tokens: completion.usage.completion_tokens, total_tokens: completion.usage.total_tokens } : undefined }
  } }
}
