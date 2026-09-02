import { RecommendationCard, type RecommendationPriority } from '../../../core/recommendation-card'

export type ClimateGuidedPlanningData = {
  priority: RecommendationPriority
  title: string
  description: string
}

type ClimateGuidedPlanningCardProps = { data: ClimateGuidedPlanningData }

export function ClimateGuidedPlanningCard({ data }: ClimateGuidedPlanningCardProps) {
  return <RecommendationCard {...data} />
}
