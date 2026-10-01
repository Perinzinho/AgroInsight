/**
 * Geracao dos JSONs de aplicacao a partir dos CSVs da raiz do repositorio.
 *
 * Uso:
 *   node scripts/convertCsvToJson.mjs           gera public/data
 *   node scripts/convertCsvToJson.mjs --check    so valida e imprime o relatorio
 *
 * Decisoes que mudam o resultado e precisam ser conhecidas por quem le:
 * - `trapCode` e a chave da armadilha. `trapId` nao fecha: `traps_data.csv`
 *   referencia 8 ids que nao existem em `traps_list.csv`, todos resolviveis por
 *   `trapCode`, e `traps_list.csv` repete a mesma armadilha fisica com dois ids
 *   diferentes (1135068/1135069 e 1135070/1135075).
 * - A contagem de praga vem da soma das caixas em `detection`, nao de
 *   `pestCount`. `pestCount` discorda das caixas em 56 eventos IMAGE e chega a
 *   zero quando ha deteccao. O valor original segue no JSON como auditoria.
 * - Nenhuma faixa agronomica e inventada. Os limiares vem de
 *   `MIIP_PEST_ALERT` / `MIIP_PEST_CONTROL` / `MIIP_PEST_DAMAGE`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { detectDelimiter, parseCsvRecords, readCsvText } from './lib/readCsv.mjs'
import {
  PROPERTY_TIMEZONE,
  PROPERTY_TIMEZONE_OFFSET,
  fromBrazilianDateTime,
  fromClimateLabel,
  fromEpochSeconds,
  normalizeKey,
  toBoolean,
  toClockTime,
  toDurationSeconds,
  toInteger,
  toIsoUtc,
  toLocalDayKey,
  toNullableString,
  toNumber,
} from './lib/parse.mjs'
import {
  distanceMeters,
  geometryAreaHectares,
  geometryBBox,
  simplifyLine,
  wktToGeoJson,
} from './lib/wkt.mjs'
import {
  countBy,
  daysBetween,
  dedupeById,
  extent,
  mean,
  sumBy,
  toSlug,
  weightedMean,
  withoutRowNumber,
} from './lib/aggregate.mjs'
import { DiscardLog } from './lib/discardLog.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(frontendDir, '..')
const outputDir = path.join(frontendDir, 'public', 'data')

const CHECK_ONLY = process.argv.includes('--check')

/** Uma armadilha a 2 km do centroide da fazenda e considerada do mesmo sitio. */
const FARM_CENTER = [-49.9759, -22.2449]
const FARM_RADIUS_METERS = 2000

const log = new DiscardLog()
const outputs = []

/** Le um CSV da raiz e devolve os registros com o numero da linha preservado. */
function readCsv(fileName) {
  const fullPath = path.join(repoRoot, fileName)
  const raw = fs.readFileSync(fullPath, 'utf8')
  const text = readCsvText(raw)
  const records = parseCsvRecords(text)
  const stats = fs.statSync(fullPath)

  return {
    file: fileName,
    records,
    delimiter: detectDelimiter(text) === ';' ? ';' : ',',
    encoding: 'utf-8',
    lineEnding: raw.includes('\r\n') ? 'CRLF' : 'LF',
    hasBom: raw.charCodeAt(0) === 0xfeff,
    bytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    columns: Object.keys(records[0] ?? {}).filter((column) => column !== '__rowNumber'),
  }
}

function writeJson(relativePath, payload, description, source, extra = {}) {
  const serialized = JSON.stringify(payload)
  outputs.push({
    file: relativePath,
    description,
    source,
    bytes: Buffer.byteLength(serialized),
    rows: extra.rows ?? null,
    lazy: extra.lazy ?? false,
  })
  if (CHECK_ONLY) return
  const target = path.join(outputDir, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, serialized)
}

/** Metadados do CSV de origem, sem os registros: alimenta apenas o manifesto. */
function sourceMeta(source) {
  const { records, ...meta } = source
  void records
  return meta
}

/**
 * Uma colecao de caminhos carregada sob demanda nao deve arrastar os registros
 * do CSV junto. Esta funcao troca `sources` pelos nomes dos arquivos.
 */
function withoutRecords(payload) {
  const { sources, ...rest } = payload
  return {
    ...rest,
    sources: sources.map((source) => (typeof source === 'string' ? source : source.file)),
  }
}

/* ------------------------------------------------------------------ */
/* Catalogo de pragas                                                 */
/* ------------------------------------------------------------------ */

/**
 * `pest_list.csv` e `pest_details.csv` descrevem as mesmas 43 pragas com ids
 * proprios e cultures diferentes (a mesma praga aparece como 16/Milho, 17/Soja e
 * 29/Tomate). Os dois arquivos sao unidos pelo nome popular normalizado e o
 * resultado e agrupado por nome, para que o filtro de cultura escolha a
 * variante correta em vez de somar tres limiares diferentes.
 */
function buildPestCatalog() {
  const listSource = readCsv('pest_list.csv')
  const detailSource = readCsv('pest_details.csv')

  const listRows = dedupeById(
    listSource.records,
    (row) => `${row.MIIP_PEST_ID}|${row.MIIP_PEST_CULTURE}`,
    log,
    'pests',
    'pest_list.csv',
    'linha duplicada por id+cultura',
  )

  const detailRows = dedupeById(
    detailSource.records,
    (row) => row.id,
    log,
    'pests',
    'pest_details.csv',
    'linha duplicada por id',
  )

  const detailsByName = new Map()
  for (const row of detailRows) {
    const key = normalizeKey(row.namePopular)
    if (!detailsByName.has(key)) detailsByName.set(key, [])
    detailsByName.get(key).push(row)
  }

  const variants = []
  const listKeysSeen = new Set()

  for (const row of listRows) {
    const popularName = toNullableString(row.MIIP_PEST_NAME_POPULAR)
    const key = normalizeKey(popularName)
    listKeysSeen.add(key)

    // `pest_details` pode ter varias linhas com o mesmo nome popular (uma por
    // praga com o mesmo nome e culturas diferentes). Casa por popular + cultura.
    const candidates = detailsByName.get(key) ?? []
    const detail =
      candidates.find((candidate) => normalizeKey(candidate.culture) === normalizeKey(row.MIIP_PEST_CULTURE))
      ?? candidates[0]
      ?? null

    if (!detail) {
      log.add('pests', 'pest_list.csv', 'praga sem detalhe em pest_details.csv', row.__rowNumber, popularName)
    }

    const photos = toNullableString(detail?.link_imagem)
      ? toNullableString(detail.link_imagem).split(',').map((url) => url.trim()).filter(Boolean)
      : []
    const photoIds = toNullableString(detail?.id_imagem)
      ? toNullableString(detail.id_imagem).split(',').map((id) => id.trim()).filter(Boolean)
      : []

    if (photos.length !== photoIds.length) {
      log.add('pests', 'pest_details.csv', 'contagem de ids de imagem diferente da contagem de URLs', row.__rowNumber, popularName)
    }

    variants.push({
      pestId: toInteger(row.MIIP_PEST_ID),
      popularName,
      scientificName: toNullableString(row.MIIP_PEST_NAME_SCIENTIFIC),
      detectionName: toNullableString(detail?.detectionName),
      classification: toNullableString(row.MIIP_PEST_CLASSIFICATION) ?? toNullableString(detail?.classification),
      culture: toNullableString(row.MIIP_PEST_CULTURE) ?? toNullableString(detail?.culture),
      pheromones: toNullableString(row.MIIP_PEST_PHEROMONES) ?? toNullableString(detail?.pheromones),
      thresholds: {
        alert: toInteger(row.MIIP_PEST_ALERT),
        control: toInteger(row.MIIP_PEST_CONTROL),
        damage: toInteger(row.MIIP_PEST_DAMAGE),
      },
      description: toNullableString(detail?.dataPest),
      symptoms: toNullableString(detail?.symptoms),
      intervalDays: {
        adhesiveFloor: toInteger(detail?.daysAdhesiveFloor),
        pheromone: toInteger(detail?.daysPheromone),
      },
      referencePhotoTime: toClockTime(detail?.photoTime),
      referencePhotos: photos.map((url, index) => ({ id: photoIds[index] ?? null, url })),
    })
  }

  for (const key of detailsByName.keys()) {
    if (!listKeysSeen.has(key)) {
      log.add('pests', 'pest_details.csv', 'detalhe sem registro correspondente em pest_list.csv', '-', key)
    }
  }

  const groups = new Map()
  for (const variant of variants) {
    const key = toSlug(variant.popularName)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        popularName: variant.popularName,
        scientificNames: [],
        detectionNames: [],
        classification: variant.classification,
        cultures: [],
        variants: [],
      })
    }
    const group = groups.get(key)
    if (variant.scientificName && !group.scientificNames.includes(variant.scientificName)) {
      group.scientificNames.push(variant.scientificName)
    }
    if (variant.detectionName && !group.detectionNames.includes(variant.detectionName)) {
      group.detectionNames.push(variant.detectionName)
    }
    if (variant.culture && !group.cultures.includes(variant.culture)) group.cultures.push(variant.culture)
    group.variants.push(variant)
  }

  // Um mesmo nome popular escrito de formas diferentes (acentos e caixa) vira
  // um grupo so. O nome exibido e o da primeira variacao.
  for (const group of groups.values()) {
    group.variants.sort((a, b) => a.culture.localeCompare(b.culture))
    group.hasDocumentation = group.variants.some((variant) => variant.description || variant.symptoms)
    group.hasReferencePhotos = group.variants.some((variant) => variant.referencePhotos.length > 0)
  }

  const groupsList = [...groups.values()].sort((a, b) => b.variants.length - a.variants.length
    || a.popularName.localeCompare(b.popularName))

  /** Indice nome de deteccao -> grupo, usado para classificar os eventos. */
  const byDetectionName = new Map()
  for (const group of groupsList) {
    for (const name of group.detectionNames) {
      const key = normalizeKey(name)
      if (!key || key === 'sa') continue
      if (!byDetectionName.has(key)) byDetectionName.set(key, group)
    }
  }

  /** Indice nome cientifico -> grupo, para quando o evento nao casa com deteccao. */
  const byScientificName = new Map()
  for (const group of groupsList) {
    for (const name of group.scientificNames) {
      const key = normalizeKey(name)
      if (!key) continue
      if (!byScientificName.has(key)) byScientificName.set(key, group)
    }
  }

  return {
    groups: groupsList,
    byDetectionName,
    byScientificName,
    sources: [listSource, detailSource],
    variantCount: variants.length,
  }
}

/* ------------------------------------------------------------------ */
/* Armadilhas                                                          */
/* ------------------------------------------------------------------ */

/** `traps_list.csv` vem com cada armadilha repetida duas vezes. */
function buildTraps(catalog) {
  const listSource = readCsv('traps_list.csv')
  const dataSource = readCsv('traps_data.csv')

  const uniqueListRows = dedupeById(
    listSource.records,
    (row) => JSON.stringify(withoutRowNumber(row)),
    log,
    'traps',
    'traps_list.csv',
    'armadilha repetida byte a byte',
  )

  const byCode = new Map()
  for (const row of uniqueListRows) {
    const code = toNullableString(row.code)
    if (!code) {
      log.add('traps', 'traps_list.csv', 'armadilha sem trapCode, descartada', row.__rowNumber, String(row.id))
      continue
    }

    const trapId = toInteger(row.id)
    const entry = byCode.get(code) ?? {
      trapCode: code,
      trapIds: [],
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
      type: toNullableString(row.type),
      status: toNullableString(row.status),
      radius: toInteger(row.radius),
      plotId: toInteger(row.plot),
      requestGps: toBoolean(row.requestGPS),
      photoProgrammedAt: toClockTime(row.photoProgrammedAt),
      secondPhotoTime: toClockTime(row.secondPhotoTime),
      photoWeekdays: [],
      installationDate: toIsoUtc(row.installationDate),
      lastAdhesiveFloorReplacement: toIsoUtc(row.lastDateAdhesiveFloorReplacement),
      lastPheromoneExchange: toIsoUtc(row.lastDatePheromoneExchange),
      sources: [],
    }

    if (entry.trapIds.includes(trapId)) continue
    entry.trapIds.push(trapId)
    entry.sources.push({ file: 'traps_list.csv', row: row.__rowNumber, trapId })

    const weekdays = [
      ['mondayPhoto', 'monday'],
      ['tuesdayPhoto', 'tuesday'],
      ['wednesdayPhoto', 'wednesday'],
      ['thursdayPhoto', 'thursday'],
      ['fridayPhoto', 'friday'],
      ['saturdayPhoto', 'saturday'],
      ['sundayPhoto', 'sunday'],
    ]
    for (const [column, day] of weekdays) {
      if (toBoolean(row[column]) === true && !entry.photoWeekdays.includes(day)) entry.photoWeekdays.push(day)
    }

    // Duas linhas com o mesmo codigo e o mesmo ponto sao a mesma armadilha com
    // dois ids no sistema de origem. Divergencias viram aviso, nao adivinhacao.
    for (const field of ['latitude', 'longitude', 'type', 'status', 'plotId']) {
      if (entry[field] !== null && entry[field] !== undefined && row[field] !== undefined) {
        const incoming = field === 'type' || field === 'status'
          ? toNullableString(row[field])
          : field === 'plotId'
            ? toInteger(row.plot)
            : toNumber(row[field])
        if (incoming !== null && incoming !== entry[field]) {
          log.add(
            'traps',
            'traps_list.csv',
            `divergencia em ${field} entre ids do mesmo trapCode, mantido o primeiro`,
            row.__rowNumber,
            `${code} / ${trapId}`,
          )
        }
      }
    }
    byCode.set(code, entry)
  }

  // Historico de `traps_data.csv`, indexado por trapCode.
  const uniqueDataRows = dedupeById(
    dataSource.records,
    (row) => JSON.stringify(withoutRowNumber(row)),
    log,
    'traps',
    'traps_data.csv',
    'leitura repetida byte a byte',
  )

  const snapshotsByCode = new Map()
  for (const row of uniqueDataRows) {
    const code = toNullableString(row.trapCode)
    const trapId = toInteger(row.trapId)
    const at = toIsoUtc(row.createdAt)
    if (!code || !at) {
      log.add('traps', 'traps_data.csv', 'leitura sem trapCode ou sem data, descartada', row.__rowNumber, `${row.trapCode} / ${row.trapId}`)
      continue
    }
    const snapshots = snapshotsByCode.get(code) ?? []
    snapshots.push({
      at,
      day: toLocalDayKey(at),
      trapId,
      // `trap_data.csv` referencia ids que nao estao em `traps_list.csv`. O
      // registro e mantido pelo trapCode e marcado aqui para ficar visivel.
      trapIdInCatalog: false,
      culture: toNullableString(row.culture),
      pestCountReported: toNumber(row.pestCount),
      primaryPest: toNullableString(row.primaryPest),
      infestationLevel: toNullableString(row.trapInfestationLevel),
      status: toNullableString(row.trapStatus),
      batteryStatus: toNullableString(row.trapBatteryStatus),
      photoProgrammedAt: toClockTime(row.photoProgrammedAt),
      missions: {
        done: toInteger(row.doneMissionCount),
        late: toInteger(row.lateMissionCount),
        pending: toInteger(row.pendingMissionCount),
      },
      plotName: toNullableString(row.plotName),
      farmName: toNullableString(row.farmName),
      sourceRow: row.__rowNumber,
    })
    snapshotsByCode.set(code, snapshots)
  }

  const knownCodes = new Set(byCode.keys())
  const orphanSnapshots = []
  for (const [code, snapshots] of snapshotsByCode) {
    if (!knownCodes.has(code)) orphanSnapshots.push({ code, snapshots })
  }

  for (const trap of byCode.values()) {
    const snapshots = (snapshotsByCode.get(trap.trapCode) ?? []).sort((a, b) => a.at.localeCompare(b.at))
    for (const snapshot of snapshots) snapshot.trapIdInCatalog = trap.trapIds.includes(snapshot.trapId)
    trap.history = snapshots
    trap.latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
    trap.cultures = [...new Set(snapshots.map((snapshot) => snapshot.culture).filter(Boolean))]
    trap.statusesSeen = [...new Set(snapshots.map((snapshot) => snapshot.status).filter(Boolean))]
    trap.infestationsSeen = [...new Set(snapshots.map((snapshot) => snapshot.infestationLevel).filter(Boolean))]
    trap.primaryPestsSeen = [...new Set(snapshots.map((snapshot) => snapshot.primaryPest).filter(Boolean))]
    trap.readingsFromUnknownTrapId = snapshots.filter((snapshot) => !snapshot.trapIdInCatalog).length
  }

  const traps = [...byCode.values()].sort((a, b) => a.trapCode.localeCompare(b.trapCode))
  const withCoordinates = traps.filter((trap) => trap.latitude !== null && trap.longitude !== null)
  const invalidCoordinates = traps.filter((trap) => trap.latitude === null || trap.longitude === null)

  const bbox = withCoordinates.length > 0
    ? [
      Math.min(...withCoordinates.map((trap) => trap.longitude)),
      Math.min(...withCoordinates.map((trap) => trap.latitude)),
      Math.max(...withCoordinates.map((trap) => trap.longitude)),
      Math.max(...withCoordinates.map((trap) => trap.latitude)),
    ]
    : null

  return {
    traps,
    bbox,
    invalidCoordinates,
    orphanSnapshots,
    sources: [listSource, dataSource],
  }
}

/* ------------------------------------------------------------------ */
/* Eventos de armadilha                                                */
/* ------------------------------------------------------------------ */

/** `id` sozinho nao identifica o evento: o mesmo id aparece em varias armadilhas. */
function eventKey(row) {
  return `${row.id}|${row.trapId}|${row.type}`
}

function resolveGroup(catalog, detectionName) {
  const key = normalizeKey(detectionName)
  if (!key) return null
  return catalog.byDetectionName.get(key) ?? catalog.byScientificName.get(key) ?? null
}

/** Converte as caixas delimitadoras em `[x, y, largura, altura]` em pixels. */
function toBoxes(rawBoxes) {
  return rawBoxes.map((box) => {
    const xmin = Number(box.xmin)
    const ymin = Number(box.ymin)
    const xmax = Number(box.xmax)
    const ymax = Number(box.ymax)
    return [
      Math.round(xmin),
      Math.round(ymin),
      Math.max(1, Math.round(xmax - xmin)),
      Math.max(1, Math.round(ymax - ymin)),
    ]
  })
}

function buildEvents(catalog, traps) {
  const source = readCsv('traps_events.csv')

  const rows = dedupeById(
    source.records,
    eventKey,
    log,
    'events',
    'traps_events.csv',
    'evento repetido por id+armadilha+tipo',
  )

  const trapCodes = new Set(traps.map((trap) => trap.trapCode))
  const eventsByCode = new Map()
  let discardedUnknownTrap = 0

  for (const row of rows) {
    const trapCode = toNullableString(row.trapCode)
    const at = toIsoUtc(row.createdAt)
    const type = toNullableString(row.type)

    if (!trapCode || !at || !type) {
      log.add('events', 'traps_events.csv', 'evento sem armadilha, data ou tipo, descartado', row.__rowNumber, `${row.id}`)
      continue
    }
    if (!trapCodes.has(trapCode)) {
      discardedUnknownTrap += 1
      log.add('events', 'traps_events.csv', 'trapCode sem cadastro em traps_list.csv, descartado', row.__rowNumber, trapCode)
      continue
    }

    const reportedCount = toNumber(row.pestCount)
    const imageUrl = /^https?:\/\//.test(row.data) ? row.data : null
    const rawDetection = toNullableString(row.detection)

    let summary = null
    let rawBoxes = []
    let detectionUnreadable = false

    if (rawDetection) {
      try {
        const parsed = JSON.parse(rawDetection)
        summary = typeof parsed[0] === 'string' ? parsed[0].trim() : null
        if (typeof parsed[1] === 'string') {
          const boxes = JSON.parse(parsed[1])
          if (Array.isArray(boxes)) rawBoxes = boxes
        }
      } catch {
        detectionUnreadable = true
        log.add('events', 'traps_events.csv', 'campo detection ilegivel, evento mantido sem caixas', row.__rowNumber, `${row.id} / ${trapCode}`)
      }
    }

    const grouped = new Map()
    let unresolved = 0
    for (const box of rawBoxes) {
      const name = toNullableString(box.name)
      const group = resolveGroup(catalog, name)
      if (!group) {
        unresolved += 1
        continue
      }
      const confidence = Number(box.confidence)
      const current = grouped.get(group.key) ?? {
        pestKey: group.key,
        pestName: group.popularName,
        pestId: group.variants.find((variant) => variant.culture === 'Milho')?.pestId ?? group.variants[0].pestId,
        detections: 0,
        confidences: [],
        boxes: [],
      }
      current.detections += 1
      if (Number.isFinite(confidence)) current.confidences.push(confidence)
      current.boxes.push(...toBoxes([box]))
      grouped.set(group.key, current)
    }

    if (rawBoxes.length > 0 && unresolved > 0) {
      log.add('events', 'traps_events.csv', 'deteccao sem praga correspondente no catalogo', row.__rowNumber, `${row.id} / ${trapCode} / ${unresolved} caixa(s)`)
    }

    const detections = [...grouped.values()]
      .map((entry) => ({
        pestKey: entry.pestKey,
        pestName: entry.pestName,
        pestId: entry.pestId,
        detections: entry.detections,
        meanConfidence: mean(entry.confidences),
        minConfidence: entry.confidences.length > 0 ? Math.min(...entry.confidences) : null,
        boxes: entry.boxes,
      }))
      .sort((a, b) => b.detections - a.detections)

    const detectedTotal = detections.reduce((sum, entry) => sum + entry.detections, 0)

    const event = {
      eventId: toInteger(row.id),
      sessionId: toInteger(row.id),
      trapCode,
      trapId: toInteger(row.trapId),
      at,
      day: toLocalDayKey(at),
      type,
      imageUrl,
      summary,
      detections,
      detectedTotal,
      pestCountReported: reportedCount,
      countAgreement: reportedCount === null ? null : reportedCount === detectedTotal ? 'match' : 'divergent',
      batteryVoltage: type === 'CLIENT_BATTERY_VOLTAGE' ? toNumber(row.data) : null,
      sourceRow: row.__rowNumber,
    }

    if (detectionUnreadable) event.detectionUnreadable = true

    const list = eventsByCode.get(trapCode) ?? []
    list.push(event)
    eventsByCode.set(trapCode, list)
  }

  if (discardedUnknownTrap > 0) {
    log.add('events', 'traps_events.csv', 'resumo de eventos sem armadilha conhecida', '-', `${discardedUnknownTrap} evento(s)`)
  }

  for (const [trapCode, list] of eventsByCode) {
    list.sort((a, b) => a.at.localeCompare(b.at))
  }

  const allEvents = [...eventsByCode.values()].flat()
  const typeCounts = countBy(allEvents, (event) => event.type)

  return {
    eventsByCode,
    index: traps.map((trap) => {
      const list = eventsByCode.get(trap.trapCode) ?? []
      const captures = list.filter((event) => event.type === 'IMAGE')
      return {
        trapCode: trap.trapCode,
        file: `${trap.trapCode}.json`,
        eventCount: list.length,
        imageCount: captures.length,
        telemetryCount: list.filter((event) => event.type !== 'IMAGE').length,
        batteryReadings: list.filter((event) => event.type === 'CLIENT_BATTERY_VOLTAGE').length,
        firstAt: list[0]?.at ?? null,
        lastAt: list[list.length - 1]?.at ?? null,
        lastCaptureAt: captures.length > 0 ? captures[captures.length - 1].at : null,
      }
    }),
    typeCounts: Object.fromEntries(typeCounts),
    divergentCount: allEvents.filter((event) => event.countAgreement === 'divergent').length,
    totalCaptures: allEvents.filter((event) => event.type === 'IMAGE').length,
    totalDetections: allEvents.reduce((sum, event) => sum + event.detectedTotal, 0),
    sources: [source],
    range: daysBetween(allEvents.map((event) => event.at)),
  }
}

/**
 * Serie diaria por armadilha. `PING` e `CLIENT_BATTERY_VOLTAGE` ficam fora da
 * contagem de capturas: sao telemetria, nao captura de praga.
 */
function buildTrapSeries(events) {
  const rows = []
  const days = new Set()
  const typeByCode = new Map()

  for (const [trapCode, list] of events.eventsByCode) {
    const byDay = new Map()
    for (const event of list) {
      const day = event.day
      days.add(day)
      const bucket = byDay.get(day) ?? {
        trapCode,
        day,
        captures: 0,
        detections: 0,
        images: 0,
        pings: 0,
        batteryReadings: 0,
        batteryVoltages: [],
        pests: new Map(),
        divergentEvents: 0,
      }

      if (event.type === 'IMAGE') {
        bucket.captures += 1
        bucket.images += 1
        bucket.detections += event.detectedTotal
        if (event.countAgreement === 'divergent') bucket.divergentEvents += 1
        for (const detection of event.detections) {
          const current = bucket.pests.get(detection.pestKey) ?? {
            pestKey: detection.pestKey,
            pestName: detection.pestName,
            pestId: detection.pestId,
            captures: 0,
            detections: 0,
            confidences: [],
          }
          current.captures += 1
          current.detections += detection.detections
          if (detection.meanConfidence !== null) current.confidences.push(detection.meanConfidence)
          bucket.pests.set(detection.pestKey, current)
        }
      } else if (event.type === 'PING') {
        bucket.pings += 1
      } else if (event.type === 'CLIENT_BATTERY_VOLTAGE') {
        bucket.batteryReadings += 1
        if (event.batteryVoltage !== null) bucket.batteryVoltages.push(event.batteryVoltage)
      }
      byDay.set(day, bucket)
    }

    for (const bucket of byDay.values()) {
      rows.push({
        trapCode: bucket.trapCode,
        trapType: typeByCode.get(bucket.trapCode) ?? null,
        day: bucket.day,
        captures: bucket.captures,
        detections: bucket.detections,
        images: bucket.images,
        pings: bucket.pings,
        batteryReadings: bucket.batteryReadings,
        batteryVoltageMean: mean(bucket.batteryVoltages),
        divergentEvents: bucket.divergentEvents,
        pests: [...bucket.pests.values()]
          .map((pest) => ({
            pestKey: pest.pestKey,
            pestName: pest.pestName,
            pestId: pest.pestId,
            captures: pest.captures,
            detections: pest.detections,
            meanConfidence: mean(pest.confidences),
          }))
          .sort((a, b) => b.detections - a.detections),
      })
    }
  }

  rows.sort((a, b) => a.day.localeCompare(b.day) || a.trapCode.localeCompare(b.trapCode))
  return { days: [...days].sort(), rows }
}

/* ------------------------------------------------------------------ */
/* Clima                                                               */
/* ------------------------------------------------------------------ */

function findClimateFile() {
  const candidate = fs.readdirSync(repoRoot).find((name) => name.startsWith('Relat') && name.endsWith('.csv'))
  if (!candidate) throw new Error('Arquivo de relatorio climatico nao encontrado na raiz do repositorio.')
  return candidate
}

function buildClimate() {
  const fileName = findClimateFile()
  const source = readCsv(fileName)
  const dateColumn = Object.keys(source.records[0] ?? {}).find((column) => column.endsWith('Data')) ?? 'Data'

  const rows = []
  for (const row of source.records) {
    const at = fromClimateLabel(row[dateColumn])
    if (!at) {
      log.add('climate', fileName, 'data nao reconhecida, registro descartado', row.__rowNumber, String(row[dateColumn]))
      continue
    }
    rows.push({
      at,
      day: toLocalDayKey(at),
      precipitation: toNumber(row['Precipitação (mm)']),
      evapotranspiration: toNumber(row['Evapotranspiração (mm)']),
      temperatureMin: toNumber(row['Temp. Mínima (°C)']),
      temperatureMean: toNumber(row['Temp. Média (°C)']),
      temperatureMax: toNumber(row['Temp. Máxima (°C)']),
      humidityMin: toNumber(row['Umidade Rel. Mín. (%)']),
      humidityMean: toNumber(row['Umidade Rel. Média (%)']),
      humidityMax: toNumber(row['Umidade Rel. Máxima (%)']),
      windMean: toNumber(row['Vel do Vento Média (km/h)']),
      windGust: toNumber(row['Rajada de Vento (km/h)']),
      solarRadiation: toNumber(row['Radiação Solar (W/m2)']),
      station: toNullableString(row.Estação),
      stationLatitude: toNumber(row.Latitude),
      stationLongitude: toNumber(row.Longitude),
    })
  }

  rows.sort((a, b) => a.at.localeCompare(b.at))

  const byDay = new Map()
  for (const row of rows) {
    const bucket = byDay.get(row.day) ?? { day: row.day, hours: [] }
    bucket.hours.push(row)
    byDay.set(row.day, bucket)
  }

  const days = [...byDay.values()].map((bucket) => {
    const hours = bucket.hours
    const precipitation = sumBy(hours, () => 'total', (hour) => hour.precipitation)?.get('total') ?? 0
    const evapotranspiration = sumBy(hours, () => 'total', (hour) => hour.evapotranspiration)?.get('total') ?? 0
    return {
      day: bucket.day,
      hours: hours.length,
      precipitation: round(precipitation),
      evapotranspiration: round(evapotranspiration),
      waterBalance: round(precipitation - evapotranspiration),
      temperatureMin: round(extent(hours.map((hour) => hour.temperatureMin)).min),
      temperatureMean: round(mean(hours.map((hour) => hour.temperatureMean))),
      temperatureMax: round(extent(hours.map((hour) => hour.temperatureMax)).max),
      humidityMin: round(extent(hours.map((hour) => hour.humidityMin)).min),
      humidityMean: round(mean(hours.map((hour) => hour.humidityMean))),
      humidityMax: round(extent(hours.map((hour) => hour.humidityMax)).max),
      windMean: round(mean(hours.map((hour) => hour.windMean))),
      windGust: round(extent(hours.map((hour) => hour.windGust)).max),
      solarRadiation: round(sumBy(hours, () => 'total', (hour) => hour.solarRadiation)?.get('total') ?? 0),
      missingHours: 24 - hours.length,
    }
  })

  const station = rows[0]
    ? { name: rows[0].station, latitude: rows[0].stationLatitude, longitude: rows[0].stationLongitude }
    : { name: null, latitude: null, longitude: null }

  return {
    station,
    days,
    hourly: rows,
    sources: [source],
    range: days.map((day) => day.day),
  }
}

/* ------------------------------------------------------------------ */
/* Operacoes: fertilizacao e pulverizacao                              */
/* ------------------------------------------------------------------ */

const OPERATION_LABEL_RULES = [
  { match: /^CALAGEM$/i, label: 'Calagem' },
  { match: /^GESSAGEM$/i, label: 'Gessagem' },
  { match: /^PLANTIO MILHO GR[ÃA]O$/i, label: 'Plantio milho grão' },
  { match: /^PLANTIO MILHO SILAGEM$/i, label: 'Plantio milho silagem' },
  { match: /^MEDI[ÇC][ÃA]O DE [ÁA]REA$/i, label: 'Medição de área' },
  { match: /^Plantio$/i, label: 'Plantio' },
  { match: /PULVERIZA[ÇC][ÃA]O GERAL/i, label: 'Pulverização geral' },
  { match: /INSETICIDA \+ FERTILIZANTE FOLIAR/i, label: 'Inseticida + fertilizante foliar' },
  { match: /^ADUBA[ÇC][ÃA]O DE COBERTURA/i, label: 'Adubação de cobertura' },
  { match: /INSETICIDA\+HERBICIDA/i, label: 'Inseticida + herbicida' },
  { match: /COLHEITA SILAGEM/i, label: 'Colheita silagem' },
]

/**
 * `operation` e escrito de formas diferentes entre os arquivos
 * (`PLANTIO MILHO GRÃO` e `Plantio`). A regra abaixo consolida apenas variacoes
 * de escrita do mesmo servico; nao funde servicos diferentes.
 */
function normalizeOperation(raw) {
  const value = toNullableString(raw)
  if (!value) return null
  for (const rule of OPERATION_LABEL_RULES) {
    if (rule.match.test(value)) return { canonical: rule.label, raw: value }
  }
  return { canonical: value.toUpperCase(), raw: value }
}

function buildMachineOperations() {
  const fertilizationSource = readCsv('LAYER_MAP_FERTILIZATION.csv')
  const spraySource = readCsv('LAYER_MAP_SPRAY_PRESSURE.csv')

  const datasets = [
    {
      kind: 'fertilization',
      file: 'LAYER_MAP_FERTILIZATION.csv',
      source: fertilizationSource,
      machineColumn: 'Machine Name',
      operationColumn: 'operation',
      columns: {
        area: 'Area - ha',
        applied: 'AppliedDos - kg/ha',
        configured: 'Configured - kg/ha',
        weight: 'Weight - kg',
      },
      hasGeometryArea: true,
    },
    {
      kind: 'spray',
      file: 'LAYER_MAP_SPRAY_PRESSURE.csv',
      source: spraySource,
      machineColumn: 'MachineName',
      operationColumn: 'Operation',
      columns: {
        area: null,
        applied: null,
        configured: null,
        weight: null,
        pressure: 'Pressure - psi',
      },
      hasGeometryArea: false,
    },
  ]

  const result = {}

  for (const dataset of datasets) {
    const groups = new Map()
    const operationSpellings = new Map()

    for (const row of dataset.source.records) {
      const at = fromEpochSeconds(row.Timestamp)
      const dateTime = fromBrazilianDateTime(row['Date Time'])
      const serviceOrder = toNullableString(row['Service Order'])

      if (!at || !serviceOrder) {
        log.add(dataset.kind, dataset.file, 'linha sem Timestamp ou sem ordem de servico, descartada', row.__rowNumber, `${row['Service Order']}`)
        continue
      }
      if (dateTime && Math.abs(new Date(dateTime).getTime() - new Date(at).getTime()) > 12 * 60 * 60 * 1000) {
        log.add(dataset.kind, dataset.file, 'Timestamp e Date Time divergem acima de 12h, usado Timestamp', row.__rowNumber, serviceOrder)
      }

      const operation = normalizeOperation(row[dataset.operationColumn])
      if (!operation) {
        log.add(dataset.kind, dataset.file, 'linha sem operacao, agrupada como "sem classificacao"', row.__rowNumber, serviceOrder)
      }

      if (operation) {
        const spellings = operationSpellings.get(operation.canonical) ?? new Set()
        spellings.add(operation.raw)
        operationSpellings.set(operation.canonical, spellings)
      }

      const geometry = wktToGeoJson(row.geometry, 6)
      if (!geometry) {
        log.add(dataset.kind, dataset.file, 'geometria WKT invalida, linha sinalizada e descartada', row.__rowNumber, serviceOrder)
        continue
      }

      const bbox = geometryBBox(geometry)
      const lines = geometry.type === 'LineString'
        ? [geometry.coordinates]
        : geometry.type === 'MultiLineString'
          ? geometry.coordinates
          : null

      const groupKey = `${serviceOrder}|${operation?.canonical ?? 'SEM CLASSIFICACAO'}`
      const group = groups.get(groupKey) ?? {
        serviceOrder,
        operation: operation?.canonical ?? 'SEM CLASSIFICACAO',
        operationRawSpellings: new Set(),
        machine: toNullableString(row[dataset.machineColumn]),
        team: toNullableString(row.Team),
        operatorNumber: toNullableString(row['Operator Number']),
        operatorName: toNullableString(row['Operator Name']),
        firstAt: at,
        lastAt: at,
        days: new Set(),
        segments: 0,
        invalidGeometry: 0,
        zeroDose: 0,
        belowConfigured: 0,
        aboveConfigured: 0,
        missingPressure: 0,
        zeroPressure: 0,
        farFromFarm: 0,
        maxDistanceMeters: 0,
        areaHa: 0,
        reportedAreaHa: 0,
        appliedDoseSum: 0,
        configuredDoseSum: 0,
        weightKg: 0,
        geometryAreaHa: 0,
        paths: [],
        segmentsDetail: [],
      }

      if (operation) group.operationRawSpellings.add(operation.raw)
      if (at < group.firstAt) group.firstAt = at
      if (at > group.lastAt) group.lastAt = at
      group.days.add(toLocalDayKey(at))

      const reportedArea = dataset.columns.area ? toNumber(row[dataset.columns.area]) : null
      const applied = dataset.columns.applied ? toNumber(row[dataset.columns.applied]) : null
      const configured = dataset.columns.configured ? toNumber(row[dataset.columns.configured]) : null
      const weight = dataset.columns.weight ? toNumber(row[dataset.columns.weight]) : null
      const pressure = dataset.columns.pressure ? toNumber(row[dataset.columns.pressure]) : null

      const center = centerOf(geometry)
      const distance = center ? distanceMeters(FARM_CENTER, center) : null
      if (distance !== null) {
        group.maxDistanceMeters = Math.max(group.maxDistanceMeters, distance)
        if (distance > FARM_RADIUS_METERS) group.farFromFarm += 1
      }

      group.segments += 1
      if (reportedArea !== null) {
        group.reportedAreaHa += reportedArea
        if (dataset.hasGeometryArea) group.areaHa += geometryAreaHectares(geometry)
      }
      if (applied !== null) {
        group.appliedDoseSum += applied
        if (applied === 0) group.zeroDose += 1
      }
      if (configured !== null) {
        group.configuredDoseSum += configured
        if (applied !== null && configured > 0) {
          const ratio = applied / configured
          if (ratio < 0.95) group.belowConfigured += 1
          if (ratio > 1.05) group.aboveConfigured += 1
        }
      }
      if (weight !== null) group.weightKg += weight

      if (dataset.columns.pressure) {
        if (pressure === null) group.missingPressure += 1
        else if (pressure === 0) group.zeroPressure += 1
      }

      if (lines) {
        for (const line of lines) {
          const simplified = simplifyLine(line, 2)
          group.paths.push({
            at,
            day: toLocalDayKey(at),
            pressure,
            applied,
            configured,
            weight,
            areaHa: reportedArea,
            coordinates: simplified,
          })
        }
      }

      group.segmentsDetail.push({
        at,
        day: toLocalDayKey(at),
        areaHa: reportedArea,
        appliedDoseKgHa: applied,
        configuredDoseKgHa: configured,
        weightKg: weight,
        pressurePsi: pressure,
        distanceMeters: distance === null ? null : Math.round(distance),
        bbox,
        sourceRow: row.__rowNumber,
      })

      groups.set(groupKey, group)
    }

    const operations = [...groups.values()]
      .map((group) => {
        const fileName = `${group.serviceOrder}-${toSlug(group.operation) ?? 'sem-classificacao'}.json`
        const withArea = group.segmentsDetail.filter((segment) => (segment.areaHa ?? 0) > 0)
        const weightedApplied = weightedMean(group.segmentsDetail, (segment) => segment.appliedDoseKgHa, (segment) => segment.areaHa)
        const weightedConfigured = weightedMean(group.segmentsDetail, (segment) => segment.configuredDoseKgHa, (segment) => segment.areaHa)

        return {
          file: fileName,
          serviceOrder: group.serviceOrder,
          operation: group.operation,
          operationRawSpellings: [...group.operationRawSpellings],
          machine: group.machine,
          team: group.team,
          operator: {
            number: group.operatorNumber,
            name: group.operatorName,
          },
          firstAt: group.firstAt,
          lastAt: group.lastAt,
          days: [...group.days].sort(),
          segments: group.segments,
          reportedAreaHa: Number(group.reportedAreaHa.toFixed(4)),
          geometryAreaHa: Number(group.areaHa.toFixed(4)),
          segmentsWithArea: withArea.length,
          appliedDoseKgHaWeighted: weightedApplied === null ? null : Number(weightedApplied.toFixed(1)),
          configuredDoseKgHaWeighted: weightedConfigured === null ? null : Number(weightedConfigured.toFixed(1)),
          appliedVsConfiguredPct: weightedApplied === null || !weightedConfigured
            ? null
            : Number(((weightedApplied / weightedConfigured) * 100).toFixed(1)),
          weightKg: group.weightKg,
          zeroDoseSegments: group.zeroDose,
          belowConfiguredSegments: group.belowConfigured,
          aboveConfiguredSegments: group.aboveConfigured,
          missingPressureSegments: group.missingPressure,
          zeroPressureSegments: group.zeroPressure,
          farFromFarmSegments: group.farFromFarm,
          maxDistanceMeters: Math.round(group.maxDistanceMeters),
          bounds: boundsOf(group.segmentsDetail),
        }
      })
      .sort((a, b) => a.firstAt.localeCompare(b.firstAt) || a.serviceOrder.localeCompare(b.serviceOrder))

    for (const group of groups.values()) {
      const operation = operations.find(
        (candidate) => candidate.serviceOrder === group.serviceOrder
          && candidate.operation === (group.operationRawSpellings.size > 0 ? canonicalOf(operationSpellings, group) : 'SEM CLASSIFICACAO'),
      )
      if (!operation) continue

      writeJson(
        `${dataset.kind}/${operation.file}`,
        {
          kind: dataset.kind,
          source: dataset.file,
          serviceOrder: operation.serviceOrder,
          operation: operation.operation,
          days: operation.days,
          segments: group.segmentsDetail,
          paths: group.paths,
        },
        `Trechos e trajetoria de ${operation.operation} na ordem de servico ${operation.serviceOrder}.`,
        dataset.file,
        { rows: group.segmentsDetail.length, lazy: true },
      )
    }

    result[dataset.kind] = {
      kind: dataset.kind,
      source: dataset.file,
      machineColumn: dataset.machineColumn,
      operationColumn: dataset.operationColumn,
      columns: dataset.columns,
      operationSpellings: Object.fromEntries(
        [...operationSpellings.entries()].map(([canonical, spellings]) => [canonical, [...spellings]]),
      ),
      operations,
      range: daysBetween([...groups.values()].map((group) => group.firstAt)),
      sources: [dataset.source],
    }
  }

  return result
}

function canonicalOf(spellings, group) {
  for (const [canonical, set] of spellings) {
    if ([...set].some((spelling) => group.operationRawSpellings.has(spelling))) return canonical
  }
  return 'SEM CLASSIFICACAO'
}

function centerOf(geometry) {
  const bbox = geometryBBox(geometry)
  if (!bbox) return null
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
}

function boundsOf(segments) {
  const values = segments.filter((segment) => segment.bbox)
  if (values.length === 0) return null
  return [
    Math.min(...values.map((segment) => segment.bbox[0])),
    Math.min(...values.map((segment) => segment.bbox[1])),
    Math.max(...values.map((segment) => segment.bbox[2])),
    Math.max(...values.map((segment) => segment.bbox[3])),
  ]
}

/* ------------------------------------------------------------------ */
/* Alertas de maquina e motivos de parada                              */
/* ------------------------------------------------------------------ */

/**
 * `LAYER_MAP_PARAMETERIZED_ALERT.csv` nao traz o id do motivo de parada, apenas
 * um texto livre que vale "Sem evento" em todos os registros preenchidos. O
 * vinculo com `stop_reasons.csv` e feito pela operacao: `Operation` casa com
 * `agriculturalActivityName`, que por sua vez aponta para um motivo cadastrado.
 * O que nao casa fica marcado como "sem classificacao", nunca inventado.
 */
/**
 * Atividade cadastrada (`agriculturalActivityName`) para cada familia de
 * operacao registrada em `LAYER_MAP_*`.
 *
 * O arquivo de alertas nao traz o id do motivo de parada, so o nome da
 * operacao. Estas regras ligam o nome da operacao a atividade cadastrada em
 * `stop_reasons_activities.csv`. A ligacao e organizacional, nao agronomica:
 * ela diz qual tipo de motivo de parada costuma ser lancado para a atividade,
 * e nao afirma que aquela parada causou o alerta. Todo alerta classificado por
 * aqui guarda `classificationBasis` para que a interface distinga o caso exato
 * do caso derivado, e o que nao casou fica como `SEM CLASSIFICACAO`.
 */
const OPERATION_ACTIVITY_FAMILY = [
  { activityName: 'PLANTIO', match: /PLANTIO|Plantio/i },
  { activityName: 'ADUBAÇÃO', match: /CALAGEM|GESSAGEM|ADUBA[ÇC][ÃA]O/i },
  { activityName: 'PULVERIZAÇÃO', match: /PULVERIZA[ÇC][ÃA]O|INSETICIDA|HERBICIDA|FOLIAR/i },
  { activityName: 'COLHEITA', match: /COLHEITA/i },
  { activityName: 'PREPARO DE SOLO', match: /PREPARO|GRADI[ÇC][ÃA]O/i },
  { activityName: 'SERVIÇOS GERAIS', match: /MEDI[ÇC][ÃA]O|SERVI[ÇC]O/i },
]

function buildStopReasons() {
  const reasonsSource = readCsv('stop_reasons.csv')
  const activitiesSource = readCsv('stop_reasons_activities.csv')

  const activityIdsToStopReason = new Map()
  for (const row of activitiesSource.records) {
    const id = toInteger(row.idAgriculturalActivity)
    const stopReasonId = toInteger(row.idStopReason)
    activityIdsToStopReason.set(id, stopReasonId)
  }

  const reasons = dedupeById(
    reasonsSource.records,
    (row) => toInteger(row.idStopReason),
    log,
    'stopReasons',
    'stop_reasons.csv',
    'motivo repetido por id',
  ).map((row) => ({
    stopReasonId: toInteger(row.idStopReason),
    number: toInteger(row.stopReasonNumber),
    name: toNullableString(row.stopReasonName),
    type: toNullableString(row.stopReasonType),
    productive: toBoolean(row.stopReasonProductive),
    considerMachineOff: toBoolean(row.stopReasonConsiderMachineOff),
    enabled: toBoolean(row.stopReasonEnable),
    color: toNullableString(row.stopReasonColor),
    createdAt: fromEpochSeconds(row.stopReasonCreatedAt),
    updatedAt: fromEpochSeconds(row.stopReasonUpdatedAt),
  }))

  const reasonsById = new Map(reasons.map((reason) => [reason.stopReasonId, reason]))

  const activities = dedupeById(
    activitiesSource.records,
    (row) => toInteger(row.idAgriculturalActivity),
    log,
    'stopReasons',
    'stop_reasons_activities.csv',
    'atividade repetida por id',
  ).map((row) => {
    const activityId = toInteger(row.idAgriculturalActivity)
    const stopReasonId = activityIdsToStopReason.get(activityId) ?? null
    const reason = stopReasonId === null ? null : reasonsById.get(stopReasonId) ?? null
    return {
      activityId,
      number: toInteger(row.agriculturalActivityNumber),
      name: toNullableString(row.agriculturalActivityName),
      enabled: toBoolean(row.agriculturalActivityEnable),
      stopReasonId,
      stopReasonName: reason?.name ?? null,
      stopReasonType: reason?.type ?? null,
      stopReasonProductive: reason?.productive ?? null,
    }
  })

  /** Operacao de maquina -> lista de motivos cadastrados. */
  const reasonsByOperation = new Map()
  for (const activity of activities) {
    const operation = normalizeOperation(activity.name)
    if (!operation) continue
    const entry = reasonsByOperation.get(operation.canonical) ?? {
      operation: operation.canonical,
      operationSpellings: new Set(),
      reasons: [],
    }
    entry.operationSpellings.add(operation.raw)
    if (activity.stopReasonName && !entry.reasons.some((reason) => reason.stopReasonId === activity.stopReasonId)) {
      entry.reasons.push({
        stopReasonId: activity.stopReasonId,
        name: activity.stopReasonName,
        type: activity.stopReasonType,
        productive: activity.stopReasonProductive,
      })
    }
    reasonsByOperation.set(operation.canonical, entry)
  }

  /**
   * Familia de operacao -> motivos cadastrados da atividade correspondente.
   * `exactActivityName` marca quando o proprio nome da atividade aparece dentro
   * do nome da operacao; o resto vem da familia declarada em
   * OPERATION_ACTIVITY_FAMILY e precisa ser validado pela equipe.
   */
  const reasonsByOperationFamily = new Map()
  for (const rule of OPERATION_ACTIVITY_FAMILY) {
    const activity = activities.find((candidate) => candidate.name === rule.activityName)
    if (!activity) {
      log.add('stopReasons', 'stop_reasons_activities.csv', 'atividade da familia de operacao nao cadastrada', '-', rule.activityName)
      continue
    }
    if (!activity.stopReasonName) {
      log.add('stopReasons', 'stop_reasons_activities.csv', 'atividade da familia de operacao sem motivo de parada vinculado', '-', rule.activityName)
      continue
    }
    reasonsByOperationFamily.set(rule.activityName, {
      activityId: activity.activityId,
      activityName: activity.name,
      match: rule.match.source,
      reasons: [{
        stopReasonId: activity.stopReasonId,
        name: activity.stopReasonName,
        type: activity.stopReasonType,
        productive: activity.stopReasonProductive,
      }],
    })
  }

  return {
    reasons,
    activities,
    reasonsByOperation: new Map(
      [...reasonsByOperation.entries()].map(([canonical, entry]) => [
        canonical,
        {
          operation: entry.operation,
          operationSpellings: [...entry.operationSpellings],
          reasons: entry.reasons,
        },
      ]),
    ),
    reasonsByOperationFamily,
    sources: [reasonsSource, activitiesSource],
  }
}

function buildMachineAlerts(stopReasons) {
  const source = readCsv('LAYER_MAP_PARAMETERIZED_ALERT.csv')

  const rows = dedupeById(
    source.records,
    (row) => JSON.stringify(withoutRowNumber(row)),
    log,
    'machineAlerts',
    'LAYER_MAP_PARAMETERIZED_ALERT.csv',
    'alerta repetido byte a byte',
  )

  const alerts = []
  let unreadable = 0

  for (const row of rows) {
    const at = fromEpochSeconds(row.Timestamp)
    if (!at) {
      log.add('machineAlerts', 'LAYER_MAP_PARAMETERIZED_ALERT.csv', 'Timestamp invalido, alerta descartado', row.__rowNumber, String(row.Timestamp))
      continue
    }
    const geometry = wktToGeoJson(row.geometry, 6)
    if (!geometry) {
      unreadable += 1
      log.add('machineAlerts', 'LAYER_MAP_PARAMETERIZED_ALERT.csv', 'POINT invalido, alerta descartado', row.__rowNumber, String(row.geometry))
      continue
    }

    const operation = normalizeOperation(row.Operation)
    const exactMatch = operation ? stopReasons.reasonsByOperation.get(operation.canonical) ?? null : null
    const familyRule = OPERATION_ACTIVITY_FAMILY.find((rule) => rule.match.test(operation?.raw ?? '')) ?? null
    const familyMatch = familyRule ? stopReasons.reasonsByOperationFamily.get(familyRule.activityName) ?? null : null
    const match = exactMatch ?? familyMatch
    const classificationBasis = exactMatch
      ? 'exact-activity-name'
      : familyMatch
        ? 'operation-family'
        : null
    const center = geometry.coordinates
    const distance = distanceMeters(FARM_CENTER, center)
    const value = toNumber(row.Valor)
    const duration = toDurationSeconds(row.Duration)
    const reasonText = toNullableString(row['Reason for stopping'])

    alerts.push({
      alertId: `${row.Timestamp}|${row['Service Order']}|${row.Alert}`,
      at,
      day: toLocalDayKey(at),
      machine: toNullableString(row['Machine Name']),
      serviceOrder: toNullableString(row['Service Order']),
      team: toNullableString(row.Team),
      operator: {
        number: toNullableString(row['Operator Number']),
        name: toNullableString(row['Operator Name']),
      },
      operation: operation?.canonical ?? null,
      operationRaw: operation?.raw ?? null,
      alert: toNullableString(row.Alert),
      value,
      durationSeconds: duration,
      stopReasonText: reasonText,
      stopReasons: match?.reasons ?? [],
      classification: match ? match.reasons[0]?.type ?? 'SEM CLASSIFICACAO' : 'SEM CLASSIFICACAO',
      classificationBasis,
      classifiedActivity: familyMatch?.activityName ?? exactMatch?.operation ?? null,
      location: { longitude: center[0], latitude: center[1] },
      distanceFromFarmMeters: Math.round(distance),
      outOfProperty: distance > FARM_RADIUS_METERS,
      sourceRow: row.__rowNumber,
    })
  }

  alerts.sort((a, b) => b.at.localeCompare(a.at))

  const pressureNote = unreadable === 0
    ? null
    : `${unreadable} alerta(s) com POINT invalido`

  return {
    alerts,
    sources: [source],
    note: pressureNote,
    range: daysBetween(alerts.map((alert) => alert.at)),
    alertTypes: Object.fromEntries(countBy(alerts, (alert) => alert.alert)),
    classifications: Object.fromEntries(countBy(alerts, (alert) => alert.classification)),
    classificationBasis: Object.fromEntries(countBy(alerts, (alert) => alert.classificationBasis ?? 'SEM CLASSIFICACAO')),
    unclassified: alerts.filter((alert) => alert.classification === 'SEM CLASSIFICACAO').length,
    outOfProperty: alerts.filter((alert) => alert.outOfProperty).length,
  }
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

function main() {
  const catalog = buildPestCatalog()
  const trapData = buildTraps(catalog)
  const events = buildEvents(catalog, trapData.traps)
  const series = buildTrapSeries(events)

  // O tipo da armadilha vem de traps_list; a serie so precisa da chave.
  const typeByCode = new Map(trapData.traps.map((trap) => [trap.trapCode, trap.type]))
  for (const row of series.rows) row.trapType = typeByCode.get(row.trapCode) ?? null

  const climate = buildClimate()
  const operations = buildMachineOperations()
  const stopReasons = buildStopReasons()
  const machineAlerts = buildMachineAlerts(stopReasons)

  /* --- saidas --------------------------------------------------- */

  writeJson(
    'traps.json',
    {
      property: {
        businessUnit: toInteger(trapData.sources[1].records[0]?.idBusinessUnit),
        farm: toInteger(trapData.sources[0].records[0]?.farm),
        harvest: toNullableString(trapData.sources[0].records[0]?.harvest),
        timezone: PROPERTY_TIMEZONE,
        utcOffset: PROPERTY_TIMEZONE_OFFSET,
      },
      bounds: trapData.bbox,
      traps: trapData.traps,
    },
    'Cadastro de armadilhas com historico de leitura e resumo de eventos.',
    'traps_list.csv, traps_data.csv',
    { rows: trapData.traps.length },
  )

  writeJson(
    'pests.json',
    {
      groups: catalog.groups.map((group) => ({
        key: group.key,
        popularName: group.popularName,
        scientificNames: group.scientificNames,
        detectionNames: group.detectionNames,
        classification: group.classification,
        cultures: group.cultures,
        hasDocumentation: group.hasDocumentation,
        hasReferencePhotos: group.hasReferencePhotos,
        variants: group.variants,
      })),
    },
    'Catalogo de pragas com limiares por cultura, sintomas e fotos de referencia.',
    'pest_list.csv, pest_details.csv',
    { rows: catalog.groups.length },
  )

  writeJson(
    'trap-series.json',
    series,
    'Serie diaria de capturas por armadilha, separada de telemetria.',
    'traps_events.csv',
    { rows: series.rows.length },
  )

  writeJson(
    'events/index.json',
    {
      range: events.range,
      typeCounts: events.typeCounts,
      totalCaptures: events.totalCaptures,
      totalDetections: events.totalDetections,
      divergentCount: events.divergentCount,
      traps: events.index,
    },
    'Indice de eventos por armadilha, com a contagem de imagem e telemetria.',
    'traps_events.csv',
    { rows: events.index.length },
  )
  for (const [trapCode, list] of events.eventsByCode) {
    writeJson(
      `events/${trapCode}.json`,
      { trapCode, eventCount: list.length, events: list },
      `Eventos da armadilha ${trapCode}, com caixas delimitadoras por deteccao.`,
      'traps_events.csv',
      { rows: list.length, lazy: true },
    )
  }

  writeJson(
    'climate/daily.json',
    {
      station: climate.station,
      days: climate.days,
      range: [climate.range[0] ?? null, climate.range.at(-1) ?? null],
    },
    'Serie diaria de clima com saldo hidrico.',
    findClimateFile(),
    { rows: climate.days.length },
  )

  writeJson(
    'climate/hourly.json',
    { station: climate.station, hours: climate.hourly },
    'Leituras horarias do relatorio climatico.',
    findClimateFile(),
    { rows: climate.hourly.length, lazy: true },
  )

  writeJson(
    'operations/fertilization.json',
    withoutRecords(operations.fertilization),
    'Ordens de servico de fertilizacao com area, dose aplicada e dose configurada.',
    'LAYER_MAP_FERTILIZATION.csv',
    { rows: operations.fertilization.operations.length },
  )

  writeJson(
    'operations/spray.json',
    withoutRecords(operations.spray),
    'Ordens de servico de pulverizacao com trajetoria e pressao registrada.',
    'LAYER_MAP_SPRAY_PRESSURE.csv',
    { rows: operations.spray.operations.length },
  )

  writeJson(
    'machine-alerts.json',
    {
      range: machineAlerts.range,
      note: machineAlerts.note,
      alertTypes: machineAlerts.alertTypes,
      classifications: machineAlerts.classifications,
      classificationBasis: machineAlerts.classificationBasis,
      unclassified: machineAlerts.unclassified,
      outOfProperty: machineAlerts.outOfProperty,
      alerts: machineAlerts.alerts,
    },
    'Alertas parametrizados de maquina, ja relacionados aos motivos de parada cadastrados.',
    'LAYER_MAP_PARAMETERIZED_ALERT.csv, stop_reasons.csv, stop_reasons_activities.csv',
    { rows: machineAlerts.alerts.length, lazy: true },
  )

  writeJson(
    'stop-reasons.json',
    {
      reasons: stopReasons.reasons,
      activities: stopReasons.activities,
      byOperation: [...stopReasons.reasonsByOperation.values()].sort((a, b) => a.operation.localeCompare(b.operation)),
      operationFamilyMapping: OPERATION_ACTIVITY_FAMILY.map((rule) => ({
        activityName: rule.activityName,
        match: rule.match.source,
        stopReasons: stopReasons.reasonsByOperationFamily.get(rule.activityName)?.reasons ?? [],
      })),
    },
    'Motivos de parada cadastrados e o vinculo atividade -> operacao.',
    'stop_reasons.csv, stop_reasons_activities.csv',
    { rows: stopReasons.reasons.length },
  )

  /* --- manifesto ------------------------------------------------ */

  const sources = [
    ...trapData.sources,
    ...catalog.sources,
    ...events.sources,
    ...climate.sources,
    ...operations.fertilization.sources,
    ...operations.spray.sources,
    ...machineAlerts.sources,
    ...stopReasons.sources,
  ]

  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: 'FrontEnd/scripts/convertCsvToJson.mjs',
    datasetTimezone: PROPERTY_TIMEZONE,
    datasetUtcOffset: PROPERTY_TIMEZONE_OFFSET,
    farmReference: FARM_CENTER,
    farmReferenceRadiusMeters: FARM_RADIUS_METERS,
    rules: {
      trapIdentity: 'trapCode',
      captureSource: 'soma das caixas em traps_events.detection',
      pestCountReported: 'pestCount preservado como auditoria, nao usado nos indicadores',
      telemetryExcluded: ['PING', 'CLIENT_BATTERY_VOLTAGE'],
      thresholdsSource: 'pest_list.MIIP_PEST_ALERT / CONTROL / DAMAGE por cultura',
      dayBuckets: 'dia local da fazenda (UTC-03:00) a partir do instante UTC',
      coordinateOrder: 'WKT em (longitude latitude); nenhuma inversao aplicada',
    },
    sources: sources.map((source) => ({
      file: source.file,
      delimiter: source.delimiter,
      encoding: source.encoding,
      lineEnding: source.lineEnding,
      bom: source.hasBom,
      rows: source.records.length,
      columns: source.columns,
      bytes: source.bytes,
      modifiedAt: source.modifiedAt,
    })),
    outputs: outputs.sort((a, b) => a.file.localeCompare(b.file)),
    coverage: {
      traps: {
        count: trapData.traps.length,
        invalidCoordinates: trapData.invalidCoordinates.length,
        readingsFromUnknownTrapId: trapData.traps.reduce((sum, trap) => sum + (trap.readingsFromUnknownTrapId ?? 0), 0),
      },
      events: {
        range: spanOf(events.range),
        byType: events.typeCounts,
        totalCaptures: events.totalCaptures,
        totalDetections: events.totalDetections,
        divergentFromPestCount: events.divergentCount,
      },
      climate: { range: spanOf(climate.range), days: climate.days.length, hours: climate.hourly.length },
      fertilization: { range: spanOf(operations.fertilization.range), serviceOrders: operations.fertilization.operations.length },
      spray: { range: spanOf(operations.spray.range), serviceOrders: operations.spray.operations.length },
      machineAlerts: { range: spanOf(machineAlerts.range), alerts: machineAlerts.alerts.length },
    },
    discarded: log.toJSON(),
    warnings: buildWarnings({ trapData, events, climate, operations, machineAlerts, stopReasons, catalog }),
  }

  writeJson('manifest.json', manifest, 'Catalogo de dados, proveniencia, cobertura e descartes.', 'todos os CSVs da raiz')

  report({ trapData, events, climate, operations, machineAlerts, stopReasons, catalog, outputs })
}

function spanOf(days) {
  if (days.length === 0) return [null, null]
  return [days[0], days[days.length - 1]]
}

/** Duas casas decimais, sem o ruido de ponto flutuante binario. */
function round(value) {
  return value === null || value === undefined ? null : Number(value.toFixed(2))
}

function buildWarnings({ trapData, events, climate, operations, machineAlerts, stopReasons, catalog }) {
  const warnings = []

  const rangeOf = (range) => (range.length > 0 ? `${range[0]} a ${range.at(-1)}` : 'sem dados')

  const pestRange = events.range
  const sprayRange = operations.spray.range
  const fertRange = operations.fertilization.range

  const overlaps = (a, b) => a.length > 0 && b.length > 0 && a[0] <= b.at(-1) && b[0] <= a.at(-1)

  warnings.push({
    id: 'pest-vs-spray',
    severity: overlaps(pestRange, sprayRange) ? 'info' : 'attention',
    title: 'Eventos de praga x pulverizacao',
    message: overlaps(pestRange, sprayRange)
      ? 'Ha sobreposicao de datas entre os eventos de praga e as ordens de pulverizacao.'
      : `Sem sobreposicao: eventos de praga em ${rangeOf(pestRange)} e pulverizacao em ${rangeOf(sprayRange)}. `
        + 'Nao existe janela comum para relacionar captura e pulverizacao.',
  })

  warnings.push({
    id: 'pest-vs-fertilization',
    severity: overlaps(pestRange, fertRange) ? 'info' : 'attention',
    title: 'Eventos de praga x fertilizacao',
    message: overlaps(pestRange, fertRange)
      ? 'Ha sobreposicao de datas entre os eventos de praga e as ordens de fertilizacao.'
      : `Sem sobreposicao: eventos de praga em ${rangeOf(pestRange)} e fertilizacao em ${rangeOf(fertRange)}.`,
  })

  const zeroPressure = operations.spray.operations.reduce((sum, operation) => sum + operation.zeroPressureSegments, 0)
  const totalSpraySegments = operations.spray.operations.reduce((sum, operation) => sum + operation.segments, 0)
  warnings.push({
    id: 'spray-pressure',
    severity: zeroPressure === totalSpraySegments ? 'attention' : 'info',
    title: 'Pressao de pulverizacao',
    message: zeroPressure === totalSpraySegments
      ? `Todos os ${totalSpraySegments} trechos de pulverizacao estao com pressao zero. `
        + 'O campo existe, mas nao tem dado utilizavel. Nenhuma faixa de pressao foi aplicada por nao haver valor de negocio validado.'
      : `${zeroPressure} de ${totalSpraySegments} trechos com pressao zero.`,
  })

  warnings.push({
    id: 'stop-reason-link',
    severity: machineAlerts.unclassified > 0 ? 'attention' : 'info',
    title: 'Motivo de parada',
    message: `${machineAlerts.unclassified} de ${machineAlerts.alerts.length} alertas ficam sem classificacao `
      + 'porque o arquivo nao traz o id do motivo de parada. O vinculo feito e pela operacao (Operation -> atividade -> motivo). '
      + `Ha ${stopReasons.reasons.length} motivos e ${stopReasons.activities.length} atividades cadastrados.`,
  })

  warnings.push({
    id: 'trap-count-divergence',
    severity: events.divergentCount > 0 ? 'attention' : 'info',
    title: 'pestCount x deteccao',
    message: events.divergentCount === 0
      ? 'pestCount bate com a contagem de caixas em todos os eventos.'
      : `${events.divergentCount} eventos tem pestCount diferente da soma das caixas. `
        + 'Os indicadores usam a soma das caixas; pestCount segue visivel como valor reportado pelo dispositivo.',
  })

  warnings.push({
    id: 'alerts-outside-property',
    severity: machineAlerts.outOfProperty > 0 ? 'attention' : 'info',
    title: 'Alertas fora da propriedade',
    message: `${machineAlerts.outOfProperty} de ${machineAlerts.alerts.length} alertas estao a mais de `
      + `${FARM_RADIUS_METERS / 1000} km do centro de referencia da fazenda. Todos continuam visiveis e sinalizados.`,
  })

  const undocumented = catalog.groups.filter((group) => !group.hasDocumentation).length
  warnings.push({
    id: 'pest-documentation',
    severity: undocumented > 0 ? 'attention' : 'info',
    title: 'Documentacao das pragas',
    message: undocumented === 0
      ? 'Todas as pragas do catalogo tem descricao e sintomas.'
      : `${undocumented} de ${catalog.groups.length} pragas do catalogo nao tem descricao nem sintomas em pest_details.csv.`,
  })

  const climateOverlap = overlaps(pestRange, climate.range)
  warnings.push({
    id: 'climate-coverage',
    severity: climateOverlap ? 'info' : 'attention',
    title: 'Cobertura climatica',
    message: `Estacao climatica: ${climate.range.length > 0 ? rangeOf(climate.range) : 'sem dados'}. `
      + (climateOverlap
        ? 'Cobre todo o periodo dos eventos de praga, permitindo leitura descritiva.'
        : 'Nao cobre todo o periodo dos eventos de praga.'),
  })

  return warnings
}

function report(context) {
  const { trapData, events, climate, operations, machineAlerts, stopReasons, catalog } = context
  const totalBytes = outputs.reduce((sum, output) => sum + output.bytes, 0)

  const lines = [
    '',
    'AgroInsight - conversao CSV -> JSON',
    CHECK_ONLY ? 'modo --check (nenhum arquivo escrito)' : `saida em ${path.relative(repoRoot, outputDir)}`,
    '',
    `pragas: ${catalog.groups.length} grupos, ${catalog.variantCount} variantes por cultura`,
    `armadilhas: ${trapData.traps.length} por trapCode (${trapData.orphanSnapshots.length} codigos so em traps_data)`,
    `eventos: ${events.totalCaptures} capturas, ${events.totalDetections} deteccoes, ${events.divergentCount} divergentes de pestCount`,
    `serie diaria: ${context.outputs.find((o) => o.file === 'trap-series.json')?.rows ?? 0} linhas`,
    `clima: ${climate.days.length} dias, ${climate.hourly.length} horas`,
    `fertilizacao: ${operations.fertilization.operations.length} ordens de servico`,
    `pulverizacao: ${operations.spray.operations.length} ordens de servico`,
    `alertas de maquina: ${machineAlerts.alerts.length} (${machineAlerts.outOfProperty} fora da propriedade)`,
    `motivos de parada: ${stopReasons.reasons.length} motivos, ${stopReasons.activities.length} atividades`,
    '',
    `arquivos: ${outputs.length} | ${(totalBytes / 1048576).toFixed(2)} MB no total`,
  ]

  const discarded = log.toJSON()
  if (discarded.length > 0) {
    lines.push('', 'registros descartados ou corrigidos:')
    for (const entry of discarded) lines.push(`  ${String(entry.count).padStart(6)}  ${entry.file} - ${entry.reason}`)
  }

  console.log(lines.join('\n'))
}

main()
