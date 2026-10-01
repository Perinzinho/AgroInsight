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
import { DataState } from '../../core/components/ui'
import { formatDateTime } from '../../core/utils/format'
import './shell.css'

export type ViewId =
  | 'visao-geral'
  | 'tendencias'
  | 'mapa'
  | 'armadilha'
  | 'clima'
  | 'pragas'
  | 'comparador'

interface Route {
  view: ViewId
  trapCode: string | null
}

interface View {
  id: ViewId
  label: string
  group: string
  /** Recebe a rota para que a tela de detalhe leia o codigo vindo da URL. */
  render: (route: Route) => ReactNode
}

const VIEWS: View[] = [
  { id: 'visao-geral', label: 'Visao geral', group: 'Monitoramento', render: () => <Overview /> },
  { id: 'tendencias', label: 'Tendencias', group: 'Monitoramento', render: () => <Trends /> },
  { id: 'mapa', label: 'Mapa', group: 'Monitoramento', render: () => <TrapMap /> },
  {
    id: 'armadilha',
    label: 'Detalhe da armadilha',
    group: 'Monitoramento',
    render: (route) => <TrapDetail trapCode={route.trapCode} />,
  },
  { id: 'clima', label: 'Clima', group: 'Ambiente', render: () => <Climate /> },
  { id: 'pragas', label: 'Pragas', group: 'Referencia', render: () => <Pests /> },
  { id: 'comparador', label: 'Comparador', group: 'Referencia', render: () => <Comparator /> },
]

const DEFAULT_VIEW: ViewId = 'visao-geral'

function isViewId(value: string): value is ViewId {
  return VIEWS.some((view) => view.id === value)
}

function readHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [view, trapCode] = raw.split('/')
  return {
    view: view && isViewId(view) ? view : DEFAULT_VIEW,
    trapCode: trapCode || null,
  }
}

export default function Shell() {
  const agro = useAgro()
  const [route, setRoute] = useState(readHash)

  // A URL e a fonte da verdade do roteamento: assim o usuario pode voltar,
  // recarregar e mandar um link direto para uma armadilha.
  useEffect(() => {
    const onHashChange = () => setRoute(readHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (view: ViewId, trapCode?: string) => {
    window.location.hash = trapCode ? `/${view}/${trapCode}` : `/${view}`
  }

  const active = VIEWS.find((view) => view.id === route.view) ?? VIEWS[0]
  const groups = [...new Set(VIEWS.map((view) => view.group))]

  return (
    <div className="shell">
      <header className="shell__topbar">
        <a className="shell__brand" href="#/visao-geral" onClick={() => navigate('visao-geral')}>
          <span className="shell__brand-mark" aria-hidden="true">
            ✳
          </span>
          <span>
            Agro<span>Insight</span>
          </span>
        </a>

        <nav className="shell__nav" aria-label="Navegacao principal">
          {groups.map((group) => (
            <div className="shell__nav-group" key={group}>
              <span className="shell__nav-group-label">{group}</span>
              <div className="shell__nav-items">
                {VIEWS.filter((view) => view.group === group).map((view) => (
                  <a
                    key={view.id}
                    href={`#/${view.id}`}
                    className={`shell__nav-link ${active.id === view.id ? 'is-active' : ''}`}
                    aria-current={active.id === view.id ? 'page' : undefined}
                    onClick={() => navigate(view.id)}
                  >
                    {view.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </header>

      <main className="shell__main">
        {agro.status === 'error' ? (
          <DataState status="error" error={agro.error} onRetry={agro.reload}>
            <></>
          </DataState>
        ) : (
          <>
            <FiltersBar />

            <DataState
              status={agro.status}
              error={agro.error}
              onRetry={agro.reload}
              empty={!agro.data}
              emptyText="Os JSONs nao foram encontrados. Rode npm run data:build."
            >
              {agro.data && (
                <>
                  <p className="shell__provenance">
                    Base gerada em {formatDateTime(agro.data.manifest.generatedAt)} · fuso {agro.data.manifest.datasetUtcOffset} ·
                    limites de praga vindos de pest_list.csv
                  </p>
                  {active.render(route)}
                </>
              )}
            </DataState>
          </>
        )}
      </main>

      <footer className="shell__footer">
        <span>AgroInsight</span>
        <span>
          {agro.data?.traps.property.farm ?? 'Fazenda'} · Safra {agro.data?.traps.property.harvest ?? '—'}
        </span>
      </footer>
    </div>
  )
}
