import { describe, expect, it } from 'vitest'
import { extractFlightNumberFromCallsign } from './extractFlightNumberFromCallsign'

describe('extractFlightNumberFromCallsign', () => {
  it('extrait le suffixe quand le callsign correspond à la compagnie', () => {
    expect(extractFlightNumberFromCallsign('AFR1445', 'AFR')).toBe('1445')
  })

  it('ignore la casse et les espaces (padding OpenSky)', () => {
    expect(extractFlightNumberFromCallsign('afr1445  ', 'AFR')).toBe('1445')
    expect(extractFlightNumberFromCallsign('AFR1445', 'afr')).toBe('1445')
  })

  it("retourne null si le callsign n'appartient pas à la compagnie", () => {
    expect(extractFlightNumberFromCallsign('BAW123', 'AFR')).toBeNull()
  })

  it("retourne null si aucun suffixe n'est présent après le préfixe", () => {
    expect(extractFlightNumberFromCallsign('AFR', 'AFR')).toBeNull()
  })

  it('retourne null si le suffixe est trop long ou contient des caractères invalides', () => {
    expect(extractFlightNumberFromCallsign('AFR12345', 'AFR')).toBeNull()
    expect(extractFlightNumberFromCallsign('AFR-44', 'AFR')).toBeNull()
  })
})
