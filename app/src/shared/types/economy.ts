export const PRICING_TIERS = ['low_cost', 'classic', 'premium'] as const
export type PricingTier = (typeof PRICING_TIERS)[number]

export const PRICING_TIER_LABEL: Record<PricingTier, string> = {
  low_cost: 'Low-cost',
  classic: 'Classique',
  premium: 'Premium'
}

export interface PricingTierFareModel {
  /** Part fixe par vol (frais d'aéroport, handling, équipage minimum) — un vol court coûte presque
   * aussi cher à opérer qu'un vol moyen-courrier, d'où ce plancher indépendant de la distance. */
  baseFareEur: number
  /** Part variable au NM, s'ajoutant à baseFareEur. */
  perNmEur: number
}

/**
 * Modèle de tarif de référence par positionnement compagnie — calé sur des prix réels observés en
 * 2026 (ex. Brest–CDG, ~278 NM, classique : 90 + 0,10 × 278 ≈ 118 €, dans la fourchette 80-250 €
 * réellement pratiquée). Fixe et non modifiable par le joueur : c'est le "juste prix" qui détermine
 * la demande, seul le tarif réellement pratiqué se règle. Un modèle purement linéaire (juste
 * distance × tarif) sous-évalue fortement les courts et moyens courriers, d'où la part fixe.
 */
export const PRICING_TIER_FARE_MODEL: Record<PricingTier, PricingTierFareModel> = {
  low_cost: { baseFareEur: 35, perNmEur: 0.05 },
  classic: { baseFareEur: 90, perNmEur: 0.1 },
  premium: { baseFareEur: 120, perNmEur: 0.16 }
}

/** Part de passagers qui enregistrent un bagage en soute, tirée au hasard à chaque vol dans cette
 * fourchette — indépendante du positionnement compagnie (contrairement au prix, fixé une fois pour
 * toutes par compagnie, voir Company.baggagePriceEur). */
export const BAGGAGE_CHECK_SHARE_MIN = 0.4
export const BAGGAGE_CHECK_SHARE_MAX = 0.9

/** Distance à partir de laquelle un vol est considéré long-courrier (active le calcul
 * business/première, voir PRICING_TIER_CABIN_SPLIT). */
export const LONG_HAUL_DISTANCE_NM_THRESHOLD = 2000

/** Multiplicateurs de prix fixes par classe, appliqués au prix billet économique — pas de fourchette
 * indépendante à régler par ligne. */
export const BUSINESS_CLASS_PRICE_MULTIPLIER = 3
export const FIRST_CLASS_PRICE_MULTIPLIER = 6

export interface CabinSplit {
  economyShare: number
  businessShare: number
  firstShare: number
}

/**
 * Répartition passagers par classe sur un vol long-courrier, selon le positionnement de la
 * compagnie — une compagnie low-cost n'opère quasiment jamais de vraie cabine business/première en
 * long-courrier, d'où 100 % économique pour ce positionnement.
 */
export const PRICING_TIER_CABIN_SPLIT: Record<PricingTier, CabinSplit> = {
  low_cost: { economyShare: 1, businessShare: 0, firstShare: 0 },
  classic: { economyShare: 0.85, businessShare: 0.13, firstShare: 0.02 },
  premium: { economyShare: 0.7, businessShare: 0.22, firstShare: 0.08 }
}

export function isPricingTier(value: string): value is PricingTier {
  return (PRICING_TIERS as readonly string[]).includes(value)
}

export interface RoutePrice {
  id: number
  companyId: number
  departureIcao: string
  arrivalIcao: string
  ticketPriceMinEur: number
  ticketPriceMaxEur: number
}

export interface RoutePriceInput {
  companyId: number
  departureIcao: string
  arrivalIcao: string
  ticketPriceMinEur: number
  ticketPriceMaxEur: number
}

export interface FlightEconomy {
  flightId: number
  ticketPriceEur: number
  referenceTicketPriceEur: number
  /** >1 sur un vol long-courrier : capture le supplément business/première (voir
   * PRICING_TIER_CABIN_SPLIT), sans fausser ticketPriceEur qui reste le tarif économique affiché. */
  cabinRevenueMultiplier: number
  /** Prix d'un bagage en soute, fixé par la compagnie (Company.baggagePriceEur) — identique sur
   * tous ses vols, à la différence du tarif billet qui varie par ligne. */
  baggagePriceEur: number
  passengersSold: number | null
  /** Tiré au hasard parmi passengersSold à la création du vol (voir resolveCheckedBagsSold), une
   * fois le nombre réel de passagers connu — pas de prix ni de fourchette à régler par ligne. */
  checkedBagsSold: number | null
  revenueEur: number | null
}

export interface FlightEconomyInput {
  flightId: number
  ticketPriceEur: number
  referenceTicketPriceEur: number
  cabinRevenueMultiplier: number
  baggagePriceEur: number
  passengersSold: number | null
}

/** Résultat du calcul de demande, résolu avant réservation SimBrief (voir resolveFlightEconomy). */
export interface ResolvedFlightEconomy {
  ticketPriceEur: number
  referenceTicketPriceEur: number
  cabinRevenueMultiplier: number
  expectedPassengers: number
}

export interface RoutePriceWithStats extends RoutePrice {
  distanceNm: number | null
  referenceTicketPriceEur: number | null
  /** Coût GSX moyen déjà observé sur cette ligne précise, s'il existe un historique de vols. */
  averageGsxCostEur: number | null
  flightsFlown: number
}

export interface CompanyEconomySummary {
  totalRevenueEur: number
  totalCostEur: number
  profitEur: number
  flightsWithData: number
}
