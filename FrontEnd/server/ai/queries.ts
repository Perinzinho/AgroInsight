import type { Dataset, Filters } from '../../src/shared/agroContracts'
import type { Evidence } from '../../src/shared/aiContracts'
import { climateContext, countSeries, dailySeries, detectionsByPest, filterSeries, previousPeriod, resolveCulture, sumPestDetections, trapRanking, variation } from '../../src/data/selectors'
import { evaluatePestDay } from '../../src/data/alertRules'
import { EvidenceRegistry } from '../data/evidenceRegistry'

const inPeriod = (day: string, f: Filters) => day >= f.from && day <= f.to
const list = <T,>(items: T[]) => ({ items: items.slice(0, 10), total: items.length, truncated: items.length > 10 })
const limits = {
  pests: 'Ausência de captura não comprova ausência de praga. Contagem oficial: caixas detectadas; telemetria e pestCountReported não entram. Limiares são diários, por praga e cultura; soma do período não é limiar de controle. Fotos não foram analisadas.',
  climate: 'Histórico da estação, sem previsão futura, medição de umidade do solo ou diagnóstico de estresse da cultura.',
  operations: 'Totais completos das OS com registros no período. Dias podem ser descontínuos. Sem apuração de trechos por dia. Doses ponderadas mantidas por OS; áreas reportadas e geométricas são medidas distintas. Pressão zero exige validar sensor, telemetria e exportação; não comprova falha mecânica ou aplicação inadequada.',
  machine: 'Vínculos entre operação, atividade e motivo são organizacionais, sem causa confirmada. Contagens não representam horas ociosas; durações ausentes ou sobrepostas impedem essa inferência. O raio de referência não é divisa legal.',
}

export function createQueries(data: Dataset, filters: Filters, registry: EvidenceRegistry) {
  const rows = filterSeries({ rows: data.series.rows, filters })
  const counts = countSeries(rows, filters.pestKeys)
  const climate = climateContext(data.climate.days, filters.from, filters.to)
  const expectedDays = Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / 86400000) + 1
  function coverage(allDays: string[], observedDays: string[], observations: number, scope: string) {
    const sorted = [...new Set(allDays)].sort()
    const first = sorted[0] ?? null
    const last = sorted.at(-1) ?? null
    const covered = sorted.filter((day) => inPeriod(day, filters))
    const intersects = first !== null && last !== null && first <= filters.to && last >= filters.from
    const daysObserved = new Set(observedDays).size
    return {
      status: !intersects ? 'no_coverage' : observations === 0 ? 'no_records' : daysObserved < expectedDays ? 'partial' : 'available',
      effectiveFilters: filters, scope, observations, daysObserved, expectedDays,
      coverage: { from: first, to: last, sourceDaysInPeriod: covered.length },
    }
  }
  function fact(id: string, label: string, value: Evidence['value'], unit: string | null, source: string, href: Evidence['href'], scope = 'Período selecionado', from = filters.from, to = filters.to) {
    return registry.add({ id, label, value, unit, source, href, from, to, scope })
  }
  function consultarClima() {
    const present = climate.days.length > 0
    const evidence = [
      fact('climate-rain', 'Chuva acumulada', present ? climate.totalPrecipitation : null, 'mm', data.climate.station.name, '#/clima'),
      fact('climate-et', 'Evapotranspiração acumulada', present ? climate.totalEvapotranspiration : null, 'mm', data.climate.station.name, '#/clima'),
      fact('climate-balance', 'Balanço hídrico', present ? climate.waterBalance : null, 'mm', data.climate.station.name, '#/clima'),
      fact('climate-temperature', 'Temperatura média', climate.meanTemperature, '°C', data.climate.station.name, '#/clima'),
      fact('climate-missing', 'Horas climáticas ausentes nos dias observados', present ? climate.missingHours : null, 'horas', data.climate.station.name, '#/clima'),
      fact('climate-days', 'Dias com leituras', climate.days.length, 'dias', data.climate.station.name, '#/clima'),
    ]
    return { ...coverage(data.climate.days.map((d) => d.day), climate.days.map((d) => d.day), climate.days.reduce((s, d) => s + d.hours, 0), 'Clima segue somente o período'),
      metrics: { maxTemperature: climate.maxTemperature, meanHumidity: climate.meanHumidity, maxWindGust: climate.maxWindGust, rainyDays: present ? climate.rainyDays : null },
      units: { maxTemperature: '°C', meanHumidity: '%', maxWindGust: 'unidade da estação', rainyDays: 'dias' },
      evidence, limitations: [limits.climate] }
  }
  function consultarPragas() {
    const byPest = detectionsByPest(rows, filters.pestKeys)
    const previous = previousPeriod(filters.from, filters.to)
    const previousRows = filterSeries({ rows: data.series.rows, filters: { ...filters, ...previous } })
    const previousCounts = countSeries(previousRows, filters.pestKeys)
    const rankingRows = rows.map((row) => ({ ...row, detections: sumPestDetections(row.pests, filters.pestKeys),
      pests: row.pests.filter((pest) => filters.pestKeys.length === 0 || filters.pestKeys.includes(pest.pestKey)) }))
    const ranking = trapRanking(rankingRows, data.pests.groups, resolveCulture(data.traps.traps, filters.trapCodes))
      .map(({ trapCode, detections, captures, topPest }) => ({ trapCode, detections, captures, topPest }))
    const daily = dailySeries(rows, [...new Set(rows.map((row) => row.day))].sort(), filters.pestKeys)
    const statuses = rows.flatMap((row) => row.pests
      .filter((pest) => filters.pestKeys.length === 0 || filters.pestKeys.includes(pest.pestKey))
      .map((pest) => ({ trapCode: row.trapCode, ...evaluatePestDay({ ...pest, day: row.day,
        group: data.pests.groups.find((group) => group.key === pest.pestKey),
        trapCulture: resolveCulture(data.traps.traps.filter((trap) => trap.trapCode === row.trapCode), []),
      }) })))
      .sort((a, b) => b.detections - a.detections)
    const evidence = [
      fact('pests-detections', 'Caixas detectadas das pragas selecionadas', counts.captures > 0 ? counts.detections : null, 'detecções', 'traps_events.csv', '#/tendencias'),
      fact('pests-captures', 'Capturas nos filtros selecionados', counts.captures, 'capturas', 'traps_events.csv', '#/tendencias'),
      fact('pests-divergent', 'Eventos com contagem divergente', counts.divergentEvents, 'eventos', 'traps_events.csv', '#/qualidade'),
      ...byPest.slice(0, 10).map((pest, i) => fact(`pest-ranking-${i}`, pest.pestName, pest.detections, 'detecções', 'traps_events.csv', '#/tendencias')),
      ...statuses.slice(0, 10).map((status, i) => fact(`pest-day-${i}`, `${status.pestName} — ${status.trapCode}`, `${status.detections} detecções; ${status.thresholdSummary ?? 'Sem limiar'}; ${status.note}`, null,
        'traps_events.csv; pest_list.csv', '#/pragas', 'Dia e armadilha; variante e limitações preservadas', status.day, status.day)),
    ]
    return { ...coverage(data.series.rows.filter((r) => r.captures > 0).map((r) => r.day), rows.map((r) => r.day), counts.captures, 'Detecções seguem período, armadilhas e pragas'),
      counts, byPest: list(byPest.map(({ pestKey, pestName, detections, captures, meanConfidence }) => ({ pestKey, pestName, detections, captures, meanConfidence }))),
      ranking: list(ranking), daily: list(daily), dailyThresholds: list(statuses),
      variation: variation(counts.detections, previousCounts.detections, previousCounts.captures > 0), previousPeriod: previous,
      units: { detections: 'caixas', captures: 'capturas', percent: '%' }, evidence, limitations: [limits.pests] }
  }
  function consultarOperacoes(kind: 'fertilization' | 'spray' | 'both') {
    const domains = kind === 'both' ? ['fertilization', 'spray'] as const : [kind]
    return {
      effectiveFilters: filters, scope: 'Totais completos das OS com registros no período', limitations: [limits.operations],
      domains: domains.map((domain) => {
        const index = data[domain]
        const selected = index.operations.filter((operation) => operation.days.some((day) => inPeriod(day, filters)))
        const partialOperations = selected.some((operation) => operation.days.some((day) => !inPeriod(day, filters)))
        const sum = (key: 'segments' | 'belowConfiguredSegments' | 'zeroPressureSegments' | 'missingPressureSegments') => selected.reduce((total, os) => total + os[key], 0)
        return { kind: domain, ...coverage(index.operations.flatMap((os) => os.days), selected.flatMap((os) => os.days.filter((day) => inPeriod(day, filters))), selected.length, 'Totais completos das OS com registros no período'),
          partialOperations,
          orders: list(selected.map((os) => ({ serviceOrder: os.serviceOrder, operation: os.operation, days: os.days,
            segments: os.segments, reportedAreaHa: os.reportedAreaHa, geometryAreaHa: os.geometryAreaHa,
            appliedDoseKgHaWeighted: os.appliedDoseKgHaWeighted, configuredDoseKgHaWeighted: os.configuredDoseKgHaWeighted,
            zeroPressureSegments: os.zeroPressureSegments, missingPressureSegments: os.missingPressureSegments, belowConfiguredSegments: os.belowConfiguredSegments }))),
          units: { segments: 'trechos', area: 'ha', dose: 'kg/ha', pressure: 'psi' },
          evidence: [
            fact(`${domain}-orders`, `OS de ${domain === 'spray' ? 'pulverização' : 'fertilização'}`, selected.length, 'OS', index.source, '#/operacoes'),
            ...(['segments', 'belowConfiguredSegments', 'zeroPressureSegments', 'missingPressureSegments'] as const).map((key) => fact(`${domain}-${key}`,
              ({ segments: 'Trechos', belowConfiguredSegments: 'Trechos abaixo da dose configurada', zeroPressureSegments: 'Trechos com pressão zero', missingPressureSegments: 'Trechos sem pressão informada' })[key],
              selected.length ? sum(key) : null, 'trechos', index.source, '#/operacoes', 'Totais completos das OS com registros no período',
              selected.length ? selected.flatMap((os) => os.days).sort()[0] : filters.from,
              selected.length ? selected.flatMap((os) => os.days).sort().at(-1)! : filters.to)),
          ] }
      }),
    }
  }
  function consultarAlertasMaquina() {
    const alerts = data.machineAlerts.alerts.filter((alert) => inPeriod(alert.day, filters))
    const by = (key: 'alert' | 'classification' | 'classificationBasis') => {
      const totals = new Map<string, number>()
      for (const alert of alerts) { const value = alert[key] ?? 'Sem classificação'; totals.set(value, (totals.get(value) ?? 0) + 1) }
      return list([...totals].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count))
    }
    return { ...coverage(data.machineAlerts.alerts.map((a) => a.day), alerts.map((a) => a.day), alerts.length, 'Alertas seguem somente o período'),
      types: by('alert'), classifications: by('classification'), classificationBasis: by('classificationBasis'),
      missingDuration: alerts.filter((alert) => alert.durationSeconds === null).length,
      referenceRadiusMeters: data.manifest.farmReferenceRadiusMeters,
      evidence: [
        fact('machine-count', 'Alertas registrados', alerts.length, 'alertas', 'LAYER_MAP_PARAMETERIZED_ALERT.csv', '#/alertas-maquina'),
        fact('machine-unclassified', 'Alertas sem classificação', alerts.filter((a) => a.classificationBasis === null).length, 'alertas', 'LAYER_MAP_PARAMETERIZED_ALERT.csv', '#/alertas-maquina'),
        fact('machine-outside', 'Alertas fora do raio de referência', alerts.filter((a) => a.outOfProperty).length, 'alertas', 'LAYER_MAP_PARAMETERIZED_ALERT.csv', '#/alertas-maquina'),
      ], limitations: [limits.machine] }
  }
  function consultarResumo() {
    // Register only facts actually exposed in this tool output. Hidden detail IDs cannot be cited.
    const summaryQueries = createQueries(data, filters, new EvidenceRegistry())
    const pests = summaryQueries.consultarPragas()
    const weather = summaryQueries.consultarClima()
    const operations = summaryQueries.consultarOperacoes('both')
    const machine = summaryQueries.consultarAlertasMaquina()
    const evidence = [...pests.evidence.filter((e) => !e.id.startsWith('pest-ranking-') && !e.id.startsWith('pest-day-')),
      ...weather.evidence, ...operations.domains.flatMap((d) => d.evidence), ...machine.evidence].map((e) => registry.add(e))
    return {
      effectiveFilters: filters,
      domains: { pests: { status: pests.status, observations: pests.observations, coverage: pests.coverage },
        climate: { status: weather.status, observations: weather.observations, coverage: weather.coverage },
        operations: operations.domains.map(({ kind, status, observations, partialOperations, coverage }) => ({ kind, status, observations, partialOperations, coverage })),
        machine: { status: machine.status, observations: machine.observations, coverage: machine.coverage } },
      evidence,
      limitations: [...Object.values(limits), 'As fontes podem não ter janela comum: confira a cobertura antes de relacionar capturas e aplicações. Sem produtividade, resultado financeiro ou evidência causal.'],
      warnings: list(data.manifest.warnings.map(({ id, severity, title, message }) => ({ id, severity, title, message }))),
    }
  }
  return { consultarResumo, consultarPragas, consultarClima, consultarOperacoes, consultarAlertasMaquina }
}
