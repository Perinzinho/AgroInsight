import { RecommendationCard, type RecommendationPriority } from '../../../core/recommendation-card'

export type ApplicationDataGovernanceData = {
  priority: RecommendationPriority
  title: string
  description: string
}

type ApplicationDataGovernanceCardProps = { data: ApplicationDataGovernanceData }

export function ApplicationDataGovernanceCard({ data }: ApplicationDataGovernanceCardProps) {
  return <RecommendationCard {...data} />
}
