import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AgroContext } from '../../data/agroContext'
import type { AgroContextValue, Dataset, Filters } from '../../data/agroContext'
import type { AiAssistResponse } from '../../shared/aiContracts'
import Shell from '../shell/shell'
import Recommendations from './recommendations'
import * as aiClient from './aiClient'
import { aiStatusFor } from '../../test/aiFixtures'

const readData = (file: string) => JSON.parse(readFileSync(resolve(`public/data/${file}.json`), 'utf8'))
const data: Dataset = {
  manifest: readData('manifest'), traps: readData('traps'), pests: readData('pests'),
  series: readData('trap-series'), events: readData('events/index'), climate: readData('climate/daily'),
  fertilization: readData('operations/fertilization'), spray: readData('operations/spray'),
  machineAlerts: readData('machine-alerts'), stopReasons: readData('stop-reasons'),
}
const filters: Filters = { from: '2025-08-01', to: '2026-02-25', trapCodes: [], pestKeys: [] }
const context: AgroContextValue = {
  data, filters, status: 'ready', error: null, isFiltered: false,
  availableRange: { from: filters.from, to: filters.to },
  reload: vi.fn(), setPeriod: vi.fn(), toggleTrap: vi.fn(), togglePest: vi.fn(), resetFilters: vi.fn(),
}
const response = (): AiAssistResponse => ({
  requestId: 'ai-indicators', generatedAt: '2026-10-29T12:00:00Z', datasetVersion: data.manifest.generatedAt, effectiveFilters: filters,
  selection: { provider: 'gemini', model: 'gemini-2.5-flash' },
  answer: { summary: 'Análise produzida pelo modelo.', findings: [{ id: 'model-finding', priority: 3, title: 'Recomendação específica da IA',
    explanation: 'Interpretação recebida do modelo.', suggestedAction: 'Verificação escolhida pelo modelo.', evidenceIds: ['rain'], limitations: ['Cobertura histórica.'] }],
    limitations: ['Sem previsão.'], followUpQuestions: [] },
  evidence: [{ id: 'rain', label: 'Chuva', value: 12.5, unit: 'mm', source: 'Estação de teste', href: '#/clima', from: filters.from, to: filters.to, scope: 'Período selecionado' }],
})
const view = (value = context) => <AgroContext.Provider value={value}><Recommendations /></AgroContext.Provider>
const indicators = () => within(screen.getByRole('region', { name: 'Indicadores por IA' }))
async function ready() {
  const result = render(view())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Analisar período' })).toBeEnabled())
  return result
}
beforeEach(() => {
  localStorage.clear()
  vi.spyOn(aiClient, 'getAiStatus').mockResolvedValue(aiStatusFor(data.manifest.generatedAt))
  vi.spyOn(aiClient, 'assist').mockResolvedValue(response())
})
afterEach(() => { vi.restoreAllMocks(); window.location.hash = '' })

describe('indicadores gerados pela IA', () => {
  it('abre pelo menu sem indicadores prontos nem consulta automática ao modelo', async () => {
    window.location.hash = '#/recomendacao-ia'
    await act(async () => render(<AgroContext.Provider value={context}><Shell /></AgroContext.Provider>))
    const links = within(screen.getByRole('navigation', { name: 'Navegacao principal' })).getAllByRole('link')
    expect(links.at(-1)).toHaveTextContent('Recomendação (IA)')
    expect(links.at(-1)).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Recomendações' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Indicadores por regras' })).not.toBeInTheDocument()
    expect(indicators().queryAllByRole('listitem')).toHaveLength(0)
    expect(aiClient.assist).not.toHaveBeenCalled()
  })
  it('usa títulos, prioridades, ações e evidências da resposta da IA nos cartões', async () => {
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await indicators().findByRole('heading', { name: 'Prioridade 3 · Recomendação específica da IA' })
    expect(indicators().getByText('Interpretação recebida do modelo.')).toBeInTheDocument()
    expect(indicators().getByText('Verificação escolhida pelo modelo.')).toBeInTheDocument()
    expect(indicators().getByText('Cobertura histórica.')).toBeInTheDocument()
    expect(indicators().getByLabelText('Prioridade 3')).toHaveTextContent('P3')
    expect(indicators().getByText(/Fonte: Estação de teste/)).toBeInTheDocument()
    expect(indicators().getByRole('link', { name: /Consultar dados/ })).toHaveAttribute('href', '#/clima')
    expect(aiClient.assist).toHaveBeenCalledTimes(1)
    expect(aiClient.assist).toHaveBeenCalledWith(expect.objectContaining({ mode: 'analysis', filters }), expect.any(AbortSignal))
  })
  it('aguarda a resposta para preencher os cartões', async () => {
    let finish!: (value: AiAssistResponse) => void
    vi.mocked(aiClient.assist).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    expect(indicators().getByRole('status')).toHaveTextContent('Gerando indicadores com a IA')
    expect(indicators().queryAllByRole('listitem')).toHaveLength(0)
    await act(async () => finish(response()))
    expect(indicators().getByRole('heading', { name: /Recomendação específica da IA/ })).toBeInTheDocument()
  })
  it('não preenche indicadores por regras quando a IA falha', async () => {
    vi.mocked(aiClient.assist).mockRejectedValue(new aiClient.AiClientError('INVALID_AI_RESPONSE', 'Resposta inválida.'))
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Resposta inválida.')
    expect(indicators().queryAllByRole('listitem')).toHaveLength(0)
  })
  it('apresenta ausência de achados retornada pela IA sem criar cartões', async () => {
    const empty = response()
    empty.answer.findings = []
    vi.mocked(aiClient.assist).mockResolvedValue(empty)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await indicators().findByText(/A IA não identificou recomendações/)
    expect(indicators().queryAllByRole('listitem')).toHaveLength(0)
  })
  it('respostas do chat não substituem os indicadores da análise do período', async () => {
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await indicators().findByRole('heading', { name: /Recomendação específica da IA/ })
    const chat = response()
    chat.answer.findings[0].title = 'Achado da pergunta específica'
    vi.mocked(aiClient.assist).mockResolvedValue(chat)
    fireEvent.click(screen.getByRole('button', { name: 'Como ficou o balanço hídrico?' }))
    await screen.findByRole('heading', { name: /Achado da pergunta específica/ })
    expect(indicators().getByRole('heading', { name: /Recomendação específica da IA/ })).toBeInTheDocument()
    expect(indicators().queryByRole('heading', { name: /Achado da pergunta específica/ })).not.toBeInTheDocument()
  })
  it('descarta os indicadores ao mudar o modelo ou os filtros', async () => {
    const { rerender } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await indicators().findByRole('heading', { name: /Recomendação específica da IA/ })
    fireEvent.change(screen.getByRole('combobox', { name: 'Modelo' }), { target: { value: 'gemini-2.5-pro' } })
    expect(indicators().queryAllByRole('listitem')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Analisar período' }))
    await indicators().findByRole('heading', { name: /Recomendação específica da IA/ })
    rerender(view({ ...context, filters: { ...filters, from: '2025-08-02' } }))
    expect(indicators().queryAllByRole('listitem')).toHaveLength(0)
  })
})
