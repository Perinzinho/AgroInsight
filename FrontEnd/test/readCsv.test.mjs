import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, parseCsvRecords, readCsvText } from '../scripts/lib/readCsv.mjs'

/**
 * Os CSVs da base misturam delimitador, BOM, encoding e aspas. Um parser ingênuo
 * quebra silenciosamente em descricao de praga com ponto e virgula, e um BOM
 * vira parte do nome da primeira coluna — o que faria a coluna `id` nao casar
 * com o nome esperado.
 */
describe('csv: leitura de texto', () => {
  it('remove o BOM UTF-8', () => {
    expect(readCsvText('\uFEFFid;name')).toBe('id;name')
  })

  it('normaliza CRLF e CR para LF', () => {
    expect(readCsvText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('nao estoura com texto vazio', () => {
    expect(readCsvText('')).toBe('')
  })
})

describe('csv: deteccao de delimitador', () => {
  it('reconhece ponto e virgula, o padrao da base', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
  })

  it('reconhece virgula, usado no relatorio climatico', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
  })

  it('ignora linhas vazias antes do cabecalho', () => {
    expect(detectDelimiter('\n\na;b')).toBe(';')
  })
})

describe('csv: parser RFC 4180', () => {
  it('mantem o texto entre aspas como um unico campo', () => {
    const rows = parseCsv('a;b\n1;"linha 1\nlinha 2"')
    expect(rows).toHaveLength(2)
    expect(rows[1][1]).toBe('linha 1\nlinha 2')
  })

  it('trata aspas duplas escapadas dentro do campo', () => {
    expect(parseCsv('a;b\n1;"ele disse ""oi"""')[1][1]).toBe('ele disse "oi"')
  })

  it('nao separa delimitador que esta dentro de aspas', () => {
    expect(parseCsv('a;b\n1;"x;y"')[1]).toEqual(['1', 'x;y'])
  })

  it('preserva coluna vazia, sem deslocar as seguintes', () => {
    expect(parseCsv('a;b;c\n1;;3')[1]).toEqual(['1', '', '3'])
  })
})

describe('csv: registros com cabecalho', () => {
  it('mapeia as colunas pelos nomes do cabecalho', () => {
    const records = parseCsvRecords('id;name\n1;Lagarta')
    expect(records[0].id).toBe('1')
    expect(records[0].name).toBe('Lagarta')
  })

  it('preserva coluna vazia como string vazia, nunca como undefined', () => {
    const records = parseCsvRecords('a;b;c\n1;;3')
    expect(records[0].b).toBe('')
    expect(records[0].c).toBe('3')
  })

  it('numera a linha de origem para rastreabilidade', () => {
    const records = parseCsvRecords('a\n1\n2')
    expect(records.map((record) => record.__rowNumber)).toEqual([2, 3])
  })
})