export class PublicError extends Error {
  readonly code: string
  readonly status: number
  readonly retryable: boolean
  readonly diagnostic?: { stage: string; fields?: string[] }
  constructor(code: string, message: string, status = 502, retryable = false, diagnostic?: { stage: string; fields?: string[] }) {
    super(message)
    this.code = code
    this.status = status
    this.retryable = retryable
    this.diagnostic = diagnostic
  }
}
export const invalidResponse = (stage = 'answer', fields?: string[]) => new PublicError('INVALID_AI_RESPONSE', 'A IA não produziu uma resposta verificável. Tente novamente.', 502, true, { stage, fields })
