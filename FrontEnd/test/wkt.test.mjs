import { describe, expect, it } from 'vitest'
import {
  distanceMeters,
  geometryAreaHectares,
  geometryBBox,
  parseNumbers,
  simplifyLine,
  wktToGeoJson,
} from '../scripts/lib/wkt.mjs'

/**
 * A geometria do dataset vem como WKT de um shapefile. Dois erros aqui mudam
 * silenciosamente o mapa e a area aplicada: ler `[lat, lon]` em vez de
 * `[lon, lat]` desloca a propriedade kilometres, e `POLYGON` fechado com o
 * primeiro ponto repetido infla a area calculada.
 */
describe('wkt: leitura de numeros', () => {
  it('lê o corpo numerico devolvendo um grupo por vertice', () => {
    expect(parseNumbers('POINT (-49.9 -22.2)')).toEqual([[-49.9, -22.2]])
    expect(parseNumbers('LINESTRING (-49.9 -22.2, -49.8 -22.3)')).toEqual([[-49.9, -22.2], [-49.8, -22.3]])
  })

  it('respeita a precisao pedida', () => {
    expect(parseNumbers('LINESTRING (-49.1234567 -22.7654321)', 3)).toEqual([[-49.123, -22.765]])
  })
})

describe('wkt: POINT', () => {
  it('preserva a ordem [longitude, latitude]', () => {
    const geometry = wktToGeoJson('POINT (-49.976471903059796 -22.245662264098474)')
    expect(geometry.type).toBe('Point')
    expect(geometry.coordinates).toEqual([-49.976472, -22.245662])
    expect(geometry.coordinates[0]).toBeLessThan(geometry.coordinates[1])
  })
})

describe('wkt: LINESTRING', () => {
  it('le todos os vertices', () => {
    const geometry = wktToGeoJson('LINESTRING (-49.9 -22.2, -49.8 -22.3, -49.7 -22.4)')
    expect(geometry.type).toBe('LineString')
    expect(geometry.coordinates).toHaveLength(3)
  })
})

describe('wkt: POLYGON', () => {
  it('calcula a area em hectares de um quadrado de 1 km', () => {
    // 0,01 grau de longitude em~-22 graus equivale a pouco mais de 1 km; a area
    // tem de sair na ordem de grandeza de mil hectares, nao de cem.
    const geometry = wktToGeoJson('POLYGON ((-49.9 -22.2, -49.89 -22.2, -49.89 -22.21, -49.9 -22.21, -49.9 -22.2))')
    expect(geometry.type).toBe('Polygon')
    const area = geometryAreaHectares(geometry)
    expect(area).toBeGreaterThan(100)
    expect(area).toBeLessThan(130)
  })

  it('devolve zero para geometria sem area', () => {
    expect(geometryAreaHectares(wktToGeoJson('POINT (-49.9 -22.2)'))).toBe(0)
    expect(geometryAreaHectares(wktToGeoJson('LINESTRING (-49.9 -22.2, -49.8 -22.3)'))).toBe(0)
  })
})

describe('wkt: bbox', () => {
  it('inclui todos os vertices', () => {
    const bbox = geometryBBox(wktToGeoJson('LINESTRING (-49.9 -22.2, -49.7 -22.5, -49.8 -22.1)'))
    expect(bbox).toEqual([-49.9, -22.5, -49.7, -22.1])
  })
})

describe('wkt: distancia', () => {
  it('zero para o mesmo ponto', () => {
    expect(distanceMeters([-49.9, -22.2], [-49.9, -22.2])).toBe(0)
  })

  it('aproxima a distancia real entre dois pontos conhecidos', () => {
    // Mesmo meridiano, 0,1 grau de latitude equivale a cerca de 11,1 km.
    const meters = distanceMeters([-49.9, -22.2], [-49.9, -22.1])
    expect(meters).toBeGreaterThan(11_000)
    expect(meters).toBeLessThan(11_200)
  })
})

describe('wkt: simplificacao', () => {
  it('remove pontos que ficam abaixo da tolerancia', () => {
    const points = [
      [-49.9, -22.2],
      [-49.90001, -22.20001],
      [-49.8, -22.3],
    ]
    expect(simplifyLine(points, 10)).toHaveLength(2)
  })

  it('mantem a linha quando a tolerancia e zero', () => {
    const points = [
      [-49.9, -22.2],
      [-49.85, -22.25],
      [-49.8, -22.3],
    ]
    expect(simplifyLine(points, 0)).toHaveLength(3)
  })

  it('nao quebra linha de dois pontos', () => {
    expect(simplifyLine([[-49.9, -22.2], [-49.8, -22.3]], 1000)).toHaveLength(2)
  })
})