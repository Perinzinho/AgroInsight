import { AlertCard } from '../../../core/alert-card'

export type CriticalWaterDeficitAlertData = {
  number: string
  title: string
  description: string
}

type CriticalWaterDeficitAlertCardProps = {
  data: CriticalWaterDeficitAlertData
}

export function CriticalWaterDeficitAlertCard({ data }: CriticalWaterDeficitAlertCardProps) {
  return <AlertCard {...data} level="Alto" tone="high" />
}
