import { describe, expect, it } from 'vitest'
import {
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
  toPropertyLocalIso,
  toText,
} from '../scripts/lib/parse.mjs'

/**
 * O fuso da propriedade e UTC-03 e o dataset cruza meia-noite. Estes testes
 * existem para travar esse comportamento: um dia que "vaza" para o dia anterior
 * ou seguinte muda a leitura de toda a serie diaria.
 */
describe('parse: campos vazios', () => {
  it('trata string vazia, espacos e os marcadores de ausencia como null', () => {
    expect(toNullableString('')).toBeNull()
    expect(toNullableString('   ')).toBeNull()
    expect(toNullableString('nan')).toBeNull()
    expect(toNullableString('-')).toBeNull()
    expect(toNullableString(null)).toBeNull()
    expect(toNullableString(undefined)).toBeNull()
  })

  it('preserva texto valido', () => {
    expect(toNullableString(' Spodoptera ')).toBe('Spodoptera')
    expect(toText('Lagarta')).toBe('Lagarta')
  })
})

describe('parse: numeros', () => {
  it('aceita decimal com virgula e com ponto', () => {
    expect(toNumber('44,5')).toBe(44.5)
    expect(toNumber('44.5')).toBe(44.5)
  })

  it('trata ponto como separador de milhar quando a virgula e o decimal', () => {
    expect(toNumber('1.234,56')).toBe(1234.56)
    expect(toNumber('1.234.567,89')).toBe(1234567.89)
  })

  it('trata virgula como separador de milhar quando o ponto e o decimal', () => {
    expect(toNumber('1,234.56')).toBe(1234.56)
  })

  it('devolve null em vez de zero para campo ausente ou nao numerico', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber('   ')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber('n/a')).toBeNull()
  })

  it('preserva zero real, que e sinal e nao ausencia', () => {
    expect(toNumber('0')).toBe(0)
    expect(toNumber('0,00')).toBe(0)
    expect(toInteger('0')).toBe(0)
  })

  it('arredonda inteiro em vez de truncar', () => {
    expect(toInteger('12,6')).toBe(13)
    expect(toInteger('-3,2')).toBe(-3)
  })
})

describe('parse: booleanos', () => {
  it('reconhece as grafias Python e JSON usadas nos CSVs', () => {
    expect(toBoolean('true')).toBe(true)
    expect(toBoolean('True')).toBe(true)
    expect(toBoolean('TRUE')).toBe(true)
    expect(toBoolean('false')).toBe(false)
  })

  it('devolve null para qualquer outra grafia, em vez de assumir false', () => {
    expect(toBoolean('')).toBeNull()
    expect(toBoolean('sim')).toBeNull()
    expect(toBoolean('0')).toBeNull()
  })
})

describe('parse: instantes e fuso da propriedade', () => {
  it('converte epoch seconds para ISO UTC', () => {
    expect(fromEpochSeconds('1772070000')).toBe('2026-02-26T01:40:00.000Z')
    expect(fromEpochSeconds('')).toBeNull()
  })

  it('desloca o horario brasileiro para UTC ao converter', () => {
    // 25/02/2026 19:03:03 na fazenda e 22:03:03 UTC do mesmo dia.
    expect(fromBrazilianDateTime('25/02/2026 19:03:03')).toBe('2026-02-25T22:03:03.000Z')
  })

  it('devolve null quando o formato nao bate com o CSV', () => {
    expect(fromBrazilianDateTime('2026-02-25 19:03:03')).toBeNull()
    expect(fromBrazilianDateTime('25/02/2026 19:03')).toBeNull()
    expect(fromBrazilianDateTime('')).toBeNull()
  })

  it('lê o rotulo do arquivo climatico, que ja esta em GMT-03', () => {
    expect(fromClimateLabel('25/02/2026 - 00:00')).toBe('2026-02-25T03:00:00.000Z')
    expect(fromClimateLabel('25/02/2026 - 23:00')).toBe('2026-02-26T02:00:00.000Z')
    expect(fromClimateLabel('')).toBeNull()
  })

  it('desloca o dia local para a data da propriedade, nao para a de UTC', () => {
    // 03:00 UTC ainda e 25/02 na fazenda.
    expect(toLocalDayKey('2026-02-25T03:00:00.000Z')).toBe('2026-02-25')
    // 01:00 UTC do dia 26 ja e 25/02 na fazenda: a data nao pode vazar para 26.
    expect(toLocalDayKey('2026-02-26T01:00:00.000Z')).toBe('2026-02-25')
    // 23:00 UTC do dia 25 ainda e 25/02 na fazenda.
    expect(toLocalDayKey('2026-02-25T23:00:00.000Z')).toBe('2026-02-25')
  })

  it('gera ISO local da propriedade com o offset -03:00', () => {
    expect(toPropertyLocalIso('2026-02-26T01:00:00.000Z')).toBe('2026-02-25T22:00:00-03:00')
    expect(toPropertyLocalIso(null)).toBeNull()
  })

  it('aceita ISO com Z e devolve o mesmo instante', () => {
    expect(toIsoUtc('2026-02-25T22:03:00Z')).toBe('2026-02-25T22:03:00.000Z')
    expect(toIsoUtc('')).toBeNull()
  })
})

describe('parse: duracao e hora', () => {
  it('lê duracao em HH:MM:SS', () => {
    expect(toDurationSeconds('01:00:00')).toBe(3600)
    expect(toDurationSeconds('00:02:30')).toBe(150)
    expect(toDurationSeconds('')).toBeNull()
    expect(toDurationSeconds('90')).toBeNull()
  })

  it('reduz a hora do dia a HH:mm', () => {
    expect(toClockTime('19:03:00')).toBe('19:03')
    expect(toClockTime('')).toBeNull()
  })
})

describe('parse: chaves', () => {
  it('normaliza para comparar nomes sem acento e sem caixa', () => {
    expect(normalizeKey('Adubação')).toBe(normalizeKey('ADUBACAO'))
    expect(normalizeKey('  pulverizacao ')).toBe('pulverizacao')
    expect(normalizeKey('Mosca-das-frutos')).toBe(normalizeKey('Mosca das Frutos'))
  })
})