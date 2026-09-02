import { RecommendationCard, type RecommendationPriority } from '../../../core/recommendation-card'

export type FertilizerRateControlData = {
  priority: RecommendationPriority
  title: string
  description: string
}

type FertilizerRateControlCardProps = { data: FertilizerRateControlData }

export function FertilizerRateControlCard({ data }: FertilizerRateControlCardProps) {
  return <RecommendationCard {...data} />
}
