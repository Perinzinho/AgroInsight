import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgroContext } from '../../data/agroContext'
import type { AgroContextValue, Dataset, Filters } from '../../data/agroContext'
import type { AiAssistResponse } from '../../shared/aiContracts'
import Recommendations from './recommendations'
import { AiClientError, assist, getAiStatus } from './aiClient'

vi.mock('./aiClient', async (original) => ({ ...await original<typeof import('./aiClient')>(), assist: vi.fn(), getAiStatus: vi.fn() }))
const read = (file: string) => JSON.parse(readFileSync(resolve(`public/data/${file}.json`), 'utf8'))
const data: Dataset = { manifest: read('manifest'), traps: read('traps'), pests: read('pests'), series: read('trap-series'), events: read('events/index'), climate: read('climate/daily'), fertilization: read('operations/fertilization'), spray: read('operations/spray'), machineAlerts: read('machine-alerts'), stopReasons: read('stop-reasons') }
const filters: Filters = { from: '2026-02-19', to: '2026-02-25', trapCodes: [], pestKeys: [] }
const context: AgroContextValue = { data, filters, status: 'ready', error: null, availableRange: { from: filters.from, to: filters.to }, isFiltered: false,
  reload: vi.fn(), setPeriod: vi.fn(), toggleTrap: vi.fn(), togglePest: vi.fn(), resetFilters: vi.fn() }
const response = (f: Filters = filters): AiAssistResponse => ({
  requestId: 'test', generatedAt: new Date().toISOString(), datasetVersion: data.manifest.generatedAt, effectiveFilters: f,
  answer: { summary: 'Resumo com evidências verificadas.', findings: [{ id: 'rain', title: 'Chuva no período', priority: 2,
    explanation: 'Registro da estação.', suggestedAction: 'Consultar a série.', evidenceIds: ['rain'], limitations: ['Histórico.'] }],
    limitations: ['Sem produtividade.'], followUpQuestions: ['E o balanço?'] },
  evidence: [{ id: 'rain', label: 'Chuva', value: 12.5, unit: 'mm', source: 'Estação de teste', href: '#/clima', from: f.from, to: f.to, scope: 'Período' }],
})
const view = (value = context) => <AgroContext.Provider value={value}><Recommendations /></AgroContext.Provider>
beforeEach(() => {
  vi.mocked(getAiStatus).mockResolvedValue({ configured: true, dataReady: true, datasetVersion: data.manifest.generatedAt, message: null })
  vi.mocked(assist).mockImplementation(async (request) => response(request.filters))
})
afterEach(() => { vi.resetAllMocks() })

describe('conversa de análise', () => {
  it('só consulta a IA após clique e mostra fontes, período e limitações', async () => {
    render(view())
    await waitFor(() => expect(getAiStatus).toHaveBeenCalledTimes(1))
    expect(assist).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    expect(await screen.findByText('Resumo com evidências verificadas.')).toBeInTheDocument()
    expect(assist).toHaveBeenCalledWith(expect.objectContaining({ mode: 'analysis', filters, history: [], datasetVersion: data.manifest.generatedAt }), expect.any(AbortSignal))
    expect(screen.getByRole('heading', { name: 'Prioridade 2 · Chuva no período' })).toBeInTheDocument()
    expect(screen.getAllByText(/Estação de teste/).length).toBeGreaterThan(0)
    expect(screen.getByText('Sem produtividade.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Indicadores por regras' })).toBeInTheDocument()
  })
  it('envia chat com Enter, preserva Shift+Enter e não envia durante composição', async () => {
    render(view())
    const input = screen.getByLabelText('Pergunte sobre os registros')
    fireEvent.change(input, { target: { value: 'Choveu quanto?' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(assist).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText('Resumo com evidências verificadas.')
    expect(assist).toHaveBeenCalledWith(expect.objectContaining({ mode: 'chat', message: 'Choveu quanto?' }), expect.any(AbortSignal))
    expect(input).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'E o balanço?' }))
    await waitFor(() => expect(assist).toHaveBeenCalledTimes(2))
    expect(vi.mocked(assist).mock.calls[1][0].history).toEqual([{ role: 'user', content: 'Choveu quanto?' }, { role: 'assistant', content: 'Resumo com evidências verificadas.' }])
  })
  it('botão Enviar e sugestões fazem envios explícitos', async () => {
    render(view())
    fireEvent.change(screen.getByLabelText('Pergunte sobre os registros'), { target: { value: 'Há dados?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await screen.findByText('Resumo com evidências verificadas.')
    fireEvent.click(screen.getByRole('button', { name: 'Como ficou o balanço hídrico?' }))
    await waitFor(() => expect(assist).toHaveBeenCalledTimes(2))
    expect(vi.mocked(assist).mock.calls[1][0].message).toBe('Como ficou o balanço hídrico?')
  })
  it('bloqueia duplicidade, cancela e ignora resultado atrasado', async () => {
    let finish!: (value: AiAssistResponse) => void
    vi.mocked(assist).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    render(view())
    const analyze = screen.getByRole('button', { name: 'Analisar período' })
    fireEvent.click(analyze); fireEvent.click(analyze)
    expect(assist).toHaveBeenCalledTimes(1)
    expect(analyze).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(vi.mocked(assist).mock.calls[0][1].aborted).toBe(true)
    await act(async () => finish(response()))
    expect(screen.queryByText('Resumo com evidências verificadas.')).not.toBeInTheDocument()
    expect(analyze).toBeEnabled()
    vi.mocked(assist).mockResolvedValueOnce(response())
    fireEvent.click(screen.getByRole('button', { name: 'Quais pragas tiveram mais detecções?' }))
    await screen.findByText('Resumo com evidências verificadas.')
    expect(vi.mocked(assist).mock.calls[1][0].history).toEqual([])
  })
  it.each(['filters', 'version'])('mudar %s cancela, limpa e impede resposta de escopo antigo', async (kind) => {
    let finish!: (value: AiAssistResponse) => void
    vi.mocked(assist).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    const next = kind === 'filters' ? { ...context, filters: { ...filters, from: '2026-02-20' } }
      : { ...context, data: { ...data, manifest: { ...data.manifest, generatedAt: '2026-10-27T12:00:00.000Z' } } }
    rerender(view(next))
    expect(vi.mocked(assist).mock.calls[0][1].aborted).toBe(true)
    await act(async () => finish(response()))
    expect(screen.queryByText('Resumo com evidências verificadas.')).not.toBeInTheDocument()
    expect(screen.getByText(/Uma nova conversa foi iniciada/)).toBeInTheDocument()
    expect(assist).toHaveBeenCalledTimes(1)
  })
  it('desmontagem aborta a chamada e limpar remove o histórico', async () => {
    const first = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await screen.findByText('Resumo com evidências verificadas.')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar conversa' }))
    expect(screen.queryByText('Resumo com evidências verificadas.')).not.toBeInTheDocument()
    vi.mocked(assist).mockImplementation(() => new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    expect(vi.mocked(assist).mock.calls[1][0].history).toEqual([])
    first.unmount()
    expect(vi.mocked(assist).mock.calls[1][1].aborted).toBe(true)
  })
  it('falha oferece nova tentativa explícita e limite mantém regras disponíveis', async () => {
    vi.mocked(assist).mockRejectedValueOnce(new AiClientError('RATE_LIMITED', 'Limite atingido. Aguarde.')).mockResolvedValueOnce(response())
    render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Limite atingido')
    expect(assist).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'Indicadores por regras' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Resumo com evidências verificadas.')
    expect(assist).toHaveBeenCalledTimes(2)
    expect(screen.getAllByText('Analisar período', { selector: 'p' })).toHaveLength(1)
  })
  it('sem configuração informa indisponibilidade e preserva as seis regras', async () => {
    vi.mocked(getAiStatus).mockResolvedValue({ configured: false, dataReady: true, datasetVersion: data.manifest.generatedAt, message: 'IA não configurada.' })
    const { container } = render(view())
    await screen.findByText('IA não configurada.')
    expect(screen.getByRole('button', { name: 'Analisar período' })).toBeDisabled()
    expect(container.querySelectorAll('.recommendations__item')).toHaveLength(6)
    expect(assist).not.toHaveBeenCalled()
  })
  it('recupera a disponibilidade sem recarregar a base nem fazer uma análise automática', async () => {
    vi.mocked(getAiStatus).mockRejectedValueOnce(new Error('offline'))
    render(view())
    await screen.findByText(/A API local está indisponível/)
    const reloadCount = vi.mocked(context.reload).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Verificar disponibilidade' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Analisar período' })).toBeEnabled())
    expect(getAiStatus).toHaveBeenCalledTimes(2)
    expect(vi.mocked(context.reload).mock.calls).toHaveLength(reloadCount)
    expect(assist).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await screen.findByText('Resumo com evidências verificadas.')
    expect(assist).toHaveBeenCalledTimes(1)
  })
  it('preserva os turnos concluídos e exclui perguntas com falha do próximo contexto', async () => {
    render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await screen.findByText('Resumo com evidências verificadas.')
    vi.mocked(assist).mockRejectedValueOnce(new AiClientError('PROVIDER_ERROR', 'Falha temporária.'))
    fireEvent.click(screen.getByRole('button', { name: 'Como ficou o balanço hídrico?' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Quais pragas tiveram mais detecções?' }))
    await waitFor(() => expect(screen.getAllByText('Resumo com evidências verificadas.')).toHaveLength(2))
    expect(vi.mocked(assist).mock.calls[2][0].history).toEqual([
      { role: 'user', content: 'Analisar período' },
      { role: 'assistant', content: 'Resumo com evidências verificadas.' },
    ])
  })
  it('versão divergente oferece recarregar sem repetir consumo', async () => {
    vi.mocked(assist).mockRejectedValueOnce(new AiClientError('DATASET_CHANGED', 'A base mudou.', false))
    render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Recarregar dados' }))
    expect(context.reload).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })
})
