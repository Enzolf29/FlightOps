import { greatCircleDistanceNm } from '../flightStatus/computeFlightDistanceProgress'
import {
  BUSINESS_CLASS_PRICE_MULTIPLIER,
  FIRST_CLASS_PRICE_MULTIPLIER,
  LONG_HAUL_DISTANCE_NM_THRESHOLD,
  REFERENCE_CARGO_PRICE_EUR_PER_KG,
  type CabinSplit,
  type PricingTierFareModel,
  type ResolvedFlightEconomy
} from '../types/economy'

/** Prix de référence (le "juste prix") pour une distance donnée : une part fixe par vol (frais
 * d'aéroport, handling, équipage minimum) plus une part au NM — un modèle purement linéaire
 * sous-évalue fortement les courts et moyens courriers, voir PRICING_TIER_FARE_MODEL. */
export function computeReferenceTicketPriceEur(fareModel: PricingTierFareModel, distanceNm: number): number {
  return fareModel.baseFareEur + fareModel.perNmEur * distanceNm
}

/**
 * Multiplicateur de revenu passager appliqué au prix billet économique : 1 en dessous du seuil
 * long-courrier (aucun ajustement), sinon la moyenne pondérée des multiplicateurs par classe selon
 * la répartition de la compagnie — capture le supplément business/première sans changer le prix
 * économique affiché ni le calcul de demande (basé uniquement sur le tarif économique).
 */
export function computeCabinRevenueMultiplier(cabinSplit: CabinSplit, distanceNm: number): number {
  if (distanceNm < LONG_HAUL_DISTANCE_NM_THRESHOLD) return 1
  return (
    cabinSplit.economyShare * 1 +
    cabinSplit.businessShare * BUSINESS_CLASS_PRICE_MULTIPLIER +
    cabinSplit.firstShare * FIRST_CLASS_PRICE_MULTIPLIER
  )
}

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
  /** Modèle de tarif de référence du positionnement de la compagnie (PRICING_TIER_FARE_MODEL). */
  referenceFareModel: PricingTierFareModel
  /** Surtaxe "petit aéroport" côté départ (voir computeAirportSurcharge), ex. 0.25 pour +25 %. */
  airportSurchargeFraction: number
  /** Répartition passagers par classe du positionnement de la compagnie (PRICING_TIER_CABIN_SPLIT). */
  cabinSplit: CabinSplit
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
  const referenceTicketPriceEur =
    computeReferenceTicketPriceEur(input.referenceFareModel, distanceNm) * (1 + input.airportSurchargeFraction)
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
    cabinRevenueMultiplier: computeCabinRevenueMultiplier(input.cabinSplit, distanceNm),
    expectedPassengers: Math.max(0, Math.round(paxLoadFactor * input.seatCapacity)),
    expectedCargoKg: Math.max(0, Math.round(cargoLoadFactor * input.cargoCapacityKg))
  }
}
