import { AlertCard } from '../../../core/alert-card'

export type PressureZeroAlertData = {
  number: string
  title: string
  description: string
}

type PressureZeroAlertCardProps = {
  data: PressureZeroAlertData
}

export function PressureZeroAlertCard({ data }: PressureZeroAlertCardProps) {
  return <AlertCard {...data} level="Crítico" tone="critical" />
}
