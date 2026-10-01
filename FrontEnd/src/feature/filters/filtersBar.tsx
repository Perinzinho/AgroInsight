import { useAgro } from '../../data/agroContext'
import { detectionsByPest, filterSeries } from '../../data/selectors'
import MultiSelect from '../../core/components/multiSelect'
import type { Option } from '../../core/components/multiSelect'
import { dayCount, formatRange } from '../../core/utils/format'
import './filtersBar.css'

/** Atalhos de periodo. O ultimo cobre todo o intervalo com dado. */
const PRESETS = [
  { days: 7, label: '7 dias' },
  { days: 14, label: '14 dias' },
  { days: 30, label: '30 dias' },
] as const

export default function FiltersBar({
  hideEntityFilters = false,
  hideCustomDates = false,
}: {
  hideEntityFilters?: boolean
  hideCustomDates?: boolean
}) {
  const { data, filters, availableRange, setPeriod, toggleTrap, togglePest, resetFilters, isFiltered, status } = useAgro()

  if (!data) return null

  const selectedDays = dayCount(filters.from, filters.to)

  const trapOptions: Option[] = data.traps.traps.map((trap) => ({
    value: trap.trapCode,
    label: trap.trapCode,
    hint: trap.type ? undefined : 'sem tipo no cadastro',
  }))

  const pestTotals = new Map(
    detectionsByPest(filterSeries({ rows: data.series.rows, filters })).map((pest) => [pest.pestKey, pest.detections]),
  )
  const pestOptions: Option[] = data.pests.groups
    .filter((group) => (pestTotals.get(group.key) ?? 0) > 0)
    .map((group) => ({
      value: group.key,
      label: group.popularName,
      hint: `${pestTotals.get(group.key) ?? 0}`,
    }))

  const applyPreset = (days: number) => {
    const last = data.manifest.coverage.events.range[1]
    setPeriod(shift(last, -(days - 1)), last)
  }

  const applyAll = () => setPeriod(availableRange.from, availableRange.to)

  const activePreset = PRESETS.find((preset) => {
    const last = data.manifest.coverage.events.range[1]
    return filters.to === last && shift(last, -(preset.days - 1)) === filters.from
  })

  return (
    <div className="filters-bar">
      <div className="filters-bar__group filters-bar__group--period">
        <div className="filters-bar__presets" role="group" aria-label="Atalhos de periodo">
          {PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              className={`chip ${activePreset?.days === preset.days ? 'is-active' : ''}`}
              onClick={() => applyPreset(preset.days)}
              disabled={status !== 'ready'}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className={`chip ${activePreset === undefined && filters.from === availableRange.from ? 'is-active' : ''}`}
            onClick={applyAll}
            disabled={status !== 'ready'}
          >
            Tudo
          </button>
        </div>

        {!hideCustomDates && (
          <div className="filters-bar__dates">
          <label>
            <span>De</span>
            <input
              type="date"
              value={filters.from}
              min={availableRange.from}
              max={filters.to}
              onChange={(event) => setPeriod(event.target.value, filters.to)}
            />
          </label>
          <label>
            <span>Ate</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from}
              max={availableRange.to}
              onChange={(event) => setPeriod(filters.from, event.target.value)}
            />
          </label>
          </div>
        )}

        <p className="filters-bar__summary">
          {formatRange(filters.from, filters.to)} <span>· {selectedDays} dia(s)</span>
          {selectedDays === 0 && <span className="filters-bar__warning"> intervalo sem dado</span>}
        </p>
      </div>

      {!hideEntityFilters && (
        <div className="filters-bar__group filters-bar__group--selects">
        <MultiSelect
          label="Armadilha"
          options={trapOptions}
          selected={filters.trapCodes}
          onToggle={toggleTrap}
          onClear={() => {
            filters.trapCodes.forEach(toggleTrap)
          }}
          emptyLabel={`Todas (${trapOptions.length})`}
          searchPlaceholder="Buscar armadilha..."
        />
        <MultiSelect
          label="Praga"
          options={pestOptions}
          selected={filters.pestKeys}
          onToggle={togglePest}
          onClear={() => {
            filters.pestKeys.forEach(togglePest)
          }}
          emptyLabel={pestOptions.length === 0 ? 'Nenhuma no periodo' : `Todas (${pestOptions.length})`}
          searchPlaceholder="Buscar praga..."
        />
        </div>
      )}

      {isFiltered && !hideEntityFilters && (
        <button type="button" className="chip chip--clear" onClick={resetFilters}>
          Limpar filtros
        </button>
      )}
    </div>
  )
}

function shift(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10)
}
