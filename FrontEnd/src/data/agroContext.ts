import { createContext, useContext } from 'react'
import type { Dataset, Filters } from '../shared/agroContracts'
export type { Dataset, Filters } from '../shared/agroContracts'

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface AgroContextValue {
  status: LoadStatus
  error: string | null
  data: Dataset | null
  filters: Filters
  /** Intervalo completo disponivel, independente do filtro atual. */
  availableRange: { from: string; to: string }
  isFiltered: boolean
  reload: () => void
  setPeriod: (from: string, to: string) => void
  toggleTrap: (trapCode: string) => void
  togglePest: (pestKey: string) => void
  resetFilters: () => void
}

export const AgroContext = createContext<AgroContextValue | null>(null)

export function useAgro(): AgroContextValue {
  const value = useContext(AgroContext)
  if (!value) throw new Error('useAgro precisa estar dentro de <AgroProvider>.')
  return value
}
