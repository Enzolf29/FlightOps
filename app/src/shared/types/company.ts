import type { PricingTier } from './economy'

/** RANDOM = la compagnie n'est pas limitée à un format fixe : un pattern est tiré au hasard parmi les 4 à chaque vol. */
export type CallsignPattern = 'XXX0000' | 'XXX000' | 'XXX00AB' | 'XXX00A' | 'RANDOM'

export interface Company {
  id: number
  icaoCode: string
  iataCode: string
  radioCallsign: string
  displayName: string
  logoFilename: string
  callsignPattern: CallsignPattern
  active: boolean
  /** Positionnement tarifaire (mode économie) — détermine le tarif de référence €/NM, fixe. */
  pricingTier: PricingTier
  /** Prix d'un bagage en soute (mode économie) — politique compagnie modifiable, identique sur
   * tous ses vols (contrairement au tarif billet, qui se règle ligne par ligne). */
  baggagePriceEur: number
}

export interface CompanyPatch {
  displayName?: string
  radioCallsign?: string
  callsignPattern?: CallsignPattern
  active?: boolean
  pricingTier?: PricingTier
  baggagePriceEur?: number
}
