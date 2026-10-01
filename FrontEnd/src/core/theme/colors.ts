/**
 * Paleta oficial do AgroInsight.
 *
 * Use estes tokens em vez de declarar cores diretamente nos componentes.
 * A paleta foi baseada na referência: interface escura, verde como cor
 * principal, amarelo para alertas/destaques e azul para dados e informações.
 *
 * `severity` cobre as cores de estado usada por KPIs, alertas e legendas de
 * regra. `nullSeverityColor` e a cor de "sem informacao": e aplicada quando o
 * dado nao existe no arquivo de origem, para que a interface nunca mostre um
 * valor inventado com aparencia de certeza.
 */
export const colors = {
  background: {
    page: '#020B07',
    surface: '#06150F',
    surfaceElevated: '#0A2118',
    /** Sobreposicao para modais e paineis flutuantes. */
    overlay: 'rgba(2, 11, 7, 0.82)',
  },
  text: {
    primary: '#F1F7F3',
    secondary: '#A7B9B0',
    muted: '#70837A',
  },
  border: {
    default: '#17382B',
    strong: '#2A5544',
  },
  green: {
    primary: '#55C89E',
    light: '#8BE0BF',
    dark: '#257A5B',
  },
  yellow: {
    primary: '#E7CB58',
    light: '#F5E59A',
    dark: '#A88924',
  },
  blue: {
    primary: '#58BAD0',
    light: '#91DAE8',
    dark: '#237E98',
  },
  /** Dourado da marca, usado em selecao e destaque de navegacao. */
  gold: {
    primary: '#D5AF40',
    light: '#EAD072',
  },
  feedback: {
    danger: '#E76550',
    warning: '#E7CB58',
    success: '#55C89E',
    info: '#58BAD0',
  },
  severity: {
    critical: '#E76550',
    high: '#E9A05A',
    medium: '#E7CB58',
    low: '#58BAD0',
    ok: '#55C89E',
    /** Ausencia de dado. Nunca usar para representar um valor. */
    unknown: '#5A6B63',
  },
  /** Paleta categorica para graficos, da praga mais frequente para a menos. */
  chart: [
    '#55C89E',
    '#58BAD0',
    '#E7CB58',
    '#E76550',
    '#8BE0BF',
    '#91DAE8',
    '#A88924',
    '#237E98',
  ],
  /** Preenchimentos translucidos para sobreposicoes de mapa e faixas. */
  overlay: {
    green: 'rgba(85, 200, 158, 0.16)',
    blue: 'rgba(88, 186, 208, 0.16)',
    yellow: 'rgba(231, 203, 88, 0.16)',
    red: 'rgba(231, 101, 80, 0.16)',
  },
} as const

export type Colors = typeof colors
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'ok' | 'unknown'
export type ChartColor = (typeof colors.chart)[number]

/** Cor de um nivel de severidade. */
export function severityColor(severity: Severity): string {
  return colors.severity[severity]
}