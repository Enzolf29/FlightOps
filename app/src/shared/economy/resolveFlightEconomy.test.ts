import { describe, expect, it } from 'vitest'
import { computeLoadFactor, resolveFlightEconomy } from './resolveFlightEconomy'

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

describe('resolveFlightEconomy', () => {
  const baseInput = {
    referenceFarePerNm: 0.1,
    routePrice: {
      ticketPriceMinEur: 80,
      ticketPriceMaxEur: 120,
      cargoPriceMinEurPerKg: 2,
      cargoPriceMaxEurPerKg: 4
    },
    // LFPG -> LFML (Paris-Marseille, ~400 NM) : distance assez longue pour que le prix de
    // référence (~40€ à 0,1€/NM) distingue vraiment un tarif raisonnable d'un tarif abusif.
    originLat: 49.0097,
    originLon: 2.5479,
    destLat: 43.4393,
    destLon: 5.2214,
    seatCapacity: 180,
    cargoCapacityKg: 2000
  }

  it('draws the ticket and cargo price linearly within the configured range', () => {
    // random() = 0 -> borne basse, 0.5 -> milieu de la fourchette prix, puis jitter demande
    const result = resolveFlightEconomy(baseInput, sequenceRandom([0, 0.5, 0.5, 0.5]))
    expect(result.ticketPriceEur).toBe(80)
    expect(result.cargoPriceEurPerKg).toBe(3)
  })

  it('computes the reference ticket price from great-circle distance × tier fare per NM', () => {
    const result = resolveFlightEconomy(baseInput, sequenceRandom([0, 0, 0.5, 0.5]))
    // ~400 NM à vol d'oiseau × 0,1 €/NM -> référence de l'ordre de 30-50€
    expect(result.referenceTicketPriceEur).toBeGreaterThan(20)
    expect(result.referenceTicketPriceEur).toBeLessThan(60)
  })

  it('yields far fewer expected passengers when priced well above the reference than at the floor price', () => {
    const cheap = resolveFlightEconomy(baseInput, sequenceRandom([0, 0, 0.5, 0.5]))
    const expensive = resolveFlightEconomy(
      { ...baseInput, routePrice: { ...baseInput.routePrice, ticketPriceMinEur: 500, ticketPriceMaxEur: 500 } },
      sequenceRandom([0, 0, 0.5, 0.5])
    )
    expect(expensive.expectedPassengers).toBeLessThan(cheap.expectedPassengers)
  })

  it('never exceeds seat or cargo capacity', () => {
    const result = resolveFlightEconomy(
      { ...baseInput, routePrice: { ...baseInput.routePrice, ticketPriceMinEur: 0.01, ticketPriceMaxEur: 0.01 } },
      sequenceRandom([0, 0, 1, 1])
    )
    expect(result.expectedPassengers).toBeLessThanOrEqual(baseInput.seatCapacity)
    expect(result.expectedCargoKg).toBeLessThanOrEqual(baseInput.cargoCapacityKg)
  })
})
