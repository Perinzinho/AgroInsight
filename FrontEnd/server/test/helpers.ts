import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Response } from 'openai/resources/responses/responses'
import type { AiAnswer, AssistRequest } from '../../src/shared/aiContracts'
import { createDatasetStore } from '../data/loadDataset'
import { datasetSchema } from '../data/schemas'

export const dataDir = resolve('public/data')
export const loadData = async () => {
  try { return await createDatasetStore(dataDir).get() }
  catch {
    const names = { manifest: 'manifest', traps: 'traps', pests: 'pests', series: 'trap-series', events: 'events/index', climate: 'climate/daily', fertilization: 'operations/fertilization', spray: 'operations/spray', machineAlerts: 'machine-alerts', stopReasons: 'stop-reasons' }
    const raw = Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, file]) => [key, await readRaw(`${file}.json`)])))
    const result = datasetSchema.safeParse(raw)
    if (!result.success) throw new Error(JSON.stringify(result.error.issues.slice(0, 8)))
    return result.data
  }
}
export const readRaw = async (file: string) => JSON.parse(await readFile(resolve(dataDir, file), 'utf8'))
export const requestFor = (version: string): AssistRequest => ({ mode: 'analysis', datasetVersion: version,
  filters: { from: '2026-02-19', to: '2026-02-25', trapCodes: [], pestKeys: [] }, history: [] })
export const answer: AiAnswer = {
  summary: 'Leituras históricas para o período selecionado.',
  findings: [{ id: 'rain', title: 'Chuva registrada', priority: 2, explanation: 'A estação tem registros no período.',
    suggestedAction: 'Confira a cobertura da estação.', evidenceIds: ['climate-rain'], limitations: ['O histórico não é previsão.'] }],
  limitations: ['Não há produtividade ou dados financeiros.'], followUpQuestions: ['Como ficou o balanço hídrico?'],
}
export const response = (output: Response['output'], status: Response['status'] = 'completed'): Response => ({
  id: 'resp_test', object: 'response', created_at: 0, model: 'gpt-4.1-mini', status, output,
  usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 },
} as Response)
export const toolResponse = (name = 'consultarClima', args = '{}', callId = 'call_weather') => response([
  { type: 'function_call', id: `fc_${callId}`, call_id: callId, name, arguments: args, status: 'completed' },
])
export const finalResponse = (value: unknown = answer) => response([
  { type: 'message', id: 'msg_test', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [], logprobs: [] }] },
])
