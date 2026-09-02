import { RecommendationCard, type RecommendationPriority } from '../../../core/recommendation-card'

export type LeafhopperEmergencyControlData = {
  priority: RecommendationPriority
  title: string
  description: string
}

type LeafhopperEmergencyControlCardProps = { data: LeafhopperEmergencyControlData }

export function LeafhopperEmergencyControlCard({ data }: LeafhopperEmergencyControlCardProps) {
  return <RecommendationCard {...data} />
}
