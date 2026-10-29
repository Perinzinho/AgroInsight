import { useEffect, useState } from 'react'
import type { AiProviderId, AiSelection, AiStatus, ModelCatalog } from '../../shared/aiContracts'
import { AiClientError, getAiModels, getAiStatus } from './aiClient'

export function useAiSettings() {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [statusAttempt, setStatusAttempt] = useState(0)
  const [providerOverride, setProviderOverride] = useState<AiProviderId | null>(null)
  const [modelOverrides, setModelOverrides] = useState<Partial<Record<AiProviderId, string>>>({})
  const [catalog, setCatalog] = useState<(ModelCatalog & { attempt: number }) | null>(null)
  const [modelFailure, setModelFailure] = useState<{ provider: AiProviderId; attempt: number; error: AiClientError } | null>(null)
  const [modelsAttempt, setModelsAttempt] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getAiStatus(controller.signal).then((value) => {
      if (!controller.signal.aborted) setStatus(value)
    }).catch(() => {
      if (!controller.signal.aborted) setStatus({ configured: false, dataReady: false, datasetVersion: null,
        message: 'A API local está indisponível. Inicie o backend; os indicadores por regras continuam disponíveis.' })
    }).finally(() => { if (!controller.signal.aborted) setCheckingStatus(false) })
    return () => controller.abort()
  }, [statusAttempt])

  const providers = status?.providers ?? [
    { id: 'gemini' as const, configured: false, defaultModel: 'gemini-3.8-flash' },
    { id: 'openrouter' as const, configured: false, defaultModel: 'openai/gpt-4.1-mini' },
    { id: 'openai' as const, configured: status?.configured ?? false, defaultModel: 'gpt-4.1-mini' },
  ]
  const provider = providerOverride ?? status?.defaultSelection?.provider ?? (status?.configured ? 'openai' : 'gemini')
  const selectedProvider = providers.find((item) => item.id === provider)!
  const currentCatalog = catalog?.provider === provider && catalog.attempt === modelsAttempt ? catalog : null
  const modelsError = modelFailure?.provider === provider && modelFailure.attempt === modelsAttempt ? modelFailure.error : null
  const selection: AiSelection = { provider, model: modelOverrides[provider] ?? currentCatalog?.defaultModel ?? selectedProvider.defaultModel }
  const models = currentCatalog?.models ?? [{ id: selection.model, name: selection.model }]
  const modelsLoading = status !== null && !currentCatalog && !modelsError
  const unavailable = !status?.dataReady || !selectedProvider.configured || Boolean(modelsError)
    || !models.some((item) => item.id === selection.model)

  useEffect(() => {
    if (!status) return
    const controller = new AbortController()
    getAiModels(provider, controller.signal).then((value) => {
      if (!controller.signal.aborted) { setCatalog({ ...value, attempt: modelsAttempt }); setModelFailure(null) }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setModelFailure({ provider, attempt: modelsAttempt,
        error: cause instanceof AiClientError ? cause : new AiClientError('MODEL_CATALOG_UNAVAILABLE', 'Não foi possível carregar os modelos. Tente novamente.') })
    })
    return () => controller.abort()
  }, [provider, modelsAttempt, status])

  const changed = () => setNotice('O provedor ou modelo mudou. Uma nova conversa foi iniciada.')
  return { status, checkingStatus, providers, selection, models, modelsLoading, modelsError, unavailable, notice,
    chooseProvider: (id: AiProviderId) => { if (id !== provider) { changed(); setProviderOverride(id) } },
    chooseModel: (model: string) => { if (model !== selection.model) { changed(); setModelOverrides((current) => ({ ...current, [provider]: model })) } },
    refreshModels: () => setModelsAttempt((value) => value + 1),
    refreshStatus: () => { if (!checkingStatus) { setCheckingStatus(true); setStatusAttempt((value) => value + 1); setModelsAttempt((value) => value + 1) } },
  }
}
