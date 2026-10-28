/**
 * Conversores de tipo compartilhados pela normalizacao dos CSVs.
 *
 * Os CSVs da raiz usam `nan` (string) para ausencia de numero, campo vazio para
 * ausencia de texto e, no relatorio climatico, virgula decimal. Tudo isso e
 * convertido aqui para `null` ou para o tipo correto, com a regra documentada.
 */

/** Remove `nan`, `-`, `NULL` e espacos. Devolve `null` quando nao ha valor. */
export function toNullableString(raw) {
  if (raw === undefined || raw === null) return null
  const value = String(raw).trim()
  if (value === '' || value.toLowerCase() === 'nan' || value === '-') return null
  return value
}

/** Texto sem significado de negocio, preservado como string. */
export function toText(raw) {
  return toNullableString(raw)
}

/**
 * Converte para numero aceitando `1.234,56`, `1,5` e notacao cientifica.
 *
 * O separador decimal e a virgula, como nos CSVs. Quando o valor traz ponto e
 * virgula, o ponto e separador de milhar e vale a virgula como decimal; quando
 * os dois aparecem invertidos, o ponto e o decimal.
 */
export function toNumber(raw) {
  const value = toNullableString(raw)
  if (value === null) return null

  let normalized
  if (value.includes(',') && value.includes('.')) {
    normalized = value.lastIndexOf(',') > value.lastIndexOf('.')
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/,/g, '')
  } else if (value.includes(',')) {
    normalized = value.replace(',', '.')
  } else {
    normalized = value
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** `True`/`False` (Python) e `true`/`false` (JSON) viram booleano. */
export function toBoolean(raw) {
  const value = toNullableString(raw)
  if (value === null) return null
  const lowered = value.toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false
  return null
}

/** `103145.0` -> `103145`; mantem `null` quando ausente. */
export function toInteger(raw) {
  const value = toNumber(raw)
  return value === null ? null : Math.round(value)
}

/** ISO 8601 UTC. O dataset ja vem em UTC (sufixo `Z`). */
export function toIsoUtc(raw) {
  const value = toNullableString(raw)
  if (value === null) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Epoch em segundos (LAYER_MAP_*), convertido para ISO UTC. */
export function fromEpochSeconds(raw) {
  const value = toNumber(raw)
  if (value === null) return null
  return new Date(value * 1000).toISOString()
}

/** `22/08/2025 17:07:43` - data local da fazenda, ja com fuso -03:00. */
export const PROPERTY_TIMEZONE = 'America/Sao_Paulo'
export const PROPERTY_TIMEZONE_OFFSET = '-03:00'

/**
 * `dd/mm/aaaa hh:mm:ss` -> ISO UTC. Assume o fuso da propriedade (-03:00),
 * confirmado ao comparar com a coluna `Timestamp` dos proprios LAYER_MAP.
 */
export function fromBrazilianDateTime(raw) {
  const value = toNullableString(raw)
  if (value === null) return null
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, day, month, year, hour, minute, second] = match
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  return new Date(utcMillis + 3 * 60 * 60 * 1000).toISOString()
}

/** `01/11/2025 - 00:00 / GMT - 03:00` -> ISO UTC (rotulo ja em GMT-03:00). */
export function fromClimateLabel(raw) {
  const value = toNullableString(raw)
  if (value === null) return null
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+-\s+(\d{2}):(\d{2})/)
  if (!match) return null
  const [, day, month, year, hour, minute] = match
  const utcMillis = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  return new Date(utcMillis + 3 * 60 * 60 * 1000).toISOString()
}

/** `HH:mm:ss` -> segundos. */
export function toDurationSeconds(raw) {
  const value = toNullableString(raw)
  if (value === null) return null
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

/** `10:30:00` -> `HH:mm` em ISO. */
export function toClockTime(raw) {
  const value = toNullableString(raw)
  if (value === null) return null
  return value.slice(0, 5)
}

/**
 * Chave de dia local (`aaaa-mm-dd`) a partir de um instante ISO UTC.
 * O dia da fazenda e UTC-03:00, entao o instante e deslocado para menos 3 horas
 * antes de pegar a data. Sem isso, um evento das 22:00 UTC cairia no dia
 * seguinte e a serie diaria.shiftaria.
 */
export function toLocalDayKey(isoUtc) {
  if (isoUtc === null || isoUtc === undefined) return null
  const shifted = new Date(new Date(isoUtc).getTime() - 3 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

/** Instante UTC deslocado para o fuso da fazenda, em ISO. */
export function toPropertyLocalIso(isoUtc) {
  if (isoUtc === null || isoUtc === undefined) return null
  const shifted = new Date(new Date(isoUtc).getTime() - 3 * 60 * 60 * 1000)
  return `${shifted.toISOString().slice(0, 19)}-03:00`
}

/**
 * Remove acentos, caixa e pontuacao para casar nomes de praga escritos de
 * formas diferentes (`Psilideo` vs `Psilídeo`, `Mosca-das-frutos` vs
 * `Mosca das Frutos`). Usado apenas como chave de consolidacao: o nome
 * exibido continua sendo o do catalogo.
 */
export function normalizeKey(raw) {
  const value = toNullableString(raw)
  if (value === null) return null
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
