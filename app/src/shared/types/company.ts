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
}

export interface CompanyPatch {
  displayName?: string
  radioCallsign?: string
  callsignPattern?: CallsignPattern
  active?: boolean
}
