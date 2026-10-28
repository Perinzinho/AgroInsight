import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { colors } from './colors'

/**
 * `index.css` declara os mesmos tokens de `colors.ts` para que o CSS possa usar
 * `var(--...)`. Este teste existe para a paleta nao ganhar duas versoes: se
 * alguém mexer em um dos arquivos sem o outro, aqui quebra.
 *
 * O ambiente e jsdom, entao `import.meta.url` nao e uma URL de arquivo; o
 * caminho vem do diretorio de trabalho do projeto.
 */
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function cssToken(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token ${name} nao encontrado em index.css`)
  return match[1].trim()
}

const flatten = Object.entries(colors as Record<string, unknown>)
  .filter((entry): entry is [string, string] => typeof entry[1] === 'string')

const severityEntries = Object.entries(colors.severity)
const overlayEntries = Object.entries(colors.overlay)
const backgroundEntries = Object.entries(colors.background)
const textEntries = Object.entries(colors.text)
const borderEntries = Object.entries(colors.border)

/** `surfaceElevated` -> `surface-elevated`, como o CSS escreve. */
const kebab = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

const expectations: [string, string][] = [
  ...backgroundEntries.map(([key, value]) => [`--color-${kebab(key)}`, value] as [string, string]),
  ...textEntries.map(([key, value]) => [`--color-text-${kebab(key)}`, value] as [string, string]),
  ...borderEntries.map(([key, value]) => [`--color-border${key === 'default' ? '' : `-${kebab(key)}`}`, value] as [string, string]),
  ['--color-green', colors.green.primary],
  ['--color-green-light', colors.green.light],
  ['--color-green-dark', colors.green.dark],
  ['--color-yellow', colors.yellow.primary],
  ['--color-yellow-dark', colors.yellow.dark],
  ['--color-blue', colors.blue.primary],
  ['--color-blue-dark', colors.blue.dark],
  ['--color-gold', colors.gold.primary],
  ['--color-danger', colors.feedback.danger],
  ...severityEntries.map(([key, value]) => [`--color-severity-${kebab(key)}`, value] as [string, string]),
  ...overlayEntries.map(([key, value]) => [`--color-overlay-${kebab(key)}`, value] as [string, string]),
]

describe('tokens de cor', () => {
  it.each(expectations)('%s em index.css bate com colors.ts', (token, expected) => {
    expect(cssToken(token).toLowerCase()).toBe(expected.toLowerCase())
  })

  it('mantem os tokens de feedback apuntando para a severidade', () => {
    expect(colors.feedback.danger).toBe(colors.severity.critical)
    expect(colors.feedback.warning).toBe(colors.severity.medium)
    expect(colors.feedback.success).toBe(colors.severity.ok)
    expect(colors.feedback.info).toBe(colors.severity.low)
  })

  it('usa hex de 6 digitos em todas as cores opacas', () => {
    for (const [key, value] of flatten) {
      if (!value.startsWith('#')) continue
      expect(`${key}=${value}`).toMatch(/^[\w-]+=#[0-9a-fA-F]{6}$/)
    }
  })
})