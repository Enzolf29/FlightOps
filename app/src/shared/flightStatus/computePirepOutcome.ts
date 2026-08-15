import { parseUtc } from '../lib/datetime'
import { AUTO_CANCEL_DELAY_MINUTES } from './rules'
import type { DelayBucket } from '../types/pirep'

export interface PirepOutcome {
  flightTimeMinutes: number
  delayMinutes: number
  delayBucket: DelayBucket | null
  status: 'completed' | 'cancelled'
}

/**
 * Calcule la durée de vol et le retard à partir des horaires réels (heure Zulu du simulateur),
 * et applique la règle des 3h : au-delà, le vol est considéré annulé plutôt que "très en retard".
 */
export function computePirepOutcome(
  scheduledDeparture: string,
  actualDeparture: string,
  actualArrival: string
): PirepOutcome {
  const scheduledMs = parseUtc(scheduledDeparture).getTime()
  const actualDepartureMs = parseUtc(actualDeparture).getTime()
  const actualArrivalMs = parseUtc(actualArrival).getTime()

  const flightTimeMinutes = Math.max(0, Math.round((actualArrivalMs - actualDepartureMs) / 60000))
  const delayMinutes = Math.round((actualDepartureMs - scheduledMs) / 60000)

  if (delayMinutes > AUTO_CANCEL_DELAY_MINUTES) {
    return { flightTimeMinutes, delayMinutes, delayBucket: null, status: 'cancelled' }
  }

  let delayBucket: DelayBucket
  if (delayMinutes <= 10) {
    delayBucket = 'on_time'
  } else if (delayMinutes <= 60) {
    delayBucket = 'delayed_10_60'
  } else {
    delayBucket = 'delayed_60_plus'
  }

  return { flightTimeMinutes, delayMinutes, delayBucket, status: 'completed' }
}
