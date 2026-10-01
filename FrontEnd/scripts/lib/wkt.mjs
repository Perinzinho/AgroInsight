/**
 * Conversao de WKT para geometria no formato aceito pelo Leaflet/GeoJSON.
 *
 * Os arquivos LAYER_MAP_* usam `POINT`, `POLYGON`, `MULTIPOLYGON`, `LINESTRING`
 * e `MULTILINESTRING`. A ordem das coordenadas ja e `(longitude latitude)`,
 * confirmado pelo bbox dos arquivos, que cai exatamente na area da fazenda.
 * Nenhuma inversao e aplicada.
 */

const GEOMETRY_TYPES = new Set([
  'POINT',
  'LINESTRING',
  'POLYGON',
  'MULTIPOINT',
  'MULTILINESTRING',
  'MULTIPOLYGON',
])

/** Casa numeros com notacao cientifica, ex.: `8.6e-4` e `-49.97`. */
const NUMBER = '(-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)'

/** Arredonda coordenadas para reduzir o peso do JSON sem perder precisao util. */
function roundCoordinate(value, precision) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

/**
 * Extrai todos os pares de numeros de um corpo WKT.
 * `parseNumbers('1 2, 3 4')` -> [[1,2],[3,4]]
 */
export function parseNumbers(body, precision = 6) {
  const points = []
  const pattern = new RegExp(`${NUMBER}\\s+${NUMBER}`, 'g')
  let match = pattern.exec(body)
  while (match !== null) {
    points.push([
      roundCoordinate(Number(match[1]), precision),
      roundCoordinate(Number(match[2]), precision),
    ])
    match = pattern.exec(body)
  }
  return points
}

/** Remove parenteses e virgulas, preservando apenas numeros e separadores. */
function stripStructure(text) {
  return text.replace(/[(),]/g, ' ')
}

/**
 * Converte uma geometria WKT em GeoJSON.
 * Devolve `null` quando o texto nao e uma geometria suportada, para que o
 * registro entre na lista de descartes em vez de quebrar a conversao.
 */
export function wktToGeoJson(wkt, precision = 6) {
  if (typeof wkt !== 'string') return null
  const text = wkt.trim().toUpperCase()
  if (text === '' || text === 'NAN') return null

  const match = text.match(/^([A-Z]+)\s*(.*)$/s)
  if (!match) return null

  const [, rawType, body] = match
  const type = rawType.replace(/\s+/g, '')
  if (!GEOMETRY_TYPES.has(type)) return null

  if (type === 'POINT') {
    const [position] = parseNumbers(body, precision)
    if (!position) return null
    return { type: 'Point', coordinates: position }
  }

  if (type === 'MULTIPOINT') {
    const positions = parseNumbers(stripStructure(body), precision)
    if (positions.length === 0) return null
    return { type: 'MultiPoint', coordinates: positions }
  }

  if (type === 'LINESTRING' || type === 'MULTILINESTRING') {
    const coordinates = parseNumbers(body, precision)
    if (coordinates.length < 2) return null
    return {
      type: type === 'LINESTRING' ? 'LineString' : 'MultiLineString',
      coordinates: type === 'LINESTRING' ? coordinates : [coordinates],
    }
  }

  if (type === 'POLYGON' || type === 'MULTIPOLYGON') {
    const rings = []
    const ringPattern = /\(([^()]*)\)/g
    let ringMatch = ringPattern.exec(body)
    while (ringMatch !== null) {
      const ring = parseNumbers(ringMatch[1], precision)
      if (ring.length >= 4) rings.push(closeRing(ring))
      ringMatch = ringPattern.exec(body)
    }
    if (rings.length === 0) return null
    return {
      type: type === 'POLYGON' ? 'Polygon' : 'MultiPolygon',
      coordinates: type === 'POLYGON' ? rings : [rings],
    }
  }

  return null
}

/** Poligonos WKT sometimes omit the repeated closing vertex. */
function closeRing(ring) {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return [...ring, [first[0], first[1]]]
  return ring
}

/** `[minLon, minLat, maxLon, maxLat]` de uma geometria GeoJSON. */
export function geometryBBox(geometry) {
  const min = [Infinity, Infinity]
  const max = [-Infinity, -Infinity]

  const walk = (value) => {
    if (typeof value[0] === 'number') {
      const [longitude, latitude] = value
      if (longitude < min[0]) min[0] = longitude
      if (latitude < min[1]) min[1] = latitude
      if (longitude > max[0]) max[0] = longitude
      if (latitude > max[1]) max[1] = latitude
      return
    }
    for (const child of value) walk(child)
  }

  walk(geometry.coordinates)
  if (min[0] === Infinity) return null
  return [min[0], min[1], max[0], max[1]]
}

/** Area aproximada em hectares, via projecao plana local (equivalente local). */
export function geometryAreaHectares(geometry) {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : []

  let totalSquareMeters = 0
  for (const polygon of polygons) totalSquareMeters += polygonArea(polygon[0])
  return totalSquareMeters / 10000
}

/** Shoelace em coordenadas planas locais, corrigindo a distorcao da latitude. */
function polygonArea(ring) {
  if (ring.length < 4) return 0
  const referenceLatitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
  const metersPerDegreeLat = 110574
  const metersPerDegreeLon = 111320 * Math.cos((referenceLatitude * Math.PI) / 180)

  let sum = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[index + 1]
    sum += (x1 * metersPerDegreeLon) * (y2 * metersPerDegreeLat)
      - (x2 * metersPerDegreeLon) * (y1 * metersPerDegreeLat)
  }
  return Math.abs(sum / 2)
}

/** Distancia em metros entre dois pontos, suficiente para filtro de outlier. */
export function distanceMeters([lon1, lat1], [lon2, lat2]) {
  const referenceLatitude = ((lat1 + lat2) / 2) * (Math.PI / 180)
  const dx = (lon1 - lon2) * 111320 * Math.cos(referenceLatitude)
  const dy = (lat1 - lat2) * 110574
  return Math.hypot(dx, dy)
}

/**
 * Remove pontos quase colineares de uma linha, reduzindo o JSON entregue sem
 * alterar a trajetória visível. `toleranceMeters` controla a agressividade.
 */
export function simplifyLine(points, toleranceMeters = 1) {
  if (points.length <= 2) return points
  const simplified = [points[0]]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1]
    const current = points[index]
    if (distanceMeters(previous, current) >= toleranceMeters) simplified.push(current)
  }

  const last = points[points.length - 1]
  const tail = simplified[simplified.length - 1]
  if (tail !== last) simplified.push(last)
  return simplified
}
