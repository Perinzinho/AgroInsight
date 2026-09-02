import { ApplicationDataGovernanceCard, type ApplicationDataGovernanceData } from './application-data-governance'
import { ClimateGuidedPlanningCard, type ClimateGuidedPlanningData } from './climate-guided-planning'
import { FertilizerRateControlCard, type FertilizerRateControlData } from './fertilizer-rate-control'
import { IdleTimeReductionCard, type IdleTimeReductionData } from './idle-time-reduction'
import { LeafhopperEmergencyControlCard, type LeafhopperEmergencyControlData } from './leafhopper-emergency-control'
import { SprayingSystemCalibrationCard, type SprayingSystemCalibrationData } from './spraying-system-calibration'
import './RecommendationsSection.css'

export type RecommendationsData = {
  title: string
  subtitle: string
  sprayingSystemCalibration: SprayingSystemCalibrationData
  fertilizerRateControl: FertilizerRateControlData
  leafhopperEmergencyControl: LeafhopperEmergencyControlData
  idleTimeReduction: IdleTimeReductionData
  climateGuidedPlanning: ClimateGuidedPlanningData
  applicationDataGovernance: ApplicationDataGovernanceData
}

type RecommendationsSectionProps = { data: RecommendationsData }

export function RecommendationsSection({ data }: RecommendationsSectionProps) {
  const style = {
    '--recommendations-text': colors.text.primary,
    '--recommendations-muted': colors.text.muted,
  } as CSSProperties

  return (
    <section className="recommendations" style={style} aria-labelledby="recommendations-title">
      <header className="recommendations__header">
        <h2 id="recommendations-title">{data.title}</h2>
        <p>{data.subtitle}</p>
      </header>

      <div className="recommendations__list">
        <SprayingSystemCalibrationCard data={data.sprayingSystemCalibration} />
        <FertilizerRateControlCard data={data.fertilizerRateControl} />
        <LeafhopperEmergencyControlCard data={data.leafhopperEmergencyControl} />
        <IdleTimeReductionCard data={data.idleTimeReduction} />
        <ClimateGuidedPlanningCard data={data.climateGuidedPlanning} />
        <ApplicationDataGovernanceCard data={data.applicationDataGovernance} />
      </div>
    </section>
  )
}
import type { CSSProperties } from 'react'
import { colors } from '../../core/theme/colors'
