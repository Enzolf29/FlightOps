import { parseUtc } from '../lib/datetime'

/**
 * Progression estimée du vol entre 0 (pas encore parti) et 1 (arrivé), basée sur l'heure
 * programmée plutôt que sur la position réelle — utilisée pour placer un repère visuel sur la
 * ligne de trajet de la carte de vol, pas comme mesure de distance parcourue.
 */
export function computeFlightProgress(scheduledDeparture: string, scheduledArrival: string, nowIso: string): number {
  const start = parseUtc(scheduledDeparture).getTime()
  const end = parseUtc(scheduledArrival).getTime()
  if (end <= start) return 0

  const now = parseUtc(nowIso).getTime()
  return Math.min(1, Math.max(0, (now - start) / (end - start)))
}
