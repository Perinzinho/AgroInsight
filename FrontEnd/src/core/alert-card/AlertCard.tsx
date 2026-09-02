import { useId, type CSSProperties, type ReactNode } from 'react'
import { colors } from '../theme/colors'
import './AlertCard.css'

export type AlertCardTone = 'critical' | 'high'

export type AlertCardProps = {
  number: string
  level: string
  title: string
  description: string
  tone: AlertCardTone
  className?: string
  action?: ReactNode
}

const toneColors: Record<AlertCardTone, string> = {
  critical: colors.feedback.danger,
  high: colors.feedback.warning,
}

export function AlertCard({ number, level, title, description, tone, className = '', action }: AlertCardProps) {
  const titleId = useId()
  const style = { '--alert-accent': toneColors[tone] } as CSSProperties

  return (
    <article className={`alert-card ${className}`.trim()} style={style} aria-labelledby={titleId}>
      <span className="alert-card__accent" aria-hidden="true" />
      <div className="alert-card__identifier">
        <span className="alert-card__level">{level}</span>
        <span className="alert-card__number">{number}</span>
      </div>
      <div className="alert-card__content">
        <h2 className="alert-card__title" id={titleId}>{title}</h2>
        <p className="alert-card__description">{description}</p>
      </div>
      {action && <div className="alert-card__action">{action}</div>}
    </article>
  )
}
