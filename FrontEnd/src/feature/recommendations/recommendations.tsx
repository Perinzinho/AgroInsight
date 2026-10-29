import { useState } from 'react'
import { useAgro } from '../../data/agroContext'
import { formatDay } from '../../core/utils/format'
import AiConversation from './aiConversation'
import './recommendations.css'

export default function Recommendations() {
  const { data, filters, reload } = useAgro()
  const scope = JSON.stringify([data?.manifest.generatedAt, filters.from, filters.to, [...filters.trapCodes].sort(), [...filters.pestKeys].sort()])
  const [initialScope] = useState(scope)
  if (!data) return null

  return (
    <section className="recommendations" aria-labelledby="recommendations-title">
      <header className="recommendations__heading">
        <h2 id="recommendations-title">Recomendações</h2>
        <p>Recomendações geradas pela IA a partir dos dados de {formatDay(filters.from)} a {formatDay(filters.to)}.</p>
      </header>
      <AiConversation key={scope} filters={filters} datasetVersion={data.manifest.generatedAt} contextChanged={initialScope !== scope} onReload={reload} />
      {(filters.trapCodes.length > 0 || filters.pestKeys.length > 0) && <p className="recommendations__scope">Os filtros de armadilha e praga se aplicam às detecções. Clima e operações seguem o período.</p>}
    </section>
  )
}
