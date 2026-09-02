import {
  CriticalWaterDeficitAlertCard,
  type CriticalWaterDeficitAlertData,
} from './critical-water-deficit'
import {
  LeafhopperPressureAlertCard,
  type LeafhopperPressureAlertData,
} from './leafhopper-pressure'
import {
  LowCorrectiveApplicationAlertCard,
  type LowCorrectiveApplicationAlertData,
} from './low-corrective-application'
import {
  PressureZeroAlertCard,
  type PressureZeroAlertData,
} from './pressure-zero'
import './AlertsList.css'

export type AlertsListData = {
  pressureZero: PressureZeroAlertData
  leafhopperPressure: LeafhopperPressureAlertData
  lowCorrectiveApplication: LowCorrectiveApplicationAlertData
  criticalWaterDeficit: CriticalWaterDeficitAlertData
}

type AlertsListProps = {
  data: AlertsListData
}

export function AlertsList({ data }: AlertsListProps) {
  return (
    <section className="alerts-list" aria-label="Alertas prioritários">
      <PressureZeroAlertCard data={data.pressureZero} />
      <LeafhopperPressureAlertCard data={data.leafhopperPressure} />
      <LowCorrectiveApplicationAlertCard data={data.lowCorrectiveApplication} />
      <CriticalWaterDeficitAlertCard data={data.criticalWaterDeficit} />
    </section>
  )
}
