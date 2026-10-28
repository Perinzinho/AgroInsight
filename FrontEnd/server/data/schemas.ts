import { z } from 'zod'
import { daySchema } from '../../src/shared/aiContracts'
import type { Dataset } from '../../src/shared/agroContracts'

const s = z.string()
const n = z.number().finite()
const count = n.int().nonnegative()
const ns = s.nullable()
const nn = n.nullable()
const nb = z.boolean().nullable()
const days = z.array(daySchema)
const range = z.tuple([daySchema, daySchema])
const counts = z.record(s, count)
const strings = z.array(s)
const bounds = z.tuple([n, n, n, n])
const thresholds = z.object({ alert: nn, control: nn, damage: nn })
const operator = z.object({ number: ns, name: ns })
const reasonRef = z.object({ stopReasonId: n, name: s, type: s, productive: z.boolean() })
const snapshot = z.object({
  at: s, day: daySchema, trapId: nn, trapIdInCatalog: z.boolean(), culture: ns,
  pestCountReported: nn, primaryPest: ns, infestationLevel: ns, status: ns, batteryStatus: ns,
  photoProgrammedAt: ns, missions: z.record(s, nn), plotName: ns, farmName: ns, sourceRow: count,
})
export const warningSeveritySchema = z.enum(['info', 'atencao', 'critico', 'attention', 'critical']).transform((value) => {
  if (value === 'attention') return 'atencao' as const
  if (value === 'critical') return 'critico' as const
  return value
})
const manifest = z.object({
  generatedAt: z.iso.datetime(), generator: s, datasetTimezone: z.literal('America/Sao_Paulo'),
  datasetUtcOffset: z.literal('-03:00'), farmReference: z.tuple([n, n]), farmReferenceRadiusMeters: n,
  rules: z.object({ trapIdentity: s, captureSource: s, pestCountReported: s, telemetryExcluded: strings,
    thresholdsSource: s, dayBuckets: s, coordinateOrder: s }),
  sources: z.array(z.object({ file: s, delimiter: s, encoding: s, lineEnding: s, bom: z.boolean(),
    rows: count, columns: strings, bytes: count, modifiedAt: s })),
  outputs: z.array(z.object({ file: s, description: s, source: s, bytes: count, rows: count, lazy: z.boolean() })),
  coverage: z.object({
    traps: z.object({ count, invalidCoordinates: count, readingsFromUnknownTrapId: count }),
    events: z.object({ range, byType: counts, totalCaptures: count, totalDetections: count, divergentFromPestCount: count }),
    climate: z.object({ range, days: count, hours: count }),
    fertilization: z.object({ range, serviceOrders: count }), spray: z.object({ range, serviceOrders: count }),
    machineAlerts: z.object({ range, alerts: count }),
  }),
  discarded: z.array(z.object({ dataset: s, file: s, reason: s, count, examples: strings })),
  warnings: z.array(z.object({ id: s, severity: warningSeveritySchema, title: s, message: s })),
})
const traps = z.object({
  property: z.object({ businessUnit: nn, farm: nn, harvest: ns, timezone: s, utcOffset: s }), bounds,
  traps: z.array(z.object({
    trapCode: s, trapIds: z.array(n), latitude: nn, longitude: nn, type: ns, status: ns, radius: nn, plotId: nn,
    requestGps: nb, photoProgrammedAt: ns, secondPhotoTime: ns, photoWeekdays: strings, installationDate: ns,
    lastAdhesiveFloorReplacement: ns, lastPheromoneExchange: ns,
    sources: z.array(z.object({ file: s, row: count, trapId: nn })), history: z.array(snapshot), latest: snapshot.nullable(),
    cultures: strings, statusesSeen: strings, infestationsSeen: strings, primaryPestsSeen: strings, readingsFromUnknownTrapId: count,
  })),
})
const pests = z.object({ groups: z.array(z.object({
  key: s, popularName: s, scientificNames: strings, detectionNames: strings, classification: ns, cultures: strings,
  hasDocumentation: z.boolean(), hasReferencePhotos: z.boolean(), variants: z.array(z.object({
    pestId: n, popularName: s, scientificName: ns, detectionName: s, classification: ns, culture: s, pheromones: ns,
    thresholds, description: ns, symptoms: ns, intervalDays: z.object({ adhesiveFloor: nn, pheromone: nn }),
    referencePhotoTime: ns, referencePhotos: z.array(z.object({ id: s, url: s })),
  })),
})) })
const series = z.object({ days, rows: z.array(z.object({
  trapCode: s, trapType: ns, day: daySchema, captures: count, detections: count, images: count, pings: count,
  batteryReadings: count, batteryVoltageMean: nn, divergentEvents: count,
  pests: z.array(z.object({ pestKey: s, pestName: s, pestId: nn, captures: count, detections: count, meanConfidence: nn })),
})) })
const events = z.object({ range: days, typeCounts: counts, totalCaptures: count, totalDetections: count, divergentCount: count,
  traps: z.array(z.object({ trapCode: s, file: s, eventCount: count, imageCount: count, telemetryCount: count,
    batteryReadings: count, firstAt: s, lastAt: s, lastCaptureAt: ns })) })
const climate = z.object({ station: z.object({ name: s, latitude: nn, longitude: nn }), range,
  days: z.array(z.object({ day: daySchema, hours: count, precipitation: n, evapotranspiration: n, waterBalance: n,
    temperatureMin: nn, temperatureMean: nn, temperatureMax: nn, humidityMin: nn, humidityMean: nn, humidityMax: nn,
    windMean: nn, windGust: nn, solarRadiation: nn, missingHours: count })) })
const operations = z.object({
  kind: z.enum(['fertilization', 'spray']), source: s, machineColumn: s, operationColumn: s,
  columns: z.object({ area: ns, applied: ns, configured: ns, weight: ns, pressure: ns.optional() }),
  operationSpellings: z.record(s, strings), range: days, sources: strings,
  operations: z.array(z.object({ file: s, serviceOrder: s, operation: s, operationRawSpellings: strings, machine: ns,
    team: ns, operator, firstAt: s, lastAt: s, days, segments: count, reportedAreaHa: nn, geometryAreaHa: nn,
    segmentsWithArea: count, appliedDoseKgHaWeighted: nn, configuredDoseKgHaWeighted: nn, appliedVsConfiguredPct: nn,
    weightKg: nn, zeroDoseSegments: count, belowConfiguredSegments: count, aboveConfiguredSegments: count,
    missingPressureSegments: count, zeroPressureSegments: count, farFromFarmSegments: count, maxDistanceMeters: nn,
    bounds: bounds.nullable() })),
})
const machineAlerts = z.object({ range: days, note: ns, alertTypes: counts, classifications: counts, classificationBasis: counts,
  unclassified: count, outOfProperty: count, alerts: z.array(z.object({
    alertId: s, at: s, day: daySchema, machine: ns, serviceOrder: ns, team: ns, operator, operation: ns,
    operationRaw: ns, alert: ns, value: nn, durationSeconds: nn, stopReasonText: ns, stopReasons: z.array(reasonRef),
    classification: s, classificationBasis: z.enum(['exact-activity-name', 'operation-family']).nullable(),
    classifiedActivity: ns, location: z.object({ longitude: n, latitude: n }), distanceFromFarmMeters: n,
    outOfProperty: z.boolean(), sourceRow: count,
  })) })
const stopReasons = z.object({
  reasons: z.array(z.object({ stopReasonId: n, number: nn, name: s, type: s, productive: z.boolean(),
    considerMachineOff: nb, enabled: nb, color: ns, createdAt: ns, updatedAt: ns })),
  activities: z.array(z.object({ activityId: n, number: nn, name: s, enabled: nb, stopReasonId: nn, stopReasonName: ns,
    stopReasonType: ns, stopReasonProductive: nb })),
  byOperation: z.array(z.object({ operation: s, operationSpellings: strings, reasons: z.array(reasonRef) })),
  operationFamilyMapping: z.array(z.object({ activityName: s, match: s, stopReasons: z.array(reasonRef) })),
})
export const datasetSchema: z.ZodType<Dataset> = z.object({
  manifest, traps, pests, series, events, climate, fertilization: operations, spray: operations, machineAlerts, stopReasons,
})
