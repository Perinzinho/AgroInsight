import { z } from 'zod'

export const providerIdSchema = z.enum(['gemini', 'openrouter', 'openai'])
export type AiProviderId = z.infer<typeof providerIdSchema>
export const providerLabels: Record<AiProviderId, string> = { gemini: 'Gemini', openrouter: 'OpenRouter', openai: 'OpenAI' }
export const selectionSchema = z.object({
  provider: providerIdSchema,
  model: z.string().min(1).max(160).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/),
}).strict()
export type AiSelection = z.infer<typeof selectionSchema>
export const modelCatalogSchema = z.object({
  provider: providerIdSchema, defaultModel: z.string(),
  models: z.array(z.object({ id: z.string().min(1).max(160), name: z.string().min(1).max(200) }).strict()).max(2000),
}).strict()
export type ModelCatalog = z.infer<typeof modelCatalogSchema>

export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data inválida')
export const filtersSchema = z.object({
  from: daySchema, to: daySchema,
  trapCodes: z.array(z.string().min(1).max(120)).max(200),
  pestKeys: z.array(z.string().min(1).max(120)).max(200),
}).strict().refine((f) => f.from <= f.to && Date.parse(f.to) - Date.parse(f.from) <= 365 * 86400000, 'Intervalo deve ter de 1 a 366 dias')
export const historySchema = z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000),
}).strict()).max(12).refine((h) => h.reduce((sum, item) => sum + item.content.length, 0) <= 12000, 'Histórico muito longo')
export const assistRequestSchema = z.object({
  selection: selectionSchema.optional(),
  mode: z.enum(['analysis', 'chat']), message: z.string().trim().max(2000).optional(),
  filters: filtersSchema, datasetVersion: z.string().min(1).max(100), history: historySchema,
}).strict().refine((r) => r.mode === 'analysis' || Boolean(r.message), 'Informe uma pergunta')
const text = z.string().min(1).max(1600)
export const answerSchema = z.object({
  summary: text,
  findings: z.array(z.object({
    id: z.string().min(1).max(80), priority: z.enum({ P1: 1, P2: 2, P3: 3 } as const),
    title: z.string().min(1).max(200), explanation: text, suggestedAction: text,
    evidenceIds: z.array(z.string().min(1).max(100)).min(1).max(12), limitations: z.array(text).max(8),
  }).strict()).max(8),
  limitations: z.array(text).max(12), followUpQuestions: z.array(z.string().min(1).max(200)).max(5),
}).strict()
export const allowedRoutes = ['#/clima', '#/tendencias', '#/pragas', '#/qualidade', '#/alertas-maquina', '#/operacoes'] as const
export const evidenceSchema = z.object({
  id: z.string(), label: z.string(), value: z.union([z.number().finite(), z.string(), z.null()]),
  unit: z.string().nullable(), source: z.string(), href: z.enum(allowedRoutes),
  from: daySchema.nullable(), to: daySchema.nullable(), scope: z.string(),
}).strict()
export const assistResponseSchema = z.object({
  selection: selectionSchema.optional(),
  requestId: z.string(), generatedAt: z.string(), datasetVersion: z.string(), effectiveFilters: filtersSchema,
  answer: answerSchema, evidence: z.array(evidenceSchema).max(200),
}).strict().refine((r) => r.answer.findings.every((f) => f.evidenceIds.every((id) => r.evidence.some((e) => e.id === id))), 'Evidência desconhecida')
export const statusSchema = z.object({
  providers: z.array(z.object({ id: providerIdSchema, configured: z.boolean(), defaultModel: z.string() }).strict()).optional(),
  defaultSelection: selectionSchema.optional(),
  configured: z.boolean(), dataReady: z.boolean(), datasetVersion: z.string().nullable(), message: z.string().nullable(),
}).strict()
export type AssistRequest = z.infer<typeof assistRequestSchema>
export type AiAnswer = z.infer<typeof answerSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type AiAssistResponse = z.infer<typeof assistResponseSchema>
export type AiStatus = z.infer<typeof statusSchema>
