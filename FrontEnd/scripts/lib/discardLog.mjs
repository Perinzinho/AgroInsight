/**
 * Registro de tudo que foi descartado, corrigido ou consolidado na conversao.
 *
 * Cada item guarda a origem (arquivo e linha original do CSV) para que a
 * normalizacao seja auditavel, como exige o plano de tarefas.
 */

export class DiscardLog {
  constructor() {
    /** @type {Map<string, {dataset: string, file: string, reason: string, count: number, examples: string[]}>} */
    this.entries = new Map()
  }

  /**
   * @param {string} dataset nome do conjunto de destino
   * @param {string} file arquivo CSV de origem
   * @param {string} reason regra aplicada
   * @param {number|string} sourceRow linha original do CSV (1 = cabecalho + 1)
   * @param {string} [detail] identificador do registro
   */
  add(dataset, file, reason, sourceRow, detail = '') {
    const key = `${dataset}|${reason}`
    const existing = this.entries.get(key)
    if (existing) {
      existing.count += 1
      if (detail && existing.examples.length < 5) existing.examples.push(`linha ${sourceRow}: ${detail}`)
      return
    }
    this.entries.set(key, {
      dataset,
      file,
      reason,
      count: 1,
      examples: detail ? [`linha ${sourceRow}: ${detail}`] : [`linha ${sourceRow}`],
    })
  }

  /** Correcao aplicada sem perda de informacao (nao e descarte). */
  addCorrection(dataset, file, reason, sourceRow, detail = '') {
    this.add(dataset, file, reason, sourceRow, detail)
  }

  toJSON() {
    return [...this.entries.values()].sort((a, b) => b.count - a.count)
  }
}
