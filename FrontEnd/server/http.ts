import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { assistRequestSchema } from '../src/shared/aiContracts'
import type { AiAssistResponse } from '../src/shared/aiContracts'
import type { Dataset } from '../src/shared/agroContracts'
import type { Config } from './config'
import { createDatasetStore } from './data/loadDataset'
import { PublicError } from './errors'
import { createProvider } from './ai/client'
import { defaultSelection, providerOptions, resolveSelection } from './ai/providers'
import type { AiProviderId, AiSelection } from '../src/shared/aiContracts'
import type { Provider } from './ai/client'
import { runAgent } from './ai/agent'
import type { TurnUsage } from './ai/agent'

export function validateFilters(data: Dataset, request: ReturnType<typeof assistRequestSchema.parse>) {
  const traps = new Set(data.traps.traps.map((trap) => trap.trapCode))
  const pests = new Set([...data.pests.groups.map((pest) => pest.key), ...data.series.rows.flatMap((row) => row.pests.map((pest) => pest.pestKey))])
  if (request.filters.trapCodes.some((code) => !traps.has(code)) || request.filters.pestKeys.some((key) => !pests.has(key))) {
    throw new PublicError('INVALID_REQUEST', 'Armadilha ou praga desconhecida nos filtros.', 400)
  }
  request.filters.trapCodes = [...new Set(request.filters.trapCodes)].sort()
  request.filters.pestKeys = [...new Set(request.filters.pestKeys)].sort()
  if (request.datasetVersion !== data.manifest.generatedAt) throw new PublicError('DATASET_CHANGED', 'A base mudou. Recarregue os dados e inicie uma nova conversa.', 409, true)
}
function localRequest(req: IncomingMessage) {
  const isLocal = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host)
  try {
    if (!req.headers.host || !isLocal(new URL(`http://${req.headers.host}`).hostname)) return false
    const origin = req.headers.origin
    if (origin && (!isLocal(new URL(origin).hostname) || !['http:', 'https:'].includes(new URL(origin).protocol))) return false
    if (req.headers['sec-fetch-site'] === 'cross-site') return false
    return true
  } catch { return false }
}
function json(res: ServerResponse, status: number, body: unknown) {
  if (res.destroyed || res.writableEnded) return
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(body))
}
function readBody(req: IncomingMessage, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    const cleanup = () => { req.off('data', onData); req.off('end', onEnd); req.off('error', onError); signal.removeEventListener('abort', onAbort) }
    const fail = (error: unknown) => { cleanup(); req.resume(); reject(error) }
    const onError = () => fail(new PublicError('INVALID_REQUEST', 'Corpo da requisição interrompido.', 400))
    const onAbort = () => fail(signal.reason)
    const onData = (chunk: Buffer) => {
      size += chunk.length
      if (size > 65536) { fail(new PublicError('REQUEST_TOO_LARGE', 'A requisição excede 64 KiB.', 413)); return }
      chunks.push(chunk)
    }
    const onEnd = () => {
      cleanup()
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { reject(new PublicError('INVALID_REQUEST', 'Envie um objeto JSON válido.', 400)) }
    }
    req.on('data', onData); req.once('end', onEnd); req.once('error', onError)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
}
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
    if (signal.aborted) onAbort()
  })
}
export function createAiServer(config: Config, options: {
  provider?: Provider; store?: { get(): Promise<Dataset> }; log?: (record: Record<string, unknown>) => void;
} = {}) {
  const store = options.store ?? createDatasetStore(config.dataDir)
  const log = options.log ?? ((record) => console.info(JSON.stringify(record)))
  const providers = new Map<AiProviderId, Provider>()
  let active = 0
  const clients = new Map<string, { count: number; reset: number }>()
  const server = createServer(async (req, res) => {
    const requestId = randomUUID()
    const started = performance.now()
    const usage: TurnUsage = { providerCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(new PublicError('AI_TIMEOUT', 'A análise excedeu o tempo disponível. Tente novamente.', 504, true)), config.AI_TIMEOUT_MS)
    const disconnect = () => { if (!res.writableEnded) controller.abort(new PublicError('CANCELLED', 'Análise cancelada.', 499)) }
    req.once('aborted', disconnect)
    res.once('close', disconnect)
    let slot = false
    let status = 200
    let selection: AiSelection | undefined
    let errorCode: string | undefined
    let diagnostic: PublicError['diagnostic']
    try {
      if (!localRequest(req)) throw new PublicError('INVALID_REQUEST', 'Origem ou host não permitido.', 403)
      if (req.method === 'GET' && req.url === '/api/ai/status') {
        let data: Dataset | undefined
        try { data = await abortable(store.get(), controller.signal) } catch { /* Status remains available without local data. */ }
        controller.signal.throwIfAborted()
        const available = providerOptions(config)
        const configured = available.some((option) => option.configured)
        json(res, 200, { configured, dataReady: Boolean(data), datasetVersion: data?.manifest.generatedAt ?? null,
          providers: available, defaultSelection: defaultSelection(config),
          message: !data ? 'Gere os dados locais antes de analisar.' : !configured ? 'Configure um provedor de IA no servidor para gerar indicadores e recomendações.' : null })
        return
      }
      if (req.url !== '/api/ai/assist' || req.method !== 'POST') throw new PublicError('NOT_FOUND', 'Endpoint não encontrado.', 404)
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new PublicError('INVALID_REQUEST', 'Use Content-Type application/json.', 415)
      if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw new PublicError('INVALID_REQUEST', 'Compressão de corpo não suportada.', 415)
      if (Number(req.headers['content-length']) > 65536) throw new PublicError('REQUEST_TOO_LARGE', 'A requisição excede 64 KiB.', 413)
      const result = assistRequestSchema.safeParse(await readBody(req, controller.signal))
      if (!result.success) throw new PublicError('INVALID_REQUEST', 'Revise pergunta, histórico, filtros e intervalo de até 366 dias.', 400)
      const request = result.data
      const clientId = req.socket.remoteAddress ?? 'local'
      const now = Date.now()
      for (const [key, entry] of clients) if (entry.reset <= now) clients.delete(key)
      const rate = clients.get(clientId) ?? { count: 0, reset: now + 60000 }
      if (rate.count >= config.AI_RATE_LIMIT_PER_MINUTE) throw new PublicError('RATE_LIMITED', 'Limite local de análises por minuto atingido. Aguarde e tente novamente.', 429, true)
      rate.count++; clients.set(clientId, rate)
      if (active >= config.AI_MAX_CONCURRENT_REQUESTS) throw new PublicError('RATE_LIMITED', 'Há análises em andamento. Aguarde e tente novamente.', 429, true)
      active++; slot = true
      const data = await abortable(store.get(), controller.signal)
      validateFilters(data, request)
      selection = resolveSelection(config, request)
      request.provider = selection.provider; request.model = selection.model
      let provider = options.provider ?? providers.get(selection.provider)
      if (!provider) { provider = createProvider(config, selection.provider); providers.set(selection.provider, provider) }
      controller.signal.throwIfAborted()
      const response: AiAssistResponse = await abortable(runAgent({ request, dataset: data, config, provider, signal: controller.signal, requestId, usage }), controller.signal)
      json(res, 200, response)
    } catch (cause) {
      const error = controller.signal.aborted && controller.signal.reason instanceof PublicError ? controller.signal.reason
        : cause instanceof PublicError ? cause : new PublicError('PROVIDER_ERROR', 'Não foi possível concluir a análise.', 502, true)
      status = error.status
      errorCode = error.code
      diagnostic = error.diagnostic
      if (status === 429) res.setHeader('Retry-After', '60')
      json(res, status, { requestId, error: { code: error.code, message: error.message, retryable: error.retryable } })
    } finally {
      clearTimeout(timeout)
      if (slot) active--
      req.off('aborted', disconnect); res.off('close', disconnect)
      log({ requestId, latencyMs: Math.round(performance.now() - started), status, ...selection, errorCode, diagnostic, inputTokenLimit: config.AI_MAX_INPUT_TOKENS, ...usage })
    }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  server.maxHeadersCount = 40
  return server
}
