/** Surtaxe max ("petit aéroport") appliquée quand aucune destination connue n'est desservie par
 * cette compagnie au départ de cet aéroport. Volontairement modérée : la surtaxe propre à la ligne
 * (voir computeRouteSurcharge) s'ajoute par-dessus pour les cas les moins confirmés. */
const MAX_SURCHARGE = 0.25
/** Plancher conservé même très au-delà du seuil — un hub très actif ne fait pas baisser la
 * référence en dessous de ce niveau. */
const MIN_SURCHARGE = 0.05
/** Nombre de destinations connues à partir duquel la surtaxe atteint son plancher — un aéroport à
 * peine desservi par cette compagnie reste sous ce seuil, une vraie base au-delà. */
const DESTINATION_COUNT_THRESHOLD = 6

/**
 * Surtaxe "petit aéroport" sur le prix de référence, basée sur le nombre de destinations réelles
 * connues (Vols réels/AeroDataBox) pour cette compagnie au départ de cet aéroport — moins de
 * destinations connues, plus l'aéroport est probablement petit pour cette compagnie, plus la
 * surtaxe est forte. Décroît linéairement de MAX_SURCHARGE (0 destination) à MIN_SURCHARGE
 * (DESTINATION_COUNT_THRESHOLD destinations), puis reste au plancher au-delà.
 *
 * `destinationCount` null signifie que cet aéroport n'a jamais été recherché pour cette compagnie :
 * aucune surtaxe n'est alors appliquée (0), plutôt que de pénaliser par défaut une ligne pas encore
 * explorée via Vols réels.
 */
export function computeAirportSurcharge(destinationCount: number | null): number {
  if (destinationCount === null) return 0
  if (destinationCount >= DESTINATION_COUNT_THRESHOLD) return MIN_SURCHARGE
  const ratio = destinationCount / DESTINATION_COUNT_THRESHOLD
  return MIN_SURCHARGE + (MAX_SURCHARGE - MIN_SURCHARGE) * (1 - ratio)
}
