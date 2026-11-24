import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Dataset } from '../../src/shared/agroContracts'
import { datasetSchema } from './schemas'
import { PublicError } from '../errors'

const files = {
  manifest: 'manifest.json', traps: 'traps.json', pests: 'pests.json', series: 'trap-series.json',
  events: 'events/index.json', climate: 'climate/daily.json', fertilization: 'operations/fertilization.json',
  spray: 'operations/spray.json', machineAlerts: 'machine-alerts.json', stopReasons: 'stop-reasons.json',
} as const

export function createDatasetStore(directory: string) {
  let snapshot: Dataset | undefined
  let fingerprint = ''
  let pending: Promise<Dataset> | undefined
  async function reload(): Promise<Dataset> {
    try {
      const paths = Object.entries(files).map(([key, file]) => ({ key, path: resolve(directory, file) }))
      const stamp = async () => JSON.stringify(await Promise.all(paths.map(async ({ path }) => {
        const meta = await stat(path)
        return [meta.mtimeMs, meta.size, meta.ctimeMs]
      })))
      const before = await stamp()
      if (snapshot && fingerprint === before) return snapshot
      const entries = await Promise.all(paths.map(async ({ key, path }) => [key, JSON.parse(await readFile(path, 'utf8'))]))
      const loaded = datasetSchema.parse(Object.fromEntries(entries))
      if (before !== await stamp()) throw new Error('Snapshot changed during read')
      // Only publish a complete validated snapshot. Existing in-flight turns keep their previous reference.
      snapshot = loaded
      fingerprint = before
      return loaded
    } catch {
      throw new PublicError('DATA_UNAVAILABLE', 'A base local está indisponível. Gere os dados antes de iniciar a análise.', 503, true)
    }
  }
  return {
    get(): Promise<Dataset> {
      if (!pending) pending = reload().finally(() => { pending = undefined })
      return pending
    },
  }
}
