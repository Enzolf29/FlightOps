import { parseUtc } from '../lib/datetime'
import { AUTO_CANCEL_DELAY_MINUTES } from './rules'

/** Un vol non démarré est annulé uniquement une fois les trois heures entièrement dépassées. */
export function shouldAutoCancelFlight(scheduledDeparture: string, nowIso: string): boolean {
  const delayMinutes = (parseUtc(nowIso).getTime() - parseUtc(scheduledDeparture).getTime()) / 60_000
  return delayMinutes > AUTO_CANCEL_DELAY_MINUTES
}
