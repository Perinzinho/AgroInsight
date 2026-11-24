import { z } from 'zod'
import type { FunctionTool } from 'openai/resources/responses/responses'
import { zodResponsesFunction } from 'openai/helpers/zod'
import type { createQueries } from './queries'
import { PublicError } from '../errors'

const empty = z.object({}).strict()
const operationArgs = z.object({ kind: z.enum(['fertilization', 'spray', 'both']) }).strict()
const descriptions = {
  consultarResumo: 'Síntese numérica, cobertura e limitações de todos os domínios no escopo atual.',
  consultarPragas: 'Contagem oficial filtrada, ranking, dias, comparação anterior e limiares diários por cultura.',
  consultarClima: 'Chuva, evapotranspiração, balanço hídrico, temperatura e lacunas; somente histórico.',
  consultarOperacoes: 'OS pelos dias efetivos; totais completos e avisos de escopo, doses e pressão.',
  consultarAlertasMaquina: 'Alertas por tipo, classificação e raio de referência; sem inferir horas ociosas ou causas.',
}
export const toolDefinitions: FunctionTool[] = Object.entries(descriptions).map(([name, description]) =>
  zodResponsesFunction({ name, description, parameters: name === 'consultarOperacoes' ? operationArgs : empty }))
export function dispatchTool(queries: ReturnType<typeof createQueries>, name: string, args: string) {
  let parsed: unknown
  try { parsed = JSON.parse(args) } catch { throw new PublicError('INVALID_AI_RESPONSE', 'A IA solicitou uma consulta inválida.', 502, true) }
  try {
    // Explicit dispatch; never property lookup, eval, dynamic imports or caller-supplied filters.
    switch (name) {
      case 'consultarResumo': empty.parse(parsed); return queries.consultarResumo()
      case 'consultarPragas': empty.parse(parsed); return queries.consultarPragas()
      case 'consultarClima': empty.parse(parsed); return queries.consultarClima()
      case 'consultarAlertasMaquina': empty.parse(parsed); return queries.consultarAlertasMaquina()
      case 'consultarOperacoes': return queries.consultarOperacoes(operationArgs.parse(parsed).kind)
      default: throw new Error('Unknown tool')
    }
  } catch {
    throw new PublicError('INVALID_AI_RESPONSE', 'A IA solicitou uma consulta não permitida.', 502, true)
  }
}
