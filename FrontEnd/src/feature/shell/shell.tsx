import { useEffect, useRef, useState } from 'react'
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
interface View { id: ViewId; label: string; group: string; description: string; render: (route: Route) => ReactNode }

const VIEWS: View[] = [
  { id: 'visao-geral', label: 'Visão geral', group: 'Monitoramento', description: 'Detecções, clima e operação. Uma visão clara do que acontece na sua propriedade.', render: () => <Overview /> },
  { id: 'tendencias', label: 'Tendências', group: 'Monitoramento', description: 'Acompanhe a evolução das detecções junto às condições do campo.', render: () => <Trends /> },
  { id: 'mapa', label: 'Mapa de armadilhas', group: 'Monitoramento', description: 'Explore a distribuição das armadilhas e dos alertas no território.', render: () => <TrapMap /> },
  { id: 'armadilha', label: 'Armadilhas', group: 'Monitoramento', description: 'Investigue cada ponto de monitoramento com seu histórico e suas espécies.', render: (route) => <TrapDetail trapCode={route.trapCode} /> },
  { id: 'clima', label: 'Clima', group: 'Ambiente', description: 'Chuva, temperatura e balanço hídrico em uma visão do período.', render: () => <Climate /> },
  { id: 'operacoes', label: 'Operações', group: 'Operação', description: 'Ordens de serviço, áreas e doses aplicadas em fertilização e pulverização.', render: () => <Operations /> },
  { id: 'alertas-maquina', label: 'Alertas de máquina', group: 'Operação', description: 'Ocorrências e paradas da frota, organizadas para investigação.', render: () => <Machine /> },
  { id: 'pragas', label: 'Pragas', group: 'Referência', description: 'Consulte o catálogo e os limiares usados na leitura das detecções.', render: () => <Pests /> },
  { id: 'comparador', label: 'Comparador', group: 'Referência', description: 'Coloque pragas lado a lado para encontrar diferenças.', render: () => <Comparator /> },
  { id: 'qualidade', label: 'Qualidade dos dados', group: 'Referência', description: 'Veja a cobertura, as regras e os avisos que sustentam cada análise.', render: () => <DataQuality /> },
  { id: 'recomendacao-ia', label: 'Recomendação (IA)', group: 'Inteligência', description: 'Sugestões para acompanhar o campo a partir dos indicadores das outras telas.', render: () => <Recommendations /> },
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readHash())
      setMenuOpen(false)
      document.getElementById('conteudo')?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [menuOpen])

  const active = VIEWS.find((view) => view.id === route.view) ?? VIEWS[0]
  const groups = [...new Set(VIEWS.map((view) => view.group))]
  const farm = agro.data?.traps.property.farm
  const harvest = agro.data?.traps.property.harvest
  const isOverview = active.id === 'visao-geral'

  return (
    <div className="shell">
      <a className="shell__skip" href="#conteudo" onClick={(event) => { event.preventDefault(); document.getElementById('conteudo')?.focus() }}>Ir para o conteúdo</a>
      <aside className={`shell__sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="shell__brand-row">
          <a className="shell__brand" href="#/visao-geral" aria-label="AgroInsight, visão geral" onClick={() => setMenuOpen(false)}>
            <img src="/favicon.svg" alt="" width="38" height="38" />
            <span className="shell__brand-name">agro<span>insight</span><small>Inteligência de campo</small></span>
          </a>
          <button ref={menuButton} className="shell__menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="navegacao" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>
            <AgroIcon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
        <div className="shell__navigation" id="navegacao">
          <nav className="shell__nav" aria-label="Navegacao principal">
            {groups.map((group) => (
              <div className="shell__nav-group" key={group}>
                <span className="shell__nav-group-label">{group}</span>
                <div className="shell__nav-items">
                  {VIEWS.filter((view) => view.group === group).map((view) => (
                    <a key={view.id} href={`#/${view.id}`} className={`shell__nav-link ${active.id === view.id ? 'is-active' : ''}`} aria-current={active.id === view.id ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                      <AgroIcon name={VIEW_ICONS[view.id]} /><span>{view.label}</span>
                      {active.id === view.id && <AgroIcon name="chevron" className="shell__nav-arrow" width="14" height="14" />}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
        <div className="shell__sidebar-bottom">
          <AgroIcon name="leaf" width="24" height="24" />
          <p>Mais perto do campo.<br /><span>Mais clareza para decidir.</span></p>
          <a href="#/qualidade">Conheça a base de dados <AgroIcon name="arrowUpRight" width="14" height="14" /></a>
        </div>
      </aside>

      <div className="shell__content">
        <header className="shell__topbar">
          <div className="shell__topbar-location"><span className="shell__location-icon"><AgroIcon name="map" /></span><div><small>Propriedade</small><strong>{farm != null ? `Fazenda ${farm}` : 'AgroInsight'}</strong></div></div>
          <div className="shell__topbar-right">
            {harvest && <span className="shell__harvest"><AgroIcon name="leaf" width="16" height="16" /> Safra {harvest}</span>}
            <a className="shell__help" href="#/qualidade" aria-label="Sobre os dados" title="Sobre os dados"><AgroIcon name="info" /></a>
          </div>
        </header>
        <main className="shell__main" id="conteudo" tabIndex={-1}>
          <div className="shell__breadcrumb"><span>{active.group}</span><AgroIcon name="chevron" width="12" height="12" /><span aria-current="location">{active.label}</span></div>
          <header className={`shell__page-heading ${isOverview ? 'shell__page-heading--field' : ''}`}>
            {isOverview && <img className="shell__field-photo" src="/images/campo.jpg" alt="" fetchPriority="high" />}
            <div className="shell__heading-copy">
              <h1>{isOverview ? 'O campo, de perto.' : active.label}</h1>
              <p className="shell__description">{active.description}</p>
              {isOverview && <a href="#/mapa" className="shell__field-action">Explorar armadilhas <AgroIcon name="arrowUpRight" width="17" height="17" /></a>}
            </div>
            {isOverview && <span className="shell__photo-caption">Paisagem ilustrativa</span>}
          </header>
          {agro.status === 'error' ? (
            <DataState status="error" error={agro.error} onRetry={agro.reload}><></></DataState>
          ) : (
            <>
              {active.id !== 'operacoes' && <FiltersBar />}
              <DataState status={agro.status} error={agro.error} onRetry={agro.reload} empty={!agro.data} emptyText="Os dados da propriedade ainda não estão disponíveis.">
                {agro.data && <>
                  <div className="shell__view" key={`${active.id}/${route.trapCode ?? ''}`}>{active.render(route)}</div>
                  <p className="shell__provenance"><AgroIcon name="quality" width="15" height="15" /><span>Base atualizada em {formatDateTime(agro.data.manifest.generatedAt)}. Fuso {agro.data.manifest.datasetUtcOffset}.</span><a href="#/qualidade">Sobre os dados <AgroIcon name="arrowUpRight" width="13" height="13" /></a></p>
                </>}
              </DataState>
            </>
          )}
        </main>
        <footer className="shell__footer"><strong>agro<span>insight</span></strong><span>Um olhar atento à sua propriedade.</span></footer>
      </div>
    </div>
  )
}
