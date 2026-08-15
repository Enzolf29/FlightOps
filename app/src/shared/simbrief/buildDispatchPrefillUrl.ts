import { format } from 'date-fns'

export interface DispatchPrefillParams {
  originIcao: string
  destIcao: string
  aircraftIcaoType: string
  airlineIcao: string
  flightNumberDigits?: string
  registration?: string | null
  /**
   * Internal ID d'un profil avion sauvegardé sur SimBrief (visible en haut de la fiche airframe).
   * Non utilisable ici : d'après le guide officiel de redirection dispatch.simbrief.com, `type`
   * attend un vrai code ICAO (ex. B738), et la substitution par l'Internal ID n'est documentée que
   * pour l'API SimBrief (génération programmatique), pas pour ce formulaire web prérempli par URL —
   * l'envoyer dans `type` ici est silencieusement ignoré par SimBrief. Le champ reste stocké côté
   * flotte pour le jour où l'app générera les plans via l'API plutôt que via cette redirection.
   */
  simbriefFin?: string | null
  callsign?: string | null
  scheduledDeparture: Date
  scheduledArrival?: Date | null
}

/**
 * Construit l'URL de préremplissage du formulaire dispatch.simbrief.com. Paramètres d'après le
 * "Dispatch Redirect Guide" communautaire (forum Navigraph) — non versionné officiellement par
 * SimBrief, à revalider manuellement si le formulaire change.
 */
export function buildDispatchPrefillUrl(params: DispatchPrefillParams): string {
  const url = new URL('https://dispatch.simbrief.com/options/custom')

  url.searchParams.set('orig', params.originIcao)
  url.searchParams.set('dest', params.destIcao)
  url.searchParams.set('airline', params.airlineIcao)
  if (params.flightNumberDigits) {
    url.searchParams.set('fltnum', params.flightNumberDigits)
  }

  url.searchParams.set('type', params.aircraftIcaoType)
  if (params.registration) {
    url.searchParams.set('reg', params.registration)
  }

  if (params.callsign) {
    url.searchParams.set('callsign', params.callsign)
  }

  url.searchParams.set('date', format(params.scheduledDeparture, 'ddLLLyy').toUpperCase())
  url.searchParams.set('deph', String(params.scheduledDeparture.getUTCHours()))
  url.searchParams.set('depm', String(params.scheduledDeparture.getUTCMinutes()))

  if (params.scheduledArrival) {
    const durationMinutesTotal = Math.round(
      (params.scheduledArrival.getTime() - params.scheduledDeparture.getTime()) / 60000
    )
    if (durationMinutesTotal > 0) {
      url.searchParams.set('steh', String(Math.floor(durationMinutesTotal / 60)))
      url.searchParams.set('stem', String(durationMinutesTotal % 60))
    }
  }

  return url.toString()
}
