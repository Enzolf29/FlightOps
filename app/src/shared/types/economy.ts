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

/** Tarif fret de référence €/kg — le marché du fret aérien ne se différencie pas par positionnement
 * compagnie comme le prix du billet passager. */
export const REFERENCE_CARGO_PRICE_EUR_PER_KG = 3

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
  cargoPriceMinEurPerKg: number
  cargoPriceMaxEurPerKg: number
}

export interface RoutePriceInput {
  companyId: number
  departureIcao: string
  arrivalIcao: string
  ticketPriceMinEur: number
  ticketPriceMaxEur: number
  cargoPriceMinEurPerKg: number
  cargoPriceMaxEurPerKg: number
}

export interface FlightEconomy {
  flightId: number
  ticketPriceEur: number
  cargoPriceEurPerKg: number
  referenceTicketPriceEur: number
  referenceCargoPriceEurPerKg: number
  /** >1 sur un vol long-courrier : capture le supplément business/première (voir
   * PRICING_TIER_CABIN_SPLIT), sans fausser ticketPriceEur qui reste le tarif économique affiché. */
  cabinRevenueMultiplier: number
  passengersSold: number | null
  cargoKgSold: number | null
  revenueEur: number | null
}

export interface FlightEconomyInput {
  flightId: number
  ticketPriceEur: number
  cargoPriceEurPerKg: number
  referenceTicketPriceEur: number
  referenceCargoPriceEurPerKg: number
  cabinRevenueMultiplier: number
  passengersSold: number | null
  cargoKgSold: number | null
}

/** Résultat du calcul de demande, résolu avant réservation SimBrief (voir resolveFlightEconomy). */
export interface ResolvedFlightEconomy {
  ticketPriceEur: number
  cargoPriceEurPerKg: number
  referenceTicketPriceEur: number
  referenceCargoPriceEurPerKg: number
  cabinRevenueMultiplier: number
  expectedPassengers: number
  expectedCargoKg: number
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
