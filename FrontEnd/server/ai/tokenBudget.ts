import { getEncoding } from 'js-tiktoken'

const tokenizer = getEncoding('o200k_base')
// Local estimate across providers; actual usage returned by each provider is authoritative.
export const estimateInputTokens = (payload: unknown) => tokenizer.encode(JSON.stringify(payload)).length + 512
