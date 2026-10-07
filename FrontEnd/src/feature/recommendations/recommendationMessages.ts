import type { Dataset, Filters } from '../../data/agroContext'
import type { MachineOperationSummary } from '../../data/types'
import { climateContext, countSeries, detectionsByPest, filterSeries } from '../../data/selectors'
import { formatDay, formatNumber, formatPercent } from '../../core/utils/format'

export interface Recommendation {
  id: string
  priority: 1 | 2 | 3
  title: string
  evidence: string
  action: string
  source: string
  href: string
}

function operationTotals(operations: MachineOperationSummary[], filters: Filters) {
  // O índice tem totais por OS, não por dia. As datas são locais e podem ser descontínuas.
  const selected = operations.filter((operation) => operation.days.some((day) => day >= filters.from && day <= filters.to))
  return {
    orders: selected.length,
    segments: selected.reduce((sum, operation) => sum + operation.segments, 0),
    below: selected.reduce((sum, operation) => sum + operation.belowConfiguredSegments, 0),
    zeroPressure: selected.reduce((sum, operation) => sum + operation.zeroPressureSegments, 0),
    missingPressure: selected.reduce((sum, operation) => sum + operation.missingPressureSegments, 0),
    partial: selected.some((operation) => operation.days.some((day) => day < filters.from || day > filters.to)),
  }
}

/** Síntese determinística dos arquivos importados, sem sorteio ou diagnóstico causal. */
export function buildRecommendationAnalysis(data: Dataset, filters: Filters) {
  const rows = filterSeries({ rows: data.series.rows, filters })
  const counts = countSeries(rows, filters.pestKeys)
  const topPest = detectionsByPest(rows, filters.pestKeys)[0]
  const climate = climateContext(data.climate.days, filters.from, filters.to)
  const deficitDays = climate.days.filter((day) => day.waterBalance < 0).length
  const fertilization = operationTotals(data.fertilization.operations, filters)
  const spray = operationTotals(data.spray.operations, filters)
  const alerts = data.machineAlerts.alerts.filter((alert) => alert.day >= filters.from && alert.day <= filters.to)
  const unclassified = alerts.filter((alert) => alert.classificationBasis === null).length
  const outside = alerts.filter((alert) => alert.outOfProperty).length
  const topTrap = [...new Set(rows.filter((row) => row.captures > 0).map((row) => row.trapCode))]
    .map((trapCode) => ({ trapCode, ...countSeries(rows.filter((row) => row.trapCode === trapCode), filters.pestKeys) }))
    .sort((a, b) => b.detections - a.detections)[0]
  const hasDetections = counts.detections > 0 && topPest !== undefined
  const pressureIssues = spray.zeroPressure + spray.missingPressure
  const scope = 'Totais completos das ordens de serviço com registros no período.'
  const recommendations: Recommendation[] = [
    {
      id: 'spray', priority: pressureIssues > 0 ? 1 : 3,
      title: pressureIssues > 0 ? 'Validar a medição de pressão da pulverização' : 'Conferir a cobertura da pulverização',
      evidence: spray.orders > 0
        ? `${formatNumber(spray.zeroPressure)} de ${formatNumber(spray.segments)} trechos registram 0 psi; ${formatNumber(spray.missingPressure)} não têm pressão informada. ${scope}`
        : 'Nenhuma ordem de pulverização tem registros no período selecionado.',
      action: pressureIssues > 0
        ? 'Conferir sensor, telemetria e exportação com a medição em campo antes de avaliar a aplicação. O valor zero no arquivo não comprova falha da bomba ou dos bicos.'
        : 'Consulte o período das operações no filtro Total para revisar o histórico de pressão disponível.',
      source: data.spray.source, href: '#/operacoes',
    },
    {
      id: 'fertilization', priority: fertilization.below > 0 ? 1 : 3,
      title: fertilization.below > 0 ? 'Revisar a aplicação abaixo da dose configurada' : 'Conferir os registros de fertilização',
      evidence: fertilization.orders > 0
        ? `${formatNumber(fertilization.below)} de ${formatNumber(fertilization.segments)} trechos ficaram abaixo da dose configurada em ${formatNumber(fertilization.orders)} ordens de serviço. ${scope}`
        : 'Nenhuma ordem de fertilização tem registros no período selecionado.',
      action: fertilization.below > 0
        ? 'Compare dose aplicada e configurada por ordem de serviço e confira a calibração da distribuidora. Valide o registro antes de definir qualquer correção de dose.'
        : 'Abra o histórico completo para comparar as doses registradas com a configuração da máquina.',
      source: data.fertilization.source, href: '#/operacoes',
    },
    {
      id: 'pests', priority: hasDetections ? 2 : 3,
      title: hasDetections ? `Priorizar a inspeção de ${topPest.pestName}` : 'Verificar a cobertura das armadilhas',
      evidence: hasDetections
        ? `${topPest.pestName}: ${formatNumber(topPest.detections)} detecções (${formatPercent(topPest.detections / counts.detections * 100)} do total filtrado).${topTrap ? ` O ponto ${topTrap.trapCode} concentra ${formatNumber(topTrap.detections)} detecções das pragas selecionadas.` : ''}`
        : counts.captures > 0 ? `${formatNumber(counts.captures)} capturas, sem detecções das pragas selecionadas.` : 'Sem capturas nos filtros selecionados.',
      action: hasDetections
        ? 'Revise as imagens e a distribuição por armadilha e dia. Confirme a ocorrência em campo e os limiares da cultura antes de decidir uma intervenção; a soma do período não é um limiar de controle.'
        : 'Confira o período e os filtros de armadilha e praga. A ausência de capturas não confirma ausência de pragas no campo.',
      source: 'traps_events.csv', href: '#/tendencias',
    },
    {
      id: 'climate', priority: deficitDays > 0 ? 2 : 3,
      title: deficitDays > 0 ? 'Acompanhar os dias de balanço hídrico negativo' : 'Planejar as atividades com o histórico climático',
      evidence: climate.days.length > 0
        ? `${formatNumber(climate.totalPrecipitation, 1)} mm de chuva, ${formatNumber(climate.totalEvapotranspiration, 1)} mm de evapotranspiração e saldo de ${formatNumber(climate.waterBalance, 1)} mm. ${formatNumber(deficitDays)} de ${formatNumber(climate.days.length)} dias têm saldo negativo.`
        : 'A série climática não cobre o período selecionado.',
      action: climate.days.length > 0
        ? 'Compare chuva e demanda hídrica dia a dia e confira a umidade do solo em campo. O saldo da estação não mede diretamente o estresse da cultura.'
        : 'Selecione um intervalo com leituras da estação para contextualizar as condições do campo.',
      source: data.climate.station.name || 'Estação meteorológica', href: '#/clima',
    },
    {
      id: 'machine', priority: alerts.length > 0 ? 2 : 3,
      title: alerts.length > 0 ? 'Investigar as ocorrências da frota' : 'Conferir a cobertura dos alertas de máquina',
      evidence: `${formatNumber(alerts.length)} alertas no período; ${formatNumber(unclassified)} sem vínculo de motivo e ${formatNumber(outside)} fora do raio de referência da fazenda.`,
      action: alerts.length > 0
        ? 'Revise tipo, duração e localização junto da ordem de serviço. A contagem de alertas não representa horas de ociosidade e o vínculo por operação não confirma o motivo de parada.'
        : 'Consulte o histórico completo para identificar as datas com ocorrências registradas.',
      source: 'LAYER_MAP_PARAMETERIZED_ALERT.csv', href: '#/alertas-maquina',
    },
    {
      id: 'quality', priority: counts.divergentEvents > 0 || climate.missingHours > 0 ? 2 : 3,
      title: 'Validar a base antes de concluir o impacto na safra',
      evidence: `${formatNumber(counts.divergentEvents)} eventos com contagem divergente no filtro atual; ${formatNumber(climate.missingHours)} horas climáticas ausentes. ${formatNumber(data.manifest.warnings.length)} avisos no conjunto completo.`,
      action: 'Confira as lacunas e alinhe as datas das fontes. Cruze os sinais com produtividade colhida por talhão para investigar o impacto; esses arquivos não trazem produtividade nem perda financeira.',
      source: 'Qualidade dos dados importados', href: '#/qualidade',
    },
  ]
  recommendations.sort((a, b) => a.priority - b.priority)
  const summary: string[] = []
  if (hasDetections) summary.push(`As armadilhas registraram ${formatNumber(counts.detections)} detecções em ${formatNumber(counts.captures)} capturas, com maior participação de ${topPest.pestName} (${formatNumber(topPest.detections)}).`)
  else summary.push(counts.captures > 0 ? 'Há capturas no período, mas nenhuma detecção das pragas selecionadas.' : 'Não há capturas para os filtros selecionados.')
  if (climate.days.length > 0) summary.push(`A estação registrou ${formatNumber(deficitDays)} dias com chuva abaixo da evapotranspiração e balanço acumulado de ${formatNumber(climate.waterBalance, 1)} mm.`)
  else summary.push('Não há leituras climáticas nesse intervalo.')
  if (fertilization.below > 0) summary.push(`Nas ordens de fertilização selecionadas, ${formatNumber(fertilization.below)} trechos ficaram abaixo da dose configurada.`)
  if (pressureIssues > 0) summary.push(`Nas ordens de pulverização selecionadas, ${formatNumber(spray.zeroPressure)} trechos registram pressão zero e ${formatNumber(spray.missingPressure)} não informam pressão; a medição precisa ser validada.`)
  if (fertilization.orders === 0 && spray.orders === 0) summary.push('Não há registros de fertilização ou pulverização nesse período; o histórico operacional pode ser consultado no filtro Total.')
  return {
    summary: summary.join(' '), recommendations,
    partialOperations: fertilization.partial || spray.partial,
    metrics: [
      { id: 'detections', label: 'Detecções de pragas', value: counts.captures > 0 ? formatNumber(counts.detections) : null, note: counts.captures > 0 ? `${formatNumber(counts.captures)} capturas · ${formatNumber(counts.traps)} armadilhas` : 'Sem capturas nos filtros atuais', attention: hasDetections },
      { id: 'water', label: 'Balanço hídrico', value: climate.days.length > 0 ? `${formatNumber(climate.waterBalance, 1)} mm` : null, note: climate.days.length > 0 ? `Chuva − evapotranspiração · ${climate.days.length} dias` : 'Sem leituras no período', attention: climate.waterBalance < 0 },
      { id: 'dose', label: 'Trechos abaixo da dose', value: fertilization.orders > 0 ? formatNumber(fertilization.below) : null, note: fertilization.orders > 0 ? `Total de ${fertilization.orders} OS de fertilização selecionadas` : 'Sem fertilização no período', attention: fertilization.below > 0 },
      { id: 'pressure', label: 'Trechos com pressão zero', value: spray.orders > 0 ? formatNumber(spray.zeroPressure) : null, note: spray.orders > 0 ? `Total de ${spray.orders} OS de pulverização selecionadas` : 'Sem pulverização no período', attention: spray.zeroPressure > 0 },
    ],
    period: `${formatDay(filters.from)} a ${formatDay(filters.to)}`,
  }
}
