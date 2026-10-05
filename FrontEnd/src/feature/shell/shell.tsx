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
import { DataState } from '../../core/components/ui'
import { formatDateTime } from '../../core/utils/format'
import './shell.css'

export type ViewId = 'visao-geral' | 'tendencias' | 'mapa' | 'armadilha' | 'clima' | 'operacoes' | 'alertas-maquina' | 'pragas' | 'comparador' | 'qualidade'

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
  { id: 'comparador', label: 'Comparador', group: 'Referência', number: '09', description: 'Coloque armadilhas e pragas lado a lado para encontrar diferenças.', render: () => <Comparator /> },
  { id: 'qualidade', label: 'Qualidade dos dados', group: 'Referência', number: '10', description: 'Veja a cobertura, as regras e os avisos que sustentam cada análise.', render: () => <DataQuality /> },
]

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
      <aside className="shell__sidebar">
        <a className="shell__brand" href="#/visao-geral" aria-label="AgroInsight, visão geral">
          <span className="shell__brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="shell__brand-name">agro<span>insight</span><small>INTELIGÊNCIA DE CAMPO</small></span>
        </a>
        <div className="shell__sidebar-context">
          <span className="shell__sidebar-context-label">ÁREA DE TRABALHO</span>
          <strong>{farm}</strong>
          <span>{harvest ? `Safra ${harvest}` : 'Monitoramento agrícola'}</span>
        </div>
        <nav className="shell__nav" aria-label="Navegacao principal">
          {groups.map((group) => (
            <div className="shell__nav-group" key={group}>
              <span className="shell__nav-group-label">{group}</span>
              <div className="shell__nav-items">
                {VIEWS.filter((view) => view.group === group).map((view) => (
                  <a key={view.id} href={`#/${view.id}`} className={`shell__nav-link ${active.id === view.id ? 'is-active' : ''}`} aria-current={active.id === view.id ? 'page' : undefined}>
                    <span className="shell__nav-number">{view.number}</span><span>{view.label}</span><span className="shell__nav-arrow" aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="shell__sidebar-bottom"><span className="shell__live-dot" /> Dados de campo em análise</div>
      </aside>

      <div className="shell__content">
        <header className="shell__topbar">
          <span>PAINEL DE MONITORAMENTO <span className="shell__topbar-slash">/</span> {active.label.toUpperCase()}</span>
          <span className="shell__topbar-right">AGROINSIGHT <span className="shell__topbar-slash">·</span> {harvest ? `SAFRA ${harvest}` : 'CAMPO'}</span>
        </header>
        <main className="shell__main">
          <section className={`shell__hero ${active.id === 'visao-geral' ? 'shell__hero--overview' : ''}`}>
            <div className="shell__hero-copy">
              <p className="shell__eyebrow"><span className="shell__eyebrow-line" /> INTELIGÊNCIA PARA DECIDIR <span className="shell__eyebrow-index">/ {active.number}</span></p>
              <h1>{active.label}<span className="shell__hero-period">.</span></h1>
              <p className="shell__hero-description">{active.description}</p>
              <div className="shell__hero-meta"><span className="shell__live-dot" /> {farm} <span className="shell__hero-meta-divider" /> {harvest ? `Safra ${harvest}` : 'Dados de campo'}</div>
            </div>
            <div className="shell__hero-art" aria-hidden="true"><span className="shell__hero-art-label">AGRO / INSIGHT<br />CAMPO EM FOCO</span><span className="shell__hero-art-coordinate">01 — 10</span></div>
          </section>
          {agro.status === 'error' ? (
            <DataState status="error" error={agro.error} onRetry={agro.reload}><></></DataState>
          ) : (
            <>
              <FiltersBar />
              <DataState status={agro.status} error={agro.error} onRetry={agro.reload} empty={!agro.data} emptyText="Os dados ainda não estão disponíveis. Execute npm run data:build.">
                {agro.data && <>
                  {active.render(route)}
                  <p className="shell__provenance">Base atualizada em {formatDateTime(agro.data.manifest.generatedAt)} <span>·</span> Fuso {agro.data.manifest.datasetUtcOffset} <span>·</span> Limiares de pragas: pest_list.csv</p>
                </>}
              </DataState>
            </>
          )}
        </main>
        <footer className="shell__footer"><strong>agro<span>insight</span></strong><span>Dados que aproximam decisões do campo.</span><span>{farm}</span></footer>
      </div>
    </div>
  )
}
