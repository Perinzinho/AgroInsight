import { RecommendationCard, type RecommendationPriority } from '../../../core/recommendation-card'

export type SprayingSystemCalibrationData = {
  priority: RecommendationPriority
  title: string
  description: string
}

type SprayingSystemCalibrationCardProps = { data: SprayingSystemCalibrationData }

export function SprayingSystemCalibrationCard({ data }: SprayingSystemCalibrationCardProps) {
  return <RecommendationCard {...data} />
}
