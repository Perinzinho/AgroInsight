/**
 * Contratos dos JSONs gerados por `npm run data:build`.
 *
 * Este arquivo e a fronteira entre o conversor CSV -> JSON e a interface. Se
 * um campo mudar em `scripts/convertCsvToJson.mjs`, mude aqui junto: o
 * compilador passa a apontar todos os consumidores afetados.
 *
 * Convencoes validas para todo o contrato:
 * - `at` e sempre instante ISO em UTC (`...Z`); a data local da fazenda e UTC-03.
 * - `day` e sempre chave `aaaa-mm-dd` ja no fuso da propriedade.
 * - `null` significa "o arquivo de origem nao traz esse dado". A interface deve
 *   exibir a ausencia explicitamente, nunca um zero nem uma estimativa.
 */

/* ------------------------------------------------------------------ */
/* Manifesto e qualidade                                              */
/* ------------------------------------------------------------------ */

export type WarningSeverity = 'info' | 'atencao' | 'critico'

export interface SourceFile {
  file: string
  delimiter: string
  encoding: string
  lineEnding: string
  bom: boolean
  rows: number
  columns: string[]
  bytes: number
  modifiedAt: string
}

export interface OutputFile {
  file: string
  description: string
  source: string
  bytes: number
  rows: number
  /** `true` quando o arquivo so e buscado quando a feature que o usa abre. */
  lazy: boolean
}

export interface DiscardGroup {
  dataset: string
  file: string
  reason: string
  count: number
  examples: string[]
}

export interface DataWarning {
  id: string
  severity: WarningSeverity
  title: string
  message: string
}

export interface Manifest {
  generatedAt: string
  generator: string
  datasetTimezone: string
  datasetUtcOffset: string
  /** `[longitude, latitude]` de referencia da fazenda. */
  farmReference: [number, number]
  farmReferenceRadiusMeters: number
  rules: {
    trapIdentity: string
    captureSource: string
    pestCountReported: string
    telemetryExcluded: string[]
    thresholdsSource: string
    dayBuckets: string
    coordinateOrder: string
  }
  sources: SourceFile[]
  outputs: OutputFile[]
  coverage: {
    traps: { count: number; invalidCoordinates: number; readingsFromUnknownTrapId: number }
    events: {
      range: [string, string]
      byType: Record<string, number>
      totalCaptures: number
      totalDetections: number
      divergentFromPestCount: number
    }
    climate: { range: [string, string]; days: number; hours: number }
    fertilization: { range: [string, string]; serviceOrders: number }
    spray: { range: [string, string]; serviceOrders: number }
    machineAlerts: { range: [string, string]; alerts: number }
  }
  discarded: DiscardGroup[]
  warnings: DataWarning[]
}

/* ------------------------------------------------------------------ */
/* Armadilhas                                                         */
/* ------------------------------------------------------------------ */

/** Leitura da armadilha (telemetria periodica) vinda de `traps_data.csv`. */
export interface TrapSnapshot {
  at: string
  day: string
  trapId: number | null
  /** `false` quando o `trapId` da leitura nao existe em `traps_list.csv`. */
  trapIdInCatalog: boolean
  culture: string | null
  pestCountReported: number | null
  primaryPest: string | null
  infestationLevel: string | null
  status: string | null
  batteryStatus: string | null
  photoProgrammedAt: string | null
  missions: Record<string, string>
  plotName: string | null
  farmName: string | null
  sourceRow: number
}

export interface TrapSourceRef {
  file: string
  row: number
  trapId: number | null
}

export interface Trap {
  /** Chave primaria da armadilha. */
  trapCode: string
  /** Um mesmo `trapCode` pode ter mais de um `trapId` historico. */
  trapIds: number[]
  latitude: number | null
  longitude: number | null
  type: string | null
  status: string | null
  radius: number | null
  plotId: number | null
  requestGps: boolean | null
  photoProgrammedAt: string | null
  secondPhotoTime: string | null
  photoWeekdays: string[]
  installationDate: string | null
  lastAdhesiveFloorReplacement: string | null
  lastPheromoneExchange: string | null
  sources: TrapSourceRef[]
  history: TrapSnapshot[]
  latest: TrapSnapshot | null
  cultures: string[]
  statusesSeen: string[]
  infestationsSeen: string[]
  primaryPestsSeen: string[]
  readingsFromUnknownTrapId: number
}

export interface TrapsPayload {
  property: {
    businessUnit: number | null
    farm: number | null
    harvest: string | null
    timezone: string
    utcOffset: string
  }
  /** `[minLon, minLat, maxLon, maxLat]`. */
  bounds: [number, number, number, number]
  traps: Trap[]
}

/* ------------------------------------------------------------------ */
/* Catalogo de pragas                                                */
/* ------------------------------------------------------------------ */

/** Limiares por praga e cultura, vindos de `pest_list.csv`. */
export interface PestThresholds {
  /** Acima disso ha indicacao de alerta. */
  alert: number | null
  /** Acima disso o alerta vira intervencao. */
  control: number | null
  /** Referencia de dano mentioned em campo. */
  damage: number | null
}

export interface PestInterval {
  adhesiveFloor: number | null
  pheromone: number | null
}

export interface ReferencePhoto {
  id: string
  url: string
}

export interface PestVariant {
  pestId: number
  popularName: string
  scientificName: string | null
  detectionName: string
  classification: string | null
  culture: string
  pheromones: string | null
  thresholds: PestThresholds
  description: string | null
  symptoms: string | null
  intervalDays: PestInterval
  referencePhotoTime: string | null
  referencePhotos: ReferencePhoto[]
}

export interface PestGroup {
  /** Chave estavel usada nas deteccoes, independente da cultura. */
  key: string
  popularName: string
  scientificNames: string[]
  detectionNames: string[]
  classification: string | null
  cultures: string[]
  hasDocumentation: boolean
  hasReferencePhotos: boolean
  variants: PestVariant[]
}

export interface PestsPayload {
  groups: PestGroup[]
}

/* ------------------------------------------------------------------ */
/* Serie diaria de deteccao                                          */
/* ------------------------------------------------------------------ */

export interface SeriesPest {
  pestKey: string
  pestName: string
  pestId: number | null
  captures: number
  detections: number
  meanConfidence: number | null
}

export interface TrapSeriesRow {
  trapCode: string
  trapType: string | null
  day: string
  captures: number
  detections: number
  images: number
  pings: number
  batteryReadings: number
  batteryVoltageMean: number | null
  divergentEvents: number
  pests: SeriesPest[]
}

export interface TrapSeriesPayload {
  days: string[]
  rows: TrapSeriesRow[]
}

/* ------------------------------------------------------------------ */
/* Eventos e capturas                                                */
/* ------------------------------------------------------------------ */

/** Caixa delimitadora em pixels: `[x, y, largura, altura]`. */
export type DetectionBox = [x: number, y: number, width: number, height: number]

export interface EventDetection {
  pestKey: string
  pestName: string
  pestId: number | null
  detections: number
  meanConfidence: number | null
  minConfidence: number | null
  boxes: DetectionBox[]
}

export type EventType = 'IMAGE' | 'PING' | 'CLIENT_BATTERY_VOLTAGE' | string

/** `match` = igual ao `pestCount`; os demais valores explicam a divergencia. */
export type CountAgreement = 'match' | 'detections-higher' | 'reported-higher' | 'only-reported'

export interface TrapEvent {
  eventId: number | null
  sessionId: number | null
  trapCode: string
  trapId: number | null
  at: string
  day: string
  type: EventType
  imageUrl: string | null
  /** Texto bruto do modelo, como `"44 Spodoptera spp.,"`. */
  summary: string | null
  detections: EventDetection[]
  detectedTotal: number
  pestCountReported: number | null
  countAgreement: CountAgreement
  batteryVoltage: number | null
  sourceRow: number
}

export interface TrapEventsPayload {
  trapCode: string
  eventCount: number
  events: TrapEvent[]
}

export interface EventsIndexEntry {
  trapCode: string
  file: string
  eventCount: number
  imageCount: number
  telemetryCount: number
  batteryReadings: number
  firstAt: string
  lastAt: string
  lastCaptureAt: string | null
}

export interface EventsIndex {
  range: [string, string]
  typeCounts: Record<string, number>
  totalCaptures: number
  totalDetections: number
  divergentCount: number
  traps: EventsIndexEntry[]
}

/* ------------------------------------------------------------------ */
/* Clima                                                             */
/* ------------------------------------------------------------------ */

export interface ClimateStation {
  name: string
  latitude: number | null
  longitude: number | null
}

export interface ClimateDay {
  day: string
  hours: number
  precipitation: number
  evapotranspiration: number
  /** `precipitation - evapotranspiration`; positivo = chuva acima da demanda. */
  waterBalance: number
  temperatureMin: number | null
  temperatureMean: number | null
  temperatureMax: number | null
  humidityMin: number | null
  humidityMean: number | null
  humidityMax: number | null
  windMean: number | null
  windGust: number | null
  solarRadiation: number | null
  missingHours: number
}

export interface ClimateHour {
  at: string
  day: string
  precipitation: number
  evapotranspiration: number
  temperatureMin: number | null
  temperatureMean: number | null
  temperatureMax: number | null
  humidityMin: number | null
  humidityMean: number | null
  humidityMax: number | null
  windMean: number | null
  windGust: number | null
  solarRadiation: number | null
  station: string | null
  stationLatitude: number | null
  stationLongitude: number | null
}

export interface ClimateDailyPayload {
  station: ClimateStation
  days: ClimateDay[]
  range: [string, string]
}

export interface ClimateHourlyPayload {
  station: ClimateStation
  hours: ClimateHour[]
  range: [string, string]
}

/* ------------------------------------------------------------------ */
/* Operacoes de maquina                                              */
/* ------------------------------------------------------------------ */

/** `[minLon, minLat, maxLon, maxLat]`. */
export type Bounds = [number, number, number, number]

export interface Operator {
  number: string | null
  name: string | null
}

export interface MachineOperationSummary {
  file: string
  serviceOrder: string
  operation: string
  operationRawSpellings: string[]
  machine: string | null
  team: string | null
  operator: Operator
  firstAt: string
  lastAt: string
  days: string[]
  segments: number
  /** Area somada do arquivo; pode divergir da geometria. */
  reportedAreaHa: number | null
  geometryAreaHa: number | null
  segmentsWithArea: number
  appliedDoseKgHaWeighted: number | null
  configuredDoseKgHaWeighted: number | null
  appliedVsConfiguredPct: number | null
  weightKg: number | null
  zeroDoseSegments: number
  belowConfiguredSegments: number
  aboveConfiguredSegments: number
  missingPressureSegments: number
  zeroPressureSegments: number
  farFromFarmSegments: number
  maxDistanceMeters: number | null
  bounds: Bounds | null
}

export interface OperationsIndexPayload {
  kind: 'fertilization' | 'spray'
  source: string
  machineColumn: string
  operationColumn: string
  columns: {
    area: string | null
    applied: string | null
    configured: string | null
    weight: string | null
    pressure?: string | null
  }
  operationSpellings: Record<string, string[]>
  operations: MachineOperationSummary[]
  range: [string, string]
  sources: string[]
}

/** Um trecho de trabalho: a geometria original e os valores medidos nele. */
export interface OperationSegment {
  at: string
  day: string
  areaHa: number | null
  appliedDoseKgHa: number | null
  configuredDoseKgHa: number | null
  weightKg: number | null
  /** Coluna `Pressure - psi`; `null` quando a coluna nao existe no arquivo. */
  pressurePsi: number | null
  /** Distancia do trecho ate a referencia da fazenda, em metros. */
  distanceMeters: number
  /** `[minLon, minLat, maxLon, maxLat]` do trecho. */
  bbox: Bounds
  sourceRow: number
}

/** Um trecho com a geometria ja convertida, pronta para desenhar no mapa. */
export interface OperationPath {
  at: string
  day: string
  pressure: number | null
  applied: number | null
  configured: number | null
  weight: number | null
  areaHa: number | null
  /** Lista de `[lon, lat]`. Uma `LINESTRING` vira uma linha; poligono, o perimetro. */
  coordinates: [number, number][]
}

export interface OperationDetailPayload {
  kind: 'fertilization' | 'spray'
  source: string
  serviceOrder: string
  operation: string
  days: string[]
  segments: OperationSegment[]
  paths: OperationPath[]
}

/* ------------------------------------------------------------------ */
/* Alertas de maquina e motivos de parada                             */
/* ------------------------------------------------------------------ */

export interface StopReasonRef {
  stopReasonId: number
  name: string
  type: string
  productive: boolean
}

export interface MachineAlert {
  alertId: string
  at: string
  day: string
  machine: string | null
  serviceOrder: string | null
  team: string | null
  operator: Operator
  operation: string | null
  operationRaw: string | null
  alert: string | null
  value: number | null
  durationSeconds: number | null
  stopReasonText: string | null
  stopReasons: StopReasonRef[]
  classification: string
  /** Como o motivo foi ligado: nome exato, familia de operacao ou nada. */
  classificationBasis: 'exact-activity-name' | 'operation-family' | null
  classifiedActivity: string | null
  location: { longitude: number; latitude: number }
  distanceFromFarmMeters: number
  outOfProperty: boolean
  sourceRow: number
}

export interface MachineAlertsPayload {
  range: [string, string]
  note: string | null
  alertTypes: Record<string, number>
  classifications: Record<string, number>
  classificationBasis: Record<string, number>
  unclassified: number
  outOfProperty: number
  alerts: MachineAlert[]
}

export interface StopReason {
  stopReasonId: number
  number: number | null
  name: string
  type: string
  productive: boolean
  considerMachineOff: boolean | null
  enabled: boolean | null
  color: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface StopReasonActivity {
  activityId: number
  number: number | null
  name: string
  enabled: boolean | null
  stopReasonId: number | null
  stopReasonName: string | null
  stopReasonType: string | null
  stopReasonProductive: boolean | null
}

export interface StopReasonsByOperation {
  operation: string
  operationSpellings: string[]
  reasons: StopReasonRef[]
}

export interface OperationFamilyRule {
  activityName: string
  /** Expressao regular aplicada sobre o nome cru da operacao. */
  match: string
  stopReasons: StopReasonRef[]
}

export interface StopReasonsPayload {
  reasons: StopReason[]
  activities: StopReasonActivity[]
  byOperation: StopReasonsByOperation[]
  operationFamilyMapping: OperationFamilyRule[]
}