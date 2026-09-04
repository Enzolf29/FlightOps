import type { PirepTelemetrySample } from '../types/pirep'
import { greatCircleDistanceNm } from './computeFlightDistanceProgress'

export interface ApproachCheckpoint {
  targetFeet: 1000 | 500
  sample: PirepTelemetrySample | null
  stable: boolean | null
  reasons: string[]
}

export interface PirepTelemetryAnalysis {
  actualDistanceNm: number | null
  approach1000: ApproachCheckpoint
  approach500: ApproachCheckpoint
}

function checkpoint(samples: PirepTelemetrySample[], targetFeet: 1000 | 500): ApproachCheckpoint {
  const candidates = samples.filter((sample) => !sample.onGround && sample.altitudeAglFeet > 0 && sample.altitudeAglFeet <= targetFeet + 150)
  const sample = candidates.reduce<PirepTelemetrySample | null>((closest, current) => {
    if (!closest) return current
    return Math.abs(current.altitudeAglFeet - targetFeet) < Math.abs(closest.altitudeAglFeet - targetFeet) ? current : closest
  }, null)
  if (!sample) return { targetFeet: targetFeet, sample: null, stable: null, reasons: [] }
  const reasons: string[] = []
  if (sample.verticalSpeedFpm < -1000 || sample.verticalSpeedFpm > 300) reasons.push('vitesse verticale')
  if (Math.abs(sample.bankDegrees) > 20) reasons.push('inclinaison')
  if (!sample.gearDown) reasons.push('train')
  if (sample.flapsIndex <= 0) reasons.push('volets')
  return { targetFeet: targetFeet, sample, stable: reasons.length === 0, reasons }
}

export function analyzePirepTelemetry(samples: PirepTelemetrySample[]): PirepTelemetryAnalysis {
  let distance = 0
  for (let i = 1; i < samples.length; i += 1) {
    distance += greatCircleDistanceNm(
      samples[i - 1].latitude,
      samples[i - 1].longitude,
      samples[i].latitude,
      samples[i].longitude
    )
  }
  return {
    actualDistanceNm: distance > 0 && Number.isFinite(distance) ? distance : null,
    approach1000: checkpoint(samples, 1000),
    approach500: checkpoint(samples, 500)
  }
}

export function scorePunctuality(delayMinutes: number | null): number | null {
  if (delayMinutes === null) return null
  return Math.max(0, Math.round(100 - Math.max(0, delayMinutes - 10) * 1.5))
}

export function scoreLanding(verticalSpeedFpm: number | null): number | null {
  if (verticalSpeedFpm === null) return null
  const rate = Math.abs(verticalSpeedFpm)
  if (rate <= 180) return 100
  if (rate <= 250) return 85
  if (rate <= 350) return 65
  if (rate <= 500) return 35
  return 10
}

export function scoreFuel(actualKg: number | null, plannedKg: number | null): number | null {
  if (actualKg === null || plannedKg === null || plannedKg <= 0) return null
  return Math.max(0, Math.round(100 - (Math.abs(actualKg - plannedKg) / plannedKg) * 100))
}

export function scoreComfort(gForce: number | null, warningCount: number): number | null {
  if (gForce === null) return warningCount > 0 ? Math.max(0, 100 - warningCount * 10) : null
  const gPenalty = Math.abs(gForce - 1.15) * 80
  return Math.max(0, Math.round(100 - gPenalty - warningCount * 8))
}
