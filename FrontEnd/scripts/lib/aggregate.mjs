/**
 * Agregadores usados tanto na conversao CSV -> JSON quanto nos testes.
 *
 * Ficam em um modulo proprio para que os testes importem exatamente a mesma
 * logica que roda na geracao dos dados, sem duplicar regra de negocio.
 */

/** Remove acentos, caixa e pontuacao, virando um slug estavel. */
export function toSlug(value) {
  if (value === null || value === undefined) return null
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Media simples, ignorando ausencias. Devolve `null` sem amostras. */
export function mean(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (usable.length === 0) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

/** Mediana, usada como referencia nas regras de anomalia. */
export function median(values) {
  const usable = values.filter((value) => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
  if (usable.length === 0) return null
  const middle = Math.floor(usable.length / 2)
  return usable.length % 2 === 0 ? (usable[middle - 1] + usable[middle]) / 2 : usable[middle]
}

/** Contagem por chave, preservando a ordem de insercao. */
export function countBy(items, keyOf) {
  const counts = new Map()
  for (const item of items) {
    const key = keyOf(item)
    if (key === null || key === undefined) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Soma de numeros por chave. */
export function sumBy(items, keyOf, valueOf) {
  const sums = new Map()
  for (const item of items) {
    const key = keyOf(item)
    const value = valueOf(item)
    if (key === null || key === undefined || typeof value !== 'number') continue
    sums.set(key, (sums.get(key) ?? 0) + value)
  }
  return sums
}

/**
 * Media ponderada. Usada para percentual de dose aplicada: o peso de cada
 * trecho e a area efectivamente coberta, nunca a quantidade de linhas.
 */
export function weightedMean(items, valueOf, weightOf) {
  let weightedSum = 0
  let totalWeight = 0
  for (const item of items) {
    const value = valueOf(item)
    const weight = weightOf(item)
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) continue
    weightedSum += value * weight
    totalWeight += weight
  }
  return totalWeight === 0 ? null : weightedSum / totalWeight
}

/** Minimo, maximo e contagem de ausencias em uma lista ja numerica. */
export function extent(values) {
  let min = null
  let max = null
  let missing = 0
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      missing += 1
      continue
    }
    if (min === null || value < min) min = value
    if (max === null || value > max) max = value
  }
  return { min, max, missing }
}

/** Remove a acao e as reacoes de uma linha para deduplicar sem perder colunas. */
export function withoutRowNumber(row) {
  const { __rowNumber, ...rest } = row
  void __rowNumber
  return rest
}

/**
 * Deduplica preservando a primeira ocorrencia e registrando as linhas
 * repetidas, que entram na lista de descartes com rastreabilidade.
 */
export function dedupeById(rows, idOf, log, dataset, file, reason) {
  const seen = new Map()
  const kept = []
  for (const row of rows) {
    const id = idOf(row)
    if (id === null || id === undefined) {
      log.add(dataset, file, 'registro sem chave, descartado', row.__rowNumber, String(id))
      continue
    }
    if (seen.has(id)) {
      log.add(dataset, file, reason, row.__rowNumber, `id ${id}`)
      continue
    }
    seen.set(id, row)
    kept.push(row)
  }
  return kept
}

/** Todas as chaves de um dia (`aaaa-mm-dd`) presentes nos valores. */
export function daysBetween(isoValues) {
  const days = new Set()
  for (const value of isoValues) {
    if (typeof value !== 'string' || value.length < 10) continue
    days.add(value.slice(0, 10))
  }
  return [...days].sort()
}
