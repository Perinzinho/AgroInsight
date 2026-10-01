import type { ReactNode } from 'react'
import './ui.css'

/** Valor ausente no arquivo de origem. Nunca substituir por zero. */
export const MISSING = '—'

export function Card({
  title,
  subtitle,
  actions,
  children,
  tone = 'default',
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  tone?: 'default' | 'quiet'
}) {
  return (
    <section className={`card ${tone === 'quiet' ? 'card--quiet' : ''}`}>
      {(title || actions) && (
        <header className="card__head">
          <div>
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  note,
  delta,
  tone = 'neutral',
}: {
  label: string
  /** `null` quando o arquivo de origem nao traz o dado. */
  value: string | null
  note: string
  delta?: string | null
  tone?: 'green' | 'yellow' | 'blue' | 'red' | 'neutral'
}) {
  return (
    <article className={`stat stat--${tone}`}>
      <p className="stat__label">{label}</p>
      <strong className="stat__value">{value ?? MISSING}</strong>
      <small className="stat__note">{value === null ? note : delta ? `${note} · ${delta}` : note}</small>
    </article>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: 'green' | 'yellow' | 'blue' | 'red' | 'neutral'
  title?: string
}) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  )
}

/**
 * Faixa que explica uma limitacao do dado. Usada toda vez que a interface
 * mostra uma ausencia, um valor zerado de origem ou um vinculo deduzido, para
 * que a causa fique visivel junto do numero.
 */
export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'atencao' | 'critico'
  title: string
  children?: ReactNode
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'critico' ? 'alert' : undefined}>
      <strong className="notice__title">{title}</strong>
      {children && <p className="notice__text">{children}</p>}
    </div>
  )
}

export function DataState({
  status,
  error,
  empty,
  emptyText,
  onRetry,
  children,
}: {
  status: 'loading' | 'ready' | 'error'
  error?: string | null
  empty?: boolean
  emptyText?: string
  onRetry?: () => void
  children: ReactNode
}) {
  if (status === 'error') {
    return (
      <Notice tone="critico" title="Nao foi possivel carregar os dados">
        {error ?? 'Erro desconhecido.'} Verifique se `npm run data:build` foi executado.
        {onRetry && (
          <>
            {' '}
            <button className="link-button" type="button" onClick={onRetry}>
              Tentar de novo
            </button>
          </>
        )}
      </Notice>
    )
  }

  if (status === 'loading') {
    return (
      <div className="data-state" role="status">
        <span className="data-state__spinner" aria-hidden="true" />
        Carregando dados...
      </div>
    )
  }

  if (empty) {
    return (
      <Notice tone="info" title="Sem dado no periodo selecionado">
        {emptyText ?? 'Nenhum registro no intervalo e nos filtros atuais.'}
      </Notice>
    )
  }

  return <>{children}</>
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="empty-hint">{children}</p>
}

/** Troca de visao dentro de um cartao, sem sair da tela. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label?: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__item ${option.value === value ? 'is-active' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}