import { getAirportCoordinates } from '@shared/airports/airportCoordinates'
import { resolveFlightEconomy } from '@shared/economy/resolveFlightEconomy'
import { PRICING_TIER_CABIN_SPLIT, PRICING_TIER_FARE_MODEL } from '@shared/types/economy'
import type { PricingTier, RoutePrice } from '@shared/types/economy'
import type { CreateFlightFromOfpEconomyInput } from '@shared/types/booking'

export interface BookingEconomyResolution {
  economyInput: CreateFlightFromOfpEconomyInput
  expectedPassengers: number
  expectedCargoKg: number
}

/** Résout le prix pratiqué et la demande attendue pour un vol au moment de sa réservation, avant
 * d'ouvrir SimBrief — voir resolveFlightEconomy pour le détail du calcul. Renvoie null si les
 * coordonnées d'un des deux aéroports sont inconnues (impossible de calculer une distance). */
export function resolveBookingEconomy(
  routePrice: RoutePrice,
  pricingTier: PricingTier,
  seatCapacity: number,
  cargoCapacityKg: number,
  airportSurchargeFraction: number
): BookingEconomyResolution | null {
  const origin = getAirportCoordinates(routePrice.departureIcao)
  const dest = getAirportCoordinates(routePrice.arrivalIcao)
  if (!origin || !dest) return null

  const resolved = resolveFlightEconomy({
    referenceFareModel: PRICING_TIER_FARE_MODEL[pricingTier],
    airportSurchargeFraction,
    cabinSplit: PRICING_TIER_CABIN_SPLIT[pricingTier],
    routePrice,
    originLat: origin.lat,
    originLon: origin.lon,
    destLat: dest.lat,
    destLon: dest.lon,
    seatCapacity,
    cargoCapacityKg
  })

  return {
    economyInput: {
      ticketPriceEur: resolved.ticketPriceEur,
      cargoPriceEurPerKg: resolved.cargoPriceEurPerKg,
      referenceTicketPriceEur: resolved.referenceTicketPriceEur,
      referenceCargoPriceEurPerKg: resolved.referenceCargoPriceEurPerKg,
      cabinRevenueMultiplier: resolved.cabinRevenueMultiplier
    },
    expectedPassengers: resolved.expectedPassengers,
    expectedCargoKg: resolved.expectedCargoKg
  }
}
