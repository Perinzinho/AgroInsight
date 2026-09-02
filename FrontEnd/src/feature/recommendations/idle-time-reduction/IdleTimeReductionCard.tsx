import { RecommendationCard, type RecommendationPriority } from '../../../core/recommendation-card'

export type IdleTimeReductionData = {
  priority: RecommendationPriority
  title: string
  description: string
}

type IdleTimeReductionCardProps = { data: IdleTimeReductionData }

export function IdleTimeReductionCard({ data }: IdleTimeReductionCardProps) {
  return <RecommendationCard {...data} />
}
