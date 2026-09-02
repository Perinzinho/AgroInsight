import type { CSSProperties } from 'react'
import { colors } from '../theme/colors'
import './RecommendationCard.css'

export type RecommendationPriority = 'P1' | 'P2' | 'P3'

export type RecommendationCardProps = {
  priority: RecommendationPriority
  title: string
  description: string
}

const priorityColors: Record<RecommendationPriority, string> = {
  P1: colors.feedback.danger,
  P2: colors.feedback.warning,
  P3: colors.feedback.success,
}

export function RecommendationCard({ priority, title, description }: RecommendationCardProps) {
  const style = {
    '--recommendation-accent': priorityColors[priority],
    '--recommendation-surface': colors.background.surface,
    '--recommendation-border': colors.border,
    '--recommendation-text': colors.text.primary,
    '--recommendation-muted': colors.text.muted,
  } as CSSProperties

  return (
    <article className="recommendation-card" style={style}>
      <span className="recommendation-card__priority">{priority}</span>
      <div className="recommendation-card__content">
        <h3 className="recommendation-card__title">{title}</h3>
        <p className="recommendation-card__description">{description}</p>
      </div>
    </article>
  )
}
