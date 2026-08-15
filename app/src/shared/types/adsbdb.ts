export interface AdsbdbAircraftLookup {
  registration: string
  icaoType: string | null
  typeDescription: string
  manufacturer: string | null
  modeS: string | null
  registeredOwner: string | null
  registeredOwnerIcaoCode: string | null
  registeredOwnerCountry: string | null
}
