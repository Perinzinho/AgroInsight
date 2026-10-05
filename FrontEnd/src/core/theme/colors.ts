/**
 * Paleta oficial do AgroInsight.
 *
 * Use estes tokens em vez de declarar cores diretamente nos componentes.
 * Paleta editorial de campo: superfícies claras, verde profundo na marca,
 * ocre para destaques e azul para dados e informações.
 *
 * `severity` cobre as cores de estado usada por KPIs, alertas e legendas de
 * regra. `nullSeverityColor` e a cor de "sem informacao": e aplicada quando o
 * dado nao existe no arquivo de origem, para que a interface nunca mostre um
 * valor inventado com aparencia de certeza.
 */
export const colors = {
  background: {
    page: '#F6F4ED',
    surface: '#FFFFFF',
    surfaceElevated: '#F0EFE7',
    /** Sobreposicao para modais e paineis flutuantes. */
    overlay: 'rgba(28, 50, 40, 0.78)',
  },
  text: {
    primary: '#1E352B',
    secondary: '#5E6E64',
    muted: '#819085',
  },
  border: {
    default: '#DEDCD0',
    strong: '#C8CABD',
  },
  green: {
    primary: '#2A6B4B',
    light: '#4F9A70',
    dark: '#194933',
  },
  yellow: {
    primary: '#BC914D',
    light: '#E4CC93',
    dark: '#8E6B31',
  },
  blue: {
    primary: '#4C8190',
    light: '#8AB3BB',
    dark: '#315E6D',
  },
  /** Dourado da marca, usado em selecao e destaque de navegacao. */
  gold: {
    primary: '#AF793B',
    light: '#D5AD65',
  },
  feedback: {
    danger: '#BD5C43',
    warning: '#BC914D',
    success: '#2A6B4B',
    info: '#4C8190',
  },
  severity: {
    critical: '#BD5C43',
    high: '#C47D43',
    medium: '#BC914D',
    low: '#4C8190',
    ok: '#2A6B4B',
    /** Ausencia de dado. Nunca usar para representar um valor. */
    unknown: '#89978C',
  },
  /** Paleta categorica para graficos, da praga mais frequente para a menos. */
  chart: [
    '#2A6B4B',
    '#4C8190',
    '#BC914D',
    '#BD5C43',
    '#4F9A70',
    '#8AB3BB',
    '#8E6B31',
    '#315E6D',
  ],
  /** Preenchimentos translucidos para sobreposicoes de mapa e faixas. */
  overlay: {
    green: 'rgba(42, 107, 75, 0.10)',
    blue: 'rgba(76, 129, 144, 0.10)',
    yellow: 'rgba(188, 145, 77, 0.12)',
    red: 'rgba(189, 92, 67, 0.10)',
  },
} as const

export type Colors = typeof colors
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'ok' | 'unknown'
export type ChartColor = (typeof colors.chart)[number]

/** Cor de um nivel de severidade. */
export function severityColor(severity: Severity): string {
  return colors.severity[severity]
}
