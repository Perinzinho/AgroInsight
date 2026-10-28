import { evidenceSchema } from '../../src/shared/aiContracts'
import type { Evidence } from '../../src/shared/aiContracts'
import { invalidResponse } from '../errors'

export class EvidenceRegistry {
  private entries = new Map<string, Evidence>()
  add(evidence: Evidence) {
    this.entries.set(evidence.id, evidenceSchema.parse(evidence))
    return evidence
  }
  resolve(ids: string[]) {
    return [...new Set(ids)].map((id) => {
      const entry = this.entries.get(id)
      if (!entry) throw invalidResponse()
      return entry
    })
  }
  all() { return [...this.entries.values()] }
}
