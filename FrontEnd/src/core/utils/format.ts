/**
 * Formatacao de numeros e datas em pt-BR.
 *
 * O dataset usa `aaaa-mm-dd` e ISO UTC. O navegador do usuario pode estar em
 * qualquer fuso, entao todas as conversoes de data usam `UTC` explicitamente
 * para nao deslocar o dia da propriedade em maquinas fora de UTC-03.
 */

const DATE = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
const DATE_SHORT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
const DAY_OF_WEEK = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' })
const TIME = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })

/** `2026-02-25` -> `25/02/2026`. Devolve a entrada se nao for uma data valida. */
export function formatDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  return DATE.format(new Date(`${day}T00:00:00Z`))
}

/** `2026-02-25` -> `25/fev`. Para eixos de grafico. */
export function formatDayShort(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  return DATE_SHORT.format(new Date(`${day}T00:00:00Z`))
}

export function formatDayOfWeek(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ''
  return DAY_OF_WEEK.format(new Date(`${day}T12:00:00Z`)).replace('.', '')
}

/** ISO UTC -> `25/02/2026 19:03`, ja no fuso da propriedade (UTC-03). */
export function formatDateTime(isoUtc: string | null | undefined): string {
  if (!isoUtc) return '—'
  const shifted = new Date(new Date(isoUtc).getTime() - 3 * 60 * 60 * 1000)
  if (Number.isNaN(shifted.getTime())) return '—'
  return `${DATE.format(shifted)} ${TIME.format(shifted)}`
}

/** ISO UTC -> `19:03`, no fuso da propriedade. */
export function formatTime(isoUtc: string | null | undefined): string {
  if (!isoUtc) return '—'
  const shifted = new Date(new Date(isoUtc).getTime() - 3 * 60 * 60 * 1000)
  if (Number.isNaN(shifted.getTime())) return '—'
  return TIME.format(shifted)
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`
}

/** Texto de variacao, ou `null` quando nao ha periodo anterior com dado. */
export function formatVariation(percent: number | null): string | null {
  if (percent === null) return null
  const rounded = Math.round(percent)
  if (rounded === 0) return 'estavel'
  return `${rounded > 0 ? '+' : ''}${rounded}% vs. periodo anterior`
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

export function formatArea(hectares: number | null | undefined): string {
  if (hectares === null || hectares === undefined || !Number.isFinite(hectares)) return '—'
  return `${hectares.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const total = Math.round(seconds)
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`
}

/** Intervalo fechado, com sufixo apenas quando o intervalo vale a pena. */
export function formatRange(from: string, to: string): string {
  if (from === to) return formatDay(from)
  const [fromYear, fromMonth, fromDay] = from.split('-')
  const [toYear, toMonth, toDay] = to.split('-')
  if (fromYear === toYear && fromMonth === toMonth) {
    return `${Number(fromDay)} a ${Number(toDay)}/${toMonth}/${toYear}`
  }
  return `${formatDay(from)} a ${formatDay(to)}`
}

/** Quantidade de dias inclusiva no intervalo. */
export function dayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000) + 1
}

/** Lista de dias `aaaa-mm-dd` inclusiva. */
export function daysBetween(from: string, to: string): string[] {
  const total = dayCount(from, to)
  if (total <= 0) return []
  const [year, month, day] = from.split('-').map(Number)
  const start = Date.UTC(year, month - 1, day)
  return Array.from({ length: total }, (_, index) => new Date(start + index * 86_400_000).toISOString().slice(0, 10))
}

/** Nome curto do tipo de armadilha, para caber em marcador de mapa. */
export function trapTypeLabel(type: string | null): string {
  if (!type) return 'Sem tipo'
  return type
    .replace(/^Armadilha\s*/i, '')
    .replace(/^Traps?\s*/i, '')
    .trim() || type
}