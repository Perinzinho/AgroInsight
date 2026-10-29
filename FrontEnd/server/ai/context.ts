import { evidenceSchema } from '../../src/shared/aiContracts'

// One packer per turn. Totals and samples are unchanged; only repeated metadata
// and facts already present in earlier tool outputs become references.
export function createToolContext() {
  const contexts = new Map<string, string>()
  const facts = new Map<string, string>()
  return (output: unknown): string => {
    const addedContexts: unknown[] = []
    function pack(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(pack)
      if (!value || typeof value !== 'object') return value
      return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'effectiveFilters').map(([key, item]) => {
        if (key !== 'evidence' || !Array.isArray(item)) return [key, pack(item)]
        return [key, item.map((entry) => {
          const evidence = evidenceSchema.parse(entry)
          const serialized = JSON.stringify(evidence)
          if (facts.get(evidence.id) === serialized) return { id: evidence.id, previouslyProvided: true }
          facts.set(evidence.id, serialized)
          const { id, label, value, unit, ...metadata } = evidence
          const signature = JSON.stringify(metadata)
          let context = contexts.get(signature)
          if (!context) {
            context = `source-${contexts.size}`
            contexts.set(signature, context)
            addedContexts.push({ id: context, ...metadata })
          }
          return { id, label, value, unit, context }
        })]
      }))
    }
    const data = pack(output)
    return JSON.stringify({ data, ...(addedContexts.length ? { evidenceContexts: addedContexts } : {}) })
  }
}
