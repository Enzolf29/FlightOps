/** Surtaxe max ("petit aéroport") appliquée quand aucune destination réelle n'est connue pour cette
 * compagnie au départ de cet aéroport. */
const MAX_SURCHARGE = 0.4
/** Plancher conservé même très au-delà du seuil — un hub très actif ne fait pas baisser la
 * référence en dessous de ce niveau. */
const MIN_SURCHARGE = 0.1
/** Nombre de destinations connues à partir duquel la surtaxe atteint son plancher. */
const ROUTE_COUNT_THRESHOLD = 6

/**
 * Surtaxe "petit aéroport" sur le prix de référence, basée sur le nombre de destinations réelles
 * connues (Vols réels/AeroDataBox) pour cette compagnie au départ de cet aéroport — moins de
 * destinations connues, plus l'aéroport est probablement petit pour cette compagnie, plus la
 * surtaxe est forte. Décroît linéairement de MAX_SURCHARGE (0 destination) à MIN_SURCHARGE
 * (ROUTE_COUNT_THRESHOLD destinations), puis reste au plancher au-delà.
 *
 * `knownRouteCount` null signifie que cet aéroport n'a jamais été recherché pour cette compagnie :
 * aucune surtaxe n'est alors appliquée (0), plutôt que de pénaliser par défaut une ligne pas encore
 * explorée via Vols réels.
 */
export function computeAirportSurcharge(knownRouteCount: number | null): number {
  if (knownRouteCount === null) return 0
  if (knownRouteCount >= ROUTE_COUNT_THRESHOLD) return MIN_SURCHARGE
  const ratio = knownRouteCount / ROUTE_COUNT_THRESHOLD
  return MIN_SURCHARGE + (MAX_SURCHARGE - MIN_SURCHARGE) * (1 - ratio)
}
