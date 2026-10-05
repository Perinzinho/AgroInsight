import { useAgro } from '../../data/agroContext'
import { formatDay } from '../../core/utils/format'
import './filtersBar.css'

const PRESETS = [
  { days: 7, label: '7 dias' },
  { days: 14, label: '14 dias' },
  { days: 30, label: '30 dias' },
] as const

export default function FiltersBar() {
  const { data, filters, setPeriod, status } = useAgro()

  if (!data) return null

  const last = data.manifest.coverage.events.range[1]
  const activePreset = PRESETS.find(
    (preset) => filters.to === last && shift(last, -(preset.days - 1)) === filters.from,
  )

  return (
    <div className="filters-bar">
      <div className="filters-bar__intro"><span>JANELA DE ANÁLISE</span><strong>{formatDay(filters.from)} — {formatDay(filters.to)}</strong></div>
      <div className="filters-bar__presets" role="group" aria-label="Atalhos de periodo">
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            className={`chip ${activePreset?.days === preset.days ? 'is-active' : ''}`}
            onClick={() => setPeriod(shift(last, -(preset.days - 1)), last)}
            disabled={status !== 'ready'}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function shift(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10)
}
