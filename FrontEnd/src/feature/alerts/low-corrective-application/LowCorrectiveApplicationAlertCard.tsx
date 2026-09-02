import { AlertCard } from '../../../core/alert-card'

export type LowCorrectiveApplicationAlertData = {
  number: string
  title: string
  description: string
}

type LowCorrectiveApplicationAlertCardProps = {
  data: LowCorrectiveApplicationAlertData
}

export function LowCorrectiveApplicationAlertCard({ data }: LowCorrectiveApplicationAlertCardProps) {
  return <AlertCard {...data} level="Alto" tone="high" />
}
