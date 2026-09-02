import { AlertCard } from '../../../core/alert-card'

export type LeafhopperPressureAlertData = {
  number: string
  title: string
  description: string
}

type LeafhopperPressureAlertCardProps = {
  data: LeafhopperPressureAlertData
}

export function LeafhopperPressureAlertCard({ data }: LeafhopperPressureAlertCardProps) {
  return <AlertCard {...data} level="Crítico" tone="critical" />
}
