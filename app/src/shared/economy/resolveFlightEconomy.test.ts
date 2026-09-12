import { describe, expect, it } from 'vitest'
import {
  computeCabinRevenueMultiplier,
  computeLoadFactor,
  computeReferenceTicketPriceEur,
  resolveFlightEconomy
} from './resolveFlightEconomy'
import { PRICING_TIER_CABIN_SPLIT, PRICING_TIER_FARE_MODEL } from '../types/economy'
import { greatCircleDistanceNm } from '../flightStatus/computeFlightDistanceProgress'

/** Retourne les valeurs fournies dans l'ordre à chaque appel, pour des tests déterministes. */
function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[Math.min(index, values.length - 1)]
    index += 1
    return value
  }
}

describe('computeLoadFactor', () => {
  it('stays at full load (before jitter) when the price is at or below the reference', () => {
    expect(computeLoadFactor(1, () => 0.5)).toBeCloseTo(1 * (0.85 + 0.5 * 0.3), 5)
    expect(computeLoadFactor(0.5, () => 0.5)).toBeCloseTo(1 * (0.85 + 0.5 * 0.3), 5)
  })

  it('drops load factor as the price ratio grows above the reference', () => {
    const noJitter = () => 0.5 // milieu de la plage de jitter, constant pour comparer uniquement l'effet du ratio
    const atReference = computeLoadFactor(1, noJitter)
    const doublePrice = computeLoadFactor(2, noJitter)
    const triplePrice = computeLoadFactor(3, noJitter)
    expect(doublePrice).toBeLessThan(atReference)
    expect(triplePrice).toBeLessThan(doublePrice)
  })

  it('never goes below the minimum load factor floor or above 100%', () => {
    expect(computeLoadFactor(100, () => 0)).toBeGreaterThanOrEqual(0.1)
    expect(computeLoadFactor(0, () => 1)).toBeLessThanOrEqual(1)
  })
})

describe('computeReferenceTicketPriceEur', () => {
  it('keeps a realistic floor for short/medium routes thanks to the fixed base fare', () => {
    // Brest (LFRB) -> Paris CDG (LFPG), ~278 NM à vol d'oiseau — vraies fourchettes observées :
    // 80-250€ selon le sens. Un modèle purement distance × tarif donnerait ~42€ (bien trop bas) ;
    // la part fixe ramène la référence dans une fourchette plausible.
    const distanceNm = greatCircleDistanceNm(48.4479, -4.4185, 49.009, 2.5541)
    const reference = computeReferenceTicketPriceEur(PRICING_TIER_FARE_MODEL.classic, distanceNm)
    expect(reference).toBeGreaterThan(80)
    expect(reference).toBeLessThan(180)
  })

  it('scales up with distance on top of the fixed base fare', () => {
    const short = computeReferenceTicketPriceEur(PRICING_TIER_FARE_MODEL.classic, 100)
    const long = computeReferenceTicketPriceEur(PRICING_TIER_FARE_MODEL.classic, 1000)
    expect(long).toBeGreaterThan(short)
    expect(short).toBeGreaterThan(PRICING_TIER_FARE_MODEL.classic.baseFareEur)
  })
})

describe('computeCabinRevenueMultiplier', () => {
  it('stays at 1 below the long-haul threshold, regardless of cabin split', () => {
    expect(computeCabinRevenueMultiplier(PRICING_TIER_CABIN_SPLIT.premium, 1999)).toBe(1)
  })

  it('blends the per-class multipliers above the long-haul threshold', () => {
    const multiplier = computeCabinRevenueMultiplier(PRICING_TIER_CABIN_SPLIT.classic, 3000)
    // 0.85×1 + 0.13×3 + 0.02×6 = 0.85 + 0.39 + 0.12 = 1.36
    expect(multiplier).toBeCloseTo(1.36, 5)
  })

  it('never raises revenue for a low-cost long-haul flight (100% economy split)', () => {
    expect(computeCabinRevenueMultiplier(PRICING_TIER_CABIN_SPLIT.low_cost, 5000)).toBe(1)
  })
})

describe('resolveFlightEconomy', () => {
  const baseInput = {
    // Base à 0 dans ces tests : on isole l'effet de la part au NM (déjà couverte séparément
    // ci-dessus) pour ne pas casser les valeurs numériques attendues plus bas.
    referenceFareModel: { baseFareEur: 0, perNmEur: 0.1 },
    airportSurchargeFraction: 0,
    routeSurchargeFraction: 0,
    cabinSplit: PRICING_TIER_CABIN_SPLIT.classic,
    routePrice: {
      ticketPriceMinEur: 80,
      ticketPriceMaxEur: 120
    },
    // LFPG -> LFML (Paris-Marseille, ~400 NM) : distance assez longue pour que le prix de
    // référence (~40€ à 0,1€/NM) distingue vraiment un tarif raisonnable d'un tarif abusif.
    originLat: 49.0097,
    originLon: 2.5479,
    destLat: 43.4393,
    destLon: 5.2214,
    seatCapacity: 180
  }

  it('draws the ticket price linearly within the configured range', () => {
    // random() = 0 -> borne basse, puis jitter demande
    const result = resolveFlightEconomy(baseInput, sequenceRandom([0, 0.5]))
    expect(result.ticketPriceEur).toBe(80)
  })

  it('computes the reference ticket price from great-circle distance × tier fare per NM', () => {
    const result = resolveFlightEconomy(baseInput, sequenceRandom([0, 0.5]))
    // ~400 NM à vol d'oiseau × 0,1 €/NM -> référence de l'ordre de 30-50€
    expect(result.referenceTicketPriceEur).toBeGreaterThan(20)
    expect(result.referenceTicketPriceEur).toBeLessThan(60)
  })

  it('raises the reference ticket price by the airport and route surcharge fractions', () => {
    const withoutSurcharge = resolveFlightEconomy(baseInput, sequenceRandom([0, 0.5]))
    const withSurcharge = resolveFlightEconomy(
      { ...baseInput, airportSurchargeFraction: 0.15, routeSurchargeFraction: 0.1 },
      sequenceRandom([0, 0.5])
    )
    expect(withSurcharge.referenceTicketPriceEur).toBeCloseTo(withoutSurcharge.referenceTicketPriceEur * 1.25, 1)
  })

  it('yields far fewer expected passengers when priced well above the reference than at the floor price', () => {
    const cheap = resolveFlightEconomy(baseInput, sequenceRandom([0, 0.5]))
    const expensive = resolveFlightEconomy(
      { ...baseInput, routePrice: { ticketPriceMinEur: 500, ticketPriceMaxEur: 500 } },
      sequenceRandom([0, 0.5])
    )
    expect(expensive.expectedPassengers).toBeLessThan(cheap.expectedPassengers)
  })

  it('keeps a cabin revenue multiplier of 1 on a medium-haul route below the long-haul threshold', () => {
    const result = resolveFlightEconomy(baseInput, sequenceRandom([0, 0.5]))
    expect(result.cabinRevenueMultiplier).toBe(1)
  })

  it('raises the cabin revenue multiplier on a long-haul route', () => {
    const result = resolveFlightEconomy(
      { ...baseInput, originLat: 49.0097, originLon: 2.5479, destLat: 25.2532, destLon: 55.3657 }, // Paris -> Dubaï, long-courrier
      sequenceRandom([0, 0.5])
    )
    expect(result.cabinRevenueMultiplier).toBeGreaterThan(1)
  })

  it('never exceeds seat capacity', () => {
    const result = resolveFlightEconomy(
      { ...baseInput, routePrice: { ticketPriceMinEur: 0.01, ticketPriceMaxEur: 0.01 } },
      sequenceRandom([0, 1])
    )
    expect(result.expectedPassengers).toBeLessThanOrEqual(baseInput.seatCapacity)
  })
})
