import type { SVGProps } from 'react'

const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  trends: 'M3 3v18h18 M6 15l5-5 4 3 6-8',
  map: 'M9 4 3 6v15l6-2 6 2 6-2V4l-6 2-6-2z M9 4v15 M15 6v15',
  trap: 'M7 7h10v14H7z M9 7V5a3 3 0 0 1 6 0v2 M10 11h4 M10 15h4',
  climate: 'M8 3v2 M3 8h2 M5 5l1 1 M12 5l-1 1 M4 13a5 5 0 1 1 9-5 M7 18h11a4 4 0 0 0 0-8 5 5 0 0 0-9 2 3 3 0 0 0-2 6 M10 21v1 M15 21v1',
  operations: 'M3 4h18v16H3z M3 9h18 M8 2v4 M16 2v4 M7 13h3 M14 13h3 M7 16h3',
  machine: 'M12 3 2 21h20L12 3z M12 9v5 M12 17v.1',
  pests: 'M8 9h8v7a4 4 0 0 1-8 0V9z M9 9V7a3 3 0 0 1 6 0v2 M9 3l1 2 M15 3l-1 2 M4 10l4 2 M20 10l-4 2 M3 16h5 M21 16h-5 M5 21l4-3 M19 21l-4-3 M12 10v10',
  compare: 'M4 5h6v16H4z M14 3h6v18h-6z M4 10h6 M14 8h6',
  quality: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4z M8 12l3 3 5-6',
} as const

export type AgroIconName = keyof typeof paths

export default function AgroIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: AgroIconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>
}
