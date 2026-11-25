import { describe, expect, it } from 'vitest'
import type { AiAssistResponse } from '../../shared/aiContracts'
import { historyAnswer } from './useAiAssistant'

describe('contexto de uma conversa do assistente', () => {
  it('preserva a ordem dos achados para perguntas como "explique o primeiro"', () => {
    const response = { answer: { summary: 'Há sinais a verificar.', findings: [
      { title: 'Revisar a pulverização' }, { title: 'Conferir o clima' },
    ] } } as AiAssistResponse
    expect(historyAnswer(response)).toBe('Resumo: Há sinais a verificar.\nAchados anteriores:\n1. Revisar a pulverização\n2. Conferir o clima')
  })
})
