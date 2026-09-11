/** Surtaxe max ("petit aéroport") appliquée quand aucune activité réelle n'est connue pour cette
 * compagnie au départ de cet aéroport. */
const MAX_SURCHARGE = 0.4
/** Plancher conservé même très au-delà du seuil — un hub très actif ne fait pas baisser la
 * référence en dessous de ce niveau. */
const MIN_SURCHARGE = 0.1
/** Score d'activité à partir duquel la surtaxe atteint son plancher — calé sur des exemples réels
 * (Ryanair/Barcelone, une vraie base secondaire, atteint ~35 ; un aéroport à peine desservi ou
 * juste balayé une fois par une grosse recherche reste sous 5). */
const ACTIVITY_SCORE_THRESHOLD = 15

/**
 * Surtaxe "petit aéroport" sur le prix de référence, basée sur l'activité réelle connue (Vols
 * réels/AeroDataBox) pour cette compagnie au départ de cet aéroport — moins d'activité connue,
 * plus l'aéroport est probablement petit pour cette compagnie, plus la surtaxe est forte. Décroît
 * linéairement de MAX_SURCHARGE (score 0) à MIN_SURCHARGE (score ACTIVITY_SCORE_THRESHOLD), puis
 * reste au plancher au-delà (voir getKnownAirportActivityScore pour le calcul du score : la somme,
 * route par route, des observations plafonnées — pas juste le nombre de destinations).
 *
 * `activityScore` null signifie que cet aéroport n'a jamais été recherché pour cette compagnie :
 * aucune surtaxe n'est alors appliquée (0), plutôt que de pénaliser par défaut une ligne pas encore
 * explorée via Vols réels.
 */
export function computeAirportSurcharge(activityScore: number | null): number {
  if (activityScore === null) return 0
  if (activityScore >= ACTIVITY_SCORE_THRESHOLD) return MIN_SURCHARGE
  const ratio = activityScore / ACTIVITY_SCORE_THRESHOLD
  return MIN_SURCHARGE + (MAX_SURCHARGE - MIN_SURCHARGE) * (1 - ratio)
}
