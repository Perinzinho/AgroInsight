/**
 * Leitor de CSV compativel com os arquivos da raiz do AgroInsight.
 *
 * Todos os CSVs usam `;` como delimitador, exceto o relatorio climatico, que usa
 * `,`. As duas situacoes sao detectadas pelo cabecalho e normalizadas aqui para
 * que o resto do pipeline nunca precise saber qual arquivo esta lendo.
 */

const BOM = '\uFEFF'

/** Remove o BOM UTF-8 e normaliza quebras de linha. */
export function readCsvText(rawText) {
  return rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

/** Detecta o delimitador olhando apenas a primeira linha nao vazia. */
export function detectDelimiter(text) {
  const firstLine = text.split('\n').find((line) => line.trim().length > 0) ?? ''
  return firstLine.includes(';') ? ';' : ','
}

/**
 * Parser RFC 4180: campos entre aspas, aspas duplicadas como escape,
 * quebras de linha dentro do campo e delimitador dentro do campo.
 */
export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Converte as linhas em objetos usando o cabecalho.
 * Linhas totalmente vazias no fim do arquivo sao descartadas.
 */
export function parseCsvRecords(text) {
  const rows = parseCsv(text)
  const header = rows[0] ?? []
  const names = header.map((name) => name.trim())

  return rows.slice(1).map((row, rowIndex) => {
    const record = {}
    names.forEach((name, columnIndex) => {
      record[name] = row[columnIndex] ?? ''
    })
    record.__rowNumber = rowIndex + 2
    return record
  })
}

export { BOM }
