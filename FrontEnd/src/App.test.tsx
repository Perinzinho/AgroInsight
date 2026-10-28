import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

/**
 * Teste de fumaca da raiz do produto.
 *
 * O objetivo nao e verificar cada tela, e garantir que a arvore inicial monta:
 * `App` -> `AgroProvider` -> `Shell`. Um erro aqui aparece como tela branca em
 * producao e nao e peg pelo TypeScript, que so checa tipos.
 */
describe('App', () => {
  it('monta sem lancar erro', async () => {
    // O provider busca os JSONs ao montar. Sem rede no jsdom, respondemos o
    // suficiente para a interface cair no estado de erro controlado, que e
    // justamente um caminho que precisa renderizar.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('sem rede no teste')
      }),
    )

    render(<App />)

    expect(await screen.findByRole('navigation', { name: /navegacao principal/i })).toBeInTheDocument()
  })

  it('nao expoe marcadores de conflito do merge pendente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('sem rede no teste')
      }),
    )

    const { container } = render(<App />)
    expect(container.innerHTML).not.toContain('<<<<<<<')
    expect(container.innerHTML).not.toContain('>>>>>>>')
  })
})