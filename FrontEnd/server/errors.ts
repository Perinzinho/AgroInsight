export class PublicError extends Error {
  readonly code: string
  readonly status: number
  readonly retryable: boolean
  constructor(code: string, message: string, status = 502, retryable = false) {
    super(message)
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}
export const invalidResponse = () => new PublicError('INVALID_AI_RESPONSE', 'A IA não produziu uma resposta verificável. Tente novamente.', 502, true)
