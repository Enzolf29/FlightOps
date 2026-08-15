import { parseUtc } from '../lib/datetime'
import type { DelayBucket } from '../types/pirep'

/**
 * Estimation de ponctualité en direct (avant la création du PIREP), utilisée sur la page de
 * suivi de vol : compare l'heure de départ prévue à l'heure de départ réelle une fois connue
 * (figée pour le reste du vol), ou à l'heure actuelle tant que le vol n'a pas encore quitté le
 * parking. Mêmes seuils que `computePirepOutcome` pour rester cohérent visuellement.
 *
 * Comparer à l'heure actuelle en continu (plutôt qu'à l'heure de départ réelle une fois connue)
 * ferait grandir le "retard" indéfiniment à mesure que le vol avance, même pour un vol parti à
 * l'heure — un vol de 1h30 finirait toujours par s'afficher "en retard" en fin de trajet.
 */
export function computeLivePunctuality(scheduledDeparture: string, actualDepartureIso: string | null, nowIso: string): DelayBucket {
  const referenceIso = actualDepartureIso ?? nowIso
  const delayMinutes = Math.round((parseUtc(referenceIso).getTime() - parseUtc(scheduledDeparture).getTime()) / 60000)
  if (delayMinutes <= 10) return 'on_time'
  if (delayMinutes <= 60) return 'delayed_10_60'
  return 'delayed_60_plus'
}
