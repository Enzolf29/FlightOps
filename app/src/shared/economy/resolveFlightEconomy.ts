import { greatCircleDistanceNm } from '../flightStatus/computeFlightDistanceProgress'
import { REFERENCE_CARGO_PRICE_EUR_PER_KG, type ResolvedFlightEconomy } from '../types/economy'

/** Au-dessus du prix de référence, la demande chute selon une loi de puissance : doubler le prix
 * (ratio 2) divise le remplissage attendu par 2^EXPONENT avant application de l'aléatoire. */
const DEMAND_ELASTICITY_EXPONENT = 2
const DEMAND_JITTER_MIN = 0.85
const DEMAND_JITTER_RANGE = 0.3
const MIN_LOAD_FACTOR = 0.1

/**
 * Taux de remplissage attendu (0 à 1) selon le rapport prix pratiqué / prix de référence. En
 * dessous ou égal à la référence : quasi plein. Au-dessus : chute avec une part d'aléatoire (±15 %)
 * pour qu'un prix trop cher reste risqué plutôt que prévisible au centime près — jamais sous
 * MIN_LOAD_FACTOR ni au-dessus de 100 %.
 */
export function computeLoadFactor(priceRatio: number, random: () => number = Math.random): number {
  const base = priceRatio <= 1 ? 1 : priceRatio ** -DEMAND_ELASTICITY_EXPONENT
  const jitter = DEMAND_JITTER_MIN + random() * DEMAND_JITTER_RANGE
  return Math.min(1, Math.max(MIN_LOAD_FACTOR, base * jitter))
}

export interface ResolveFlightEconomyInput {
  /** Tarif de référence €/NM du positionnement de la compagnie (PRICING_TIER_REFERENCE_FARE_PER_NM). */
  referenceFarePerNm: number
  routePrice: {
    ticketPriceMinEur: number
    ticketPriceMaxEur: number
    cargoPriceMinEurPerKg: number
    cargoPriceMaxEurPerKg: number
  }
  originLat: number
  originLon: number
  destLat: number
  destLon: number
  seatCapacity: number
  cargoCapacityKg: number
}

/**
 * Résout le prix réellement pratiqué (tiré au hasard dans la fourchette de la ligne) et la demande
 * qui en découle, avant réservation SimBrief — le nombre de passagers/fret obtenu est ensuite
 * injecté dans l'URL de dispatch SimBrief (pax/cargo) pour que le plan généré reflète la demande.
 */
export function resolveFlightEconomy(
  input: ResolveFlightEconomyInput,
  random: () => number = Math.random
): ResolvedFlightEconomy {
  const distanceNm = greatCircleDistanceNm(input.originLat, input.originLon, input.destLat, input.destLon)
  const referenceTicketPriceEur = input.referenceFarePerNm * distanceNm
  const referenceCargoPriceEurPerKg = REFERENCE_CARGO_PRICE_EUR_PER_KG

  const ticketPriceEur =
    input.routePrice.ticketPriceMinEur + random() * (input.routePrice.ticketPriceMaxEur - input.routePrice.ticketPriceMinEur)
  const cargoPriceEurPerKg =
    input.routePrice.cargoPriceMinEurPerKg +
    random() * (input.routePrice.cargoPriceMaxEurPerKg - input.routePrice.cargoPriceMinEurPerKg)

  const paxLoadFactor = computeLoadFactor(
    referenceTicketPriceEur > 0 ? ticketPriceEur / referenceTicketPriceEur : 1,
    random
  )
  const cargoLoadFactor = computeLoadFactor(
    referenceCargoPriceEurPerKg > 0 ? cargoPriceEurPerKg / referenceCargoPriceEurPerKg : 1,
    random
  )

  return {
    ticketPriceEur: Math.round(ticketPriceEur * 100) / 100,
    cargoPriceEurPerKg: Math.round(cargoPriceEurPerKg * 100) / 100,
    referenceTicketPriceEur: Math.round(referenceTicketPriceEur * 100) / 100,
    referenceCargoPriceEurPerKg,
    expectedPassengers: Math.max(0, Math.round(paxLoadFactor * input.seatCapacity)),
    expectedCargoKg: Math.max(0, Math.round(cargoLoadFactor * input.cargoCapacityKg))
  }
}
