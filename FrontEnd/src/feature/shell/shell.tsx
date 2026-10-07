import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import FiltersBar from '../filters/filtersBar'
import { useAgro } from '../../data/agroContext'
import Overview from '../overview/overview'
import Trends from '../trends/trends'
import TrapMap from '../trapMap/trapMap'
import TrapDetail from '../trapDetail/trapDetail'
import Climate from '../climate/climate'
import Pests from '../pests/pests'
import Comparator from '../comparator/comparator'
import Operations from '../operations/operations'
import Machine from '../machine/machine'
import DataQuality from '../dataQuality/dataQuality'
import Recommendations from '../recommendations/recommendations'
import { DataState } from '../../core/components/ui'
import { formatDateTime } from '../../core/utils/format'
import AgroIcon, { type AgroIconName } from '../../core/components/agroIcon'
import './shell.css'

export type ViewId = 'visao-geral' | 'tendencias' | 'mapa' | 'armadilha' | 'clima' | 'operacoes' | 'alertas-maquina' | 'pragas' | 'comparador' | 'qualidade' | 'recomendacao-ia'

interface Route { view: ViewId; trapCode: string | null }
interface View { id: ViewId; label: string; group: string; number: string; description: string; render: (route: Route) => ReactNode }

const VIEWS: View[] = [
  { id: 'visao-geral', label: 'Visão geral', group: 'Monitoramento', number: '01', description: 'Os sinais mais importantes da operação, reunidos em uma leitura direta.', render: () => <Overview /> },
  { id: 'tendencias', label: 'Tendências', group: 'Monitoramento', number: '02', description: 'Acompanhe a evolução das detecções junto às condições do campo.', render: () => <Trends /> },
  { id: 'mapa', label: 'Mapa', group: 'Monitoramento', number: '03', description: 'Explore a distribuição das armadilhas e dos alertas no território.', render: () => <TrapMap /> },
  { id: 'armadilha', label: 'Armadilhas', group: 'Monitoramento', number: '04', description: 'Investigue cada ponto de monitoramento com seu histórico e suas espécies.', render: (route) => <TrapDetail trapCode={route.trapCode} /> },
  { id: 'clima', label: 'Clima', group: 'Ambiente', number: '05', description: 'Chuva, temperatura e balanço hídrico em uma visão do período.', render: () => <Climate /> },
  { id: 'operacoes', label: 'Operações', group: 'Operação', number: '06', description: 'Ordens de serviço, áreas e doses aplicadas em fertilização e pulverização.', render: () => <Operations /> },
  { id: 'alertas-maquina', label: 'Alertas de máquina', group: 'Operação', number: '07', description: 'Ocorrências e paradas da frota, organizadas para investigação.', render: () => <Machine /> },
  { id: 'pragas', label: 'Pragas', group: 'Referência', number: '08', description: 'Consulte o catálogo e os limiares usados na leitura das detecções.', render: () => <Pests /> },
  { id: 'comparador', label: 'Comparador', group: 'Referência', number: '09', description: 'Coloque pragas lado a lado para encontrar diferenças.', render: () => <Comparator /> },
  { id: 'qualidade', label: 'Qualidade dos dados', group: 'Referência', number: '10', description: 'Veja a cobertura, as regras e os avisos que sustentam cada análise.', render: () => <DataQuality /> },
  { id: 'recomendacao-ia', label: 'Recomendação (IA)', group: 'Inteligência', number: '11', description: 'Sugestões para acompanhar o campo a partir dos indicadores das outras telas.', render: () => <Recommendations /> },
]

const VIEW_ICONS: Record<ViewId, AgroIconName> = {
  'visao-geral': 'overview', tendencias: 'trends', mapa: 'map', armadilha: 'trap',
  clima: 'climate', operacoes: 'operations', 'alertas-maquina': 'machine',
  pragas: 'pests', comparador: 'compare', qualidade: 'quality', 'recomendacao-ia': 'recommendations',
}

function readHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [view, trapCode] = raw.split('/')
  return { view: VIEWS.some((item) => item.id === view) ? view as ViewId : 'visao-geral', trapCode: trapCode || null }
}

export default function Shell() {
  const agro = useAgro()
  const [route, setRoute] = useState(readHash)
  useEffect(() => {
    const onHashChange = () => setRoute(readHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const active = VIEWS.find((view) => view.id === route.view) ?? VIEWS[0]
  const groups = [...new Set(VIEWS.map((view) => view.group))]
  const farm = agro.data?.traps.property.farm ?? 'Inteligência agrícola'
  const harvest = agro.data?.traps.property.harvest

  return (
    <div className="shell">
      <a className="shell__skip" href="#conteudo" onClick={(event) => { event.preventDefault(); document.getElementById('conteudo')?.focus() }}>Ir para o conteúdo</a>
      <aside className="shell__sidebar">
        <a className="shell__brand" href="#/visao-geral" aria-label="AgroInsight, visão geral">
          <img src="/favicon.svg" alt="" width="36" height="36" />
          <span className="shell__brand-name">agro<span>insight</span></span>
        </a>
        <nav className="shell__nav" aria-label="Navegacao principal">
          {groups.map((group) => (
            <div className="shell__nav-group" key={group}>
              <span className="shell__nav-group-label">{group}</span>
              <div className="shell__nav-items">
                {VIEWS.filter((view) => view.group === group).map((view) => (
                  <a key={view.id} href={`#/${view.id}`} className={`shell__nav-link ${active.id === view.id ? 'is-active' : ''}`} aria-current={active.id === view.id ? 'page' : undefined}>
                    <AgroIcon name={VIEW_ICONS[view.id]} /><span>{view.label}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="shell__sidebar-bottom">AgroInsight<small>Monitoramento agrícola</small></div>
      </aside>

      <div className="shell__content">
        <header className="shell__topbar">
          <span className="shell__topbar-location"><AgroIcon name="map" /> {farm}</span>
          <span className="shell__topbar-right">{harvest ? `Safra ${harvest}` : 'Monitoramento agrícola'}</span>
        </header>
        <main className="shell__main" id="conteudo" tabIndex={-1}>
          <header className="shell__page-heading">
            <p className="shell__section-label">{active.group}</p>
            <h1>{active.label}</h1>
            <p className="shell__description">{active.description}</p>
          </header>
          {agro.status === 'error' ? (
            <DataState status="error" error={agro.error} onRetry={agro.reload}><></></DataState>
          ) : (
            <>
              <FiltersBar />
              <DataState status={agro.status} error={agro.error} onRetry={agro.reload} empty={!agro.data} emptyText="Os dados da propriedade ainda não estão disponíveis.">
                {agro.data && <>
                  {active.render(route)}
                  <p className="shell__provenance">Base atualizada em {formatDateTime(agro.data.manifest.generatedAt)} <span>·</span> Fuso {agro.data.manifest.datasetUtcOffset} <span>·</span> <a href="#/qualidade">Sobre os dados</a></p>
                </>}
              </DataState>
            </>
          )}
        </main>
        <footer className="shell__footer"><strong>agro<span>insight</span></strong><span>Monitoramento da propriedade</span></footer>
      </div>
    </div>
  )
}
