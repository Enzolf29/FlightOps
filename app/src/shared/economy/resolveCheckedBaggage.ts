import { BAGGAGE_CHECK_SHARE_MAX, BAGGAGE_CHECK_SHARE_MIN } from '../types/economy'

/**
 * Nombre de passagers ayant enregistré un bagage en soute, tiré au hasard une fois le nombre réel
 * de passagers connu (relu depuis l'OFP importé) — le prix du bagage étant fixé par la compagnie
 * (pas de fourchette à régler par ligne), seule cette part est aléatoire, pas le tarif.
 */
export function resolveCheckedBagsSold(passengersSold: number, random: () => number = Math.random): number {
  const share = BAGGAGE_CHECK_SHARE_MIN + random() * (BAGGAGE_CHECK_SHARE_MAX - BAGGAGE_CHECK_SHARE_MIN)
  return Math.max(0, Math.round(passengersSold * share))
}
