/** Surtaxe max appliquée à une ligne jamais confirmée par rapport aux autres lignes au départ du
 * même aéroport pour cette compagnie. Modérée : s'ajoute à la surtaxe "petit aéroport" (voir
 * computeAirportSurcharge), qui capture déjà l'essentiel de l'effet "aéroport peu desservi". */
const MAX_SURCHARGE = 0.15
const MIN_SURCHARGE = 0
/** Part d'observations à partir de laquelle la ligne est considérée aussi confirmée que la moyenne
 * des lignes au départ du même aéroport — au-delà, aucune surtaxe supplémentaire. */
const SHARE_THRESHOLD = 1

/**
 * Surtaxe propre à une ligne précise, basée sur sa part d'observations relativement aux autres
 * lignes au départ du même aéroport pour cette compagnie (voir getRouteObservationShare) — un
 * ratio plutôt qu'un compte absolu, pour ne pas dépendre du volume total de recherches effectuées
 * (qui augmente indéfiniment à chaque rafraîchissement). Une ligne confirmée aussi souvent que la
 * moyenne (ratio ≥ 1) ne porte aucune surtaxe ; une ligne beaucoup moins confirmée que les autres
 * lignes du même aéroport (ex. LFPG → LFRB observée 5 fois quand LFRB → LFPG ne l'est que 2 fois)
 * en porte une, à hauteur de son sous-échantillonnage relatif.
 *
 * `observationShare` null signifie que cette ligne précise n'a jamais été observée dans ce sens (ou
 * qu'aucune ligne n'est encore connue au départ de cet aéroport) : aucune surtaxe n'est alors
 * appliquée ici, la surtaxe "petit aéroport" couvrant déjà ce cas.
 */
export function computeRouteSurcharge(observationShare: number | null): number {
  if (observationShare === null || observationShare >= SHARE_THRESHOLD) return MIN_SURCHARGE
  const ratio = Math.max(0, observationShare) / SHARE_THRESHOLD
  return MIN_SURCHARGE + (MAX_SURCHARGE - MIN_SURCHARGE) * (1 - ratio)
}
