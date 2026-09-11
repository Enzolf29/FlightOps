export const PRICING_TIERS = ['low_cost', 'classic', 'premium'] as const
export type PricingTier = (typeof PRICING_TIERS)[number]

export const PRICING_TIER_LABEL: Record<PricingTier, string> = {
  low_cost: 'Low-cost',
  classic: 'Classique',
  premium: 'Premium'
}

/**
 * Tarif de référence €/NM par positionnement compagnie — moyennes réelles observées en Europe
 * (2026) entre compagnies ultra low-cost et réseaux premium. Fixe et non modifiable par le joueur :
 * c'est le "juste prix" qui détermine la demande, seul le tarif réellement pratiqué se règle.
 */
export const PRICING_TIER_REFERENCE_FARE_PER_NM: Record<PricingTier, number> = {
  low_cost: 0.08,
  classic: 0.15,
  premium: 0.25
}

/** Tarif fret de référence €/kg — le marché du fret aérien ne se différencie pas par positionnement
 * compagnie comme le prix du billet passager. */
export const REFERENCE_CARGO_PRICE_EUR_PER_KG = 3

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
  passengersSold: number | null
  cargoKgSold: number | null
}

/** Résultat du calcul de demande, résolu avant réservation SimBrief (voir resolveFlightEconomy). */
export interface ResolvedFlightEconomy {
  ticketPriceEur: number
  cargoPriceEurPerKg: number
  referenceTicketPriceEur: number
  referenceCargoPriceEurPerKg: number
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
