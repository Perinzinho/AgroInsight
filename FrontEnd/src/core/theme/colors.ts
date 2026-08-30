/**
 * Paleta oficial do AgroInsight.
 *
 * Use estes tokens em vez de declarar cores diretamente nos componentes.
 * A paleta foi baseada na referência: interface escura, verde como cor
 * principal, amarelo para alertas/destaques e azul para dados e informações.
 */
export const colors = {
  background: {
    page: '#020B07',
    surface: '#06150F',
    surfaceElevated: '#0A2118',
  },
  text: {
    primary: '#F1F7F3',
    secondary: '#A7B9B0',
    muted: '#70837A',
  },
  border: '#17382B',
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
  feedback: {
    danger: '#E76550',
    warning: '#E7CB58',
    success: '#55C89E',
    info: '#58BAD0',
  },
} as const

export type Colors = typeof colors
