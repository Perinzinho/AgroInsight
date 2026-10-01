import { useEffect, useId, useRef, useState } from 'react'
import './multiSelect.css'

export interface Option {
  value: string
  label: string
  /** `true` quando o item so existe para deixar claro o que esta selecionado. */
  hint?: string
}

/**
 * Seletor multiplo com busca e contagem.
 *
 * Uma lista vazia significa "todos"; o botao mostra esse estado para o usuario
 * nao ficar sem entender por que nada aparece marcado.
 */
export default function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'Todos',
}: {
  label: string
  options: Option[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  searchPlaceholder?: string
  emptyLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const normalized = term.trim().toLowerCase()
  const visible = normalized === '' ? options : options.filter((option) => option.label.toLowerCase().includes(normalized))

  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? `1 selecionado`)
        : `${selected.length} selecionados`

  return (
    <div className="multi-select" ref={containerRef}>
      <button
        type="button"
        className={`multi-select__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="multi-select__label">{label}</span>
        <span className="multi-select__summary" title={summary}>
          {summary}
        </span>
        <span className="multi-select__chevron" aria-hidden="true">
          ⌄
        </span>
      </button>

      {open && (
        <div className="multi-select__panel" id={panelId}>
          <input
            className="multi-select__search"
            type="search"
            value={term}
            placeholder={searchPlaceholder}
            onChange={(event) => setTerm(event.target.value)}
            autoFocus
          />

          {options.length > selected.length && (
            <button type="button" className="multi-select__clear" onClick={onClear}>
              Limpar selecao
            </button>
          )}

          <ul className="multi-select__list">
            {visible.length === 0 && (
              <li className="multi-select__empty">Nada encontrado para "{term}".</li>
            )}
            {visible.map((option) => {
              const isSelected = selected.includes(option.value)
              return (
                <li key={option.value}>
                  <label className="multi-select__option">
                    <input type="checkbox" checked={isSelected} onChange={() => onToggle(option.value)} />
                    <span className="multi-select__option-label">{option.label}</span>
                    {option.hint && <span className="multi-select__option-hint">{option.hint}</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}