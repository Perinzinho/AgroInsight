import type { Dataset, Filters } from '../../src/shared/agroContracts'
import { buildRecommendationAnalysis } from '../../src/feature/recommendations/recommendationMessages'
import { EvidenceRegistry } from '../data/evidenceRegistry'
import { createQueries } from './queries'

type Domain = 'pests' | 'climate' | 'spray' | 'fertilization' | 'machine' | 'quality'
const domainLabels: Record<Domain, string> = { pests: 'Pragas', climate: 'Clima', spray: 'Pulverização', fertilization: 'Fertilização', machine: 'Alertas de máquina', quality: 'Qualidade dos dados' }

export function buildAnalysisContext(data: Dataset, filters: Filters, question: string, overview: boolean, compact = false) {
  const staging = new EvidenceRegistry()
  const queries = createQueries(data, filters, staging)
  const pests = queries.consultarPragas()
  const climate = queries.consultarClima()
  const operations = queries.consultarOperacoes('both')
  const machine = queries.consultarAlertasMaquina()
  const analysis = buildRecommendationAnalysis(data, filters)
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const investigation = overview || /caus|hipotes|investig|recomenda|atencao|prioriz|queda|diminui|reducao|(melhor|aument|perd).{0,30}(safra|produtividade|rendimento)/.test(normalized)
  const domains = new Set<Domain>()
  if (/praga|inset|cigarr|lagart|armadilh|detecc|captur|vaquinha/.test(normalized)) domains.add('pests')
  if (/clima|chuv|chov|hidric|temperatura|seca|agua|evapotranspir|umidade/.test(normalized)) domains.add('climate')
  if (/pulver|pressao|bomba|bico/.test(normalized)) domains.add('spray')
  if (/fertiliz|adub|dose|nutri/.test(normalized)) domains.add('fertilization')
  if (/operac|maquin|frota|alerta|parada|ocios/.test(normalized)) { domains.add('machine'); domains.add('spray'); domains.add('fertilization') }
  if (/qualidade|lacuna|divergen|confiav|cobertura/.test(normalized)) domains.add('quality')
  if (investigation || domains.size === 0) Object.keys(domainLabels).forEach((key) => domains.add(key as Domain))
  const observed: Record<Domain, boolean> = { pests: pests.counts.captures > 0, climate: climate.observations > 0,
    spray: operations.domains.some((d) => d.kind === 'spray' && d.observations > 0),
    fertilization: operations.domains.some((d) => d.kind === 'fertilization' && d.observations > 0),
    machine: machine.observations > 0, quality: data.manifest.warnings.length > 0 || pests.counts.divergentEvents > 0 }
  const climateDays = data.climate.days.filter((day) => day.day >= filters.from && day.day <= filters.to)
  staging.add({ id: 'climate-deficit-days', label: 'Dias com balanço hídrico negativo', value: climateDays.length ? climateDays.filter((d) => d.waterBalance < 0).length : null,
    unit: 'dias', source: data.climate.station.name, href: '#/clima', from: filters.from, to: filters.to, scope: 'Dias observados dentro do intervalo solicitado; não mede estresse da cultura' })
  staging.add({ id: 'quality-warnings', label: 'Avisos no conjunto de dados', value: data.manifest.warnings.length, unit: 'avisos', source: 'manifest.json', href: '#/qualidade', from: filters.from, to: filters.to, scope: 'Conjunto completo, sem filtrar os avisos por período' })
  for (const [key, value] of Object.entries(climate.metrics)) {
    staging.add({ id: `climate-${key}`, label: ({ maxTemperature: 'Temperatura máxima', meanHumidity: 'Umidade média', maxWindGust: 'Rajada máxima', rainyDays: 'Dias com chuva' })[key]!,
      value, unit: climate.units[key as keyof typeof climate.units], source: data.climate.station.name, href: '#/clima', from: filters.from, to: filters.to, scope: 'Leituras disponíveis dentro do período solicitado' })
  }
  const perDomain: Record<Domain, string[]> = {
    pests: ['pests-detections', 'pests-captures', ...pests.evidence.filter((e) => e.id.startsWith('pest-ranking-')).slice(0, compact ? 3 : 5).map((e) => e.id)],
    climate: ['climate-rain', 'climate-et', 'climate-balance', 'climate-days', 'climate-deficit-days', 'climate-temperature', ...Object.keys(climate.metrics).map((key) => `climate-${key}`)],
    spray: ['spray-orders', 'spray-segments', 'spray-zeroPressureSegments', 'spray-missingPressureSegments'],
    fertilization: ['fertilization-orders', 'fertilization-segments', 'fertilization-belowConfiguredSegments'],
    machine: ['machine-count', 'machine-unclassified', 'machine-outside'],
    quality: ['quality-warnings', 'pests-divergent', 'climate-missing'],
  }
  const signals = analysis.recommendations.filter((item) => domains.has(item.id as Domain) && observed[item.id as Domain]).map((item) => ({
    id: item.id, domain: domainLabels[item.id as Domain], priority: item.priority, title: item.title,
    observation: item.id === 'pests' ? `Praga mais detectada: ${pests.byPest.items[0]?.pestName ?? 'nenhuma'} (${pests.byPest.items[0]?.detections ?? 0} detecções). Total no filtro: ${pests.counts.detections} detecções em ${pests.counts.captures} capturas.` : item.evidence,
    verification: item.action, evidenceIds: perDomain[item.id as Domain],
  }))
  const coverage = [
    { domain: 'pests', ...pests.coverage, status: pests.status, observations: pests.observations, daysObserved: pests.daysObserved },
    { domain: 'climate', ...climate.coverage, status: climate.status, observations: climate.observations, daysObserved: climate.daysObserved },
    ...operations.domains.map((d) => ({ domain: d.kind, ...d.coverage, status: d.status, observations: d.observations, daysObserved: d.daysObserved, partialOperations: d.partialOperations })),
    { domain: 'machine', ...machine.coverage, status: machine.status, observations: machine.observations, daysObserved: machine.daysObserved },
  ]
  const registry = new EvidenceRegistry()
  registry.add({ id: 'coverage', label: 'Cobertura dos registros', value: coverage.map((c) => `${c.domain}: ${c.from ?? 'sem data'} a ${c.to ?? 'sem data'}; ${c.observations} registros no filtro`).join(' | '),
    unit: null, source: 'manifest.json e índices locais', href: '#/qualidade', from: filters.from, to: filters.to, scope: 'Datas de cobertura das fontes e registros no intervalo solicitado' })
  const visibleIds = new Set(signals.flatMap((s) => s.evidenceIds))
  if (domains.has('pests') && !compact) pests.evidence.filter((e) => e.id.startsWith('pest-day-')).slice(0, 3).forEach((e) => visibleIds.add(e.id))
  // Focused questions still receive basic facts and coverage from every domain.
  ;(['pests-detections', 'climate-rain', 'climate-balance', 'spray-orders', 'fertilization-orders', 'machine-count'] as const).forEach((id) => visibleIds.add(id))
  const available = new Map(staging.all().map((e) => [e.id, e]))
  for (const id of visibleIds) {
    const evidence = available.get(id)
    if (evidence) registry.add(evidence)
  }
  const evidence = registry.all()
  const sources = [...new Set(evidence.map((e) => e.source))]
  const facts = evidence.filter((e) => e.id !== 'coverage').map((e) => ({ id: e.id, label: e.label, value: e.value, unit: e.unit, source: sources.indexOf(e.source),
    scope: e.scope, from: e.from, to: e.to }))
  const packet = {
    scope: { ...filters, timezone: data.manifest.datasetTimezone, datasetVersion: data.manifest.generatedAt,
      currentLocalDay: new Intl.DateTimeFormat('en-CA', { timeZone: data.manifest.datasetTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) },
    questionFocus: [...domains], investigation,
    availableData: { pestDetections: observed.pests, weather: observed.climate, fertilization: observed.fertilization, spray: observed.spray,
      machineAlerts: observed.machine, yieldMeasurements: false, financialLosses: false, soilMoisture: false, photosAnalyzed: false },
    coverage, sources, facts, signals,
    temporalRelations: operations.domains.map((d) => ({ domain: d.kind, comparedWith: 'pests',
      overlappingCoverage: d.coverage.from && d.coverage.to && pests.coverage.from && pests.coverage.to
        ? d.coverage.from <= pests.coverage.to && pests.coverage.from <= d.coverage.to : null,
      interpretation: 'Sobreposição de cobertura não comprova relação causal. Sem sobreposição não é possível avaliar efeito da operação nas capturas.' })),
    details: compact ? undefined : {
      pestRanking: domains.has('pests') ? pests.byPest.items.slice(0, 5).map(({ pestName, detections, captures }) => ({ pestName, detections, captures })) : undefined,
      dailyThresholds: domains.has('pests') ? pests.dailyThresholds.items.slice(0, 3).map(({ day, trapCode, pestName, detections, culture, thresholdSummary, thresholdsMissing, cultureMismatch, variantsConflicting, note }) =>
        ({ day, trapCode, pestName, detections, culture, thresholdSummary, thresholdsMissing, cultureMismatch, variantsConflicting, note })) : undefined,
      weather: domains.has('climate') ? { ...climate.metrics, units: climate.units, worstBalanceDays: [...climateDays].sort((a, b) => a.waterBalance - b.waterBalance).slice(0, 3).map(({ day, precipitation, evapotranspiration, waterBalance }) => ({ day, precipitation, evapotranspiration, waterBalance })) } : undefined,
      machineTypes: domains.has('machine') ? machine.types.items.slice(0, 3) : undefined,
    },
    cautions: [
      'Cobertura partial significa que há registros em parte do intervalo; não significa ausência de dados.',
      'Os totais das operações são das OS inteiras selecionadas, inclusive trechos fora do filtro.',
      'Os registros de pragas e operações podem ser de épocas diferentes. Não atribua efeito causal sem sobreposição.',
      'Produtividade não medida impede confirmar a causa da queda, mas não impede analisar os sinais disponíveis.',
    ],
  }
  const observedSignals = signals.filter((s) => s.id !== 'quality')
  return { packet, registry, investigation, minimumFindings: investigation ? Math.min(3, observedSignals.length) : domains.size === 1 && observedSignals.length ? 1 : 0 }
}

export type AnalysisContext = ReturnType<typeof buildAnalysisContext>
