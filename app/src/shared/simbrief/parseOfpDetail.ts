/**
 * Extrait les informations riches (route, navlog, loadsheet, météo de planification) depuis le
 * JSON brut d'un OFP SimBrief déjà stocké (`flights.simbrief_ofp_json`). Les noms de champs ont été
 * vérifiés sur un OFP réel (voir historique) plutôt que devinés — mais restent non garantis par
 * SimBrief/Navigraph d'une version à l'autre, d'où le parsing entièrement défensif : tout champ
 * manquant retombe sur `null`/`[]` plutôt que de faire planter l'affichage.
 */

import { averageWind } from './averageWind'
import type { Wind } from './averageWind'

export interface OfpNavlogFix {
  ident: string
  name: string
  type: string
  lat: number
  lon: number
  altitudeFeet: number
  stage: string
  viaAirway: string
  isSidStar: boolean
  windDirDegrees: number | null
  windSpeedKt: number | null
}

export interface OfpAirportSummary {
  icaoCode: string
  name: string | null
  lat: number
  lon: number
  planRunway: string | null
  metar: string | null
  metarTime: string | null
  taf: string | null
}

export interface OfpLoadsheet {
  units: 'kgs' | 'lbs'
  oew: number | null
  paxCount: number | null
  cargo: number | null
  payload: number | null
  estZfw: number | null
  maxZfw: number | null
  estTow: number | null
  maxTow: number | null
  estLdw: number | null
  maxLdw: number | null
  estRamp: number | null
  fuelTaxi: number | null
  fuelTakeoff: number | null
  fuelLanding: number | null
  fuelReserve: number | null
  fuelContingency: number | null
  fuelExtra: number | null
  fuelRamp: number | null
}

export interface OfpDetail {
  route: string | null
  sidIdent: string | null
  starIdent: string | null
  cruiseAltitudeFeet: number | null
  costIndex: number | null
  routeDistanceNm: number | null
  isaDeviationCelsius: number | null
  origin: OfpAirportSummary | null
  destination: OfpAirportSummary | null
  alternate: OfpAirportSummary | null
  navlog: OfpNavlogFix[]
  loadsheet: OfpLoadsheet | null
  aircraftRegistration: string | null
  climbAvgWind: Wind | null
  cruiseAvgWind: Wind | null
  descentAvgWind: Wind | null
  /** Plan de vol séparé vers l'aéroport alternatif (calculé par SimBrief indépendamment de la route
   * principale) — utile pour un résumé "et si je déroute" (cap, altitude, distance, carburant). */
  alternateRoute: string | null
  alternateCruiseAltitudeFeet: number | null
  alternateDistanceNm: number | null
  alternateEteMinutes: number | null
  alternateBurn: number | null
  alternateNavlog: OfpNavlogFix[]
  /** Lien vers le dossier de vol complet généré par SimBrief au format PDF. */
  briefingPdfUrl: string | null
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'object') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value
}

function parseBriefingPdfUrl(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  const downloads = raw as Record<string, unknown>
  const directory = toStringOrNull(downloads.directory)
  const pdf = typeof downloads.pdf === 'object' && downloads.pdf !== null
    ? downloads.pdf as Record<string, unknown>
    : null
  const link = pdf ? toStringOrNull(pdf.link) : null
  if (!link) return null

  let parsed: URL
  try {
    parsed = new URL(link, directory ?? undefined)
  } catch {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  if (parsed.protocol !== 'https:' || (hostname !== 'simbrief.com' && !hostname.endsWith('.simbrief.com'))) {
    return null
  }
  return parsed.toString()
}

function parseAirport(raw: unknown): OfpAirportSummary | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  const icaoCode = toStringOrNull(obj.icao_code)
  const lat = toNumber(obj.pos_lat)
  const lon = toNumber(obj.pos_long)
  if (!icaoCode || lat === null || lon === null) return null

  return {
    icaoCode,
    name: toStringOrNull(obj.name),
    lat,
    lon,
    planRunway: toStringOrNull(obj.plan_rwy),
    metar: toStringOrNull(obj.metar),
    metarTime: toStringOrNull(obj.metar_time),
    taf: toStringOrNull(obj.taf)
  }
}

function parseNavlog(raw: unknown): OfpNavlogFix[] {
  if (typeof raw !== 'object' || raw === null) return []
  const fixArray = (raw as Record<string, unknown>).fix
  if (!Array.isArray(fixArray)) return []

  const fixes: OfpNavlogFix[] = []
  for (const entry of fixArray) {
    if (typeof entry !== 'object' || entry === null) continue
    const obj = entry as Record<string, unknown>
    const lat = toNumber(obj.pos_lat)
    const lon = toNumber(obj.pos_long)
    if (lat === null || lon === null) continue

    fixes.push({
      ident: toStringOrNull(obj.ident) ?? '',
      name: toStringOrNull(obj.name) ?? '',
      type: toStringOrNull(obj.type) ?? '',
      lat,
      lon,
      altitudeFeet: toNumber(obj.altitude_feet) ?? 0,
      stage: toStringOrNull(obj.stage) ?? '',
      viaAirway: toStringOrNull(obj.via_airway) ?? '',
      isSidStar: obj.is_sid_star === '1',
      windDirDegrees: toNumber(obj.wind_dir),
      windSpeedKt: toNumber(obj.wind_spd)
    })
  }
  return fixes
}

function averageWindForStage(navlog: OfpNavlogFix[], stage: string): Wind | null {
  const winds: Wind[] = []
  for (const fix of navlog) {
    if (fix.stage !== stage || fix.windDirDegrees === null || fix.windSpeedKt === null) continue
    winds.push({ dirDegrees: fix.windDirDegrees, speedKt: fix.windSpeedKt })
  }
  return averageWind(winds)
}

function parseLoadsheet(weights: unknown, fuel: unknown, units: unknown): OfpLoadsheet | null {
  if (typeof weights !== 'object' || weights === null || typeof fuel !== 'object' || fuel === null) return null
  const w = weights as Record<string, unknown>
  const f = fuel as Record<string, unknown>

  return {
    units: units === 'lbs' ? 'lbs' : 'kgs',
    oew: toNumber(w.oew),
    paxCount: toNumber(w.pax_count),
    cargo: toNumber(w.cargo),
    payload: toNumber(w.payload),
    estZfw: toNumber(w.est_zfw),
    maxZfw: toNumber(w.max_zfw),
    estTow: toNumber(w.est_tow),
    maxTow: toNumber(w.max_tow),
    estLdw: toNumber(w.est_ldw),
    maxLdw: toNumber(w.max_ldw),
    estRamp: toNumber(w.est_ramp),
    fuelTaxi: toNumber(f.taxi),
    fuelTakeoff: toNumber(f.plan_takeoff),
    fuelLanding: toNumber(f.plan_landing),
    fuelReserve: toNumber(f.reserve),
    fuelContingency: toNumber(f.contingency),
    fuelExtra: toNumber(f.extra),
    fuelRamp: toNumber(f.plan_ramp)
  }
}

export function parseOfpDetail(rawJson: string): OfpDetail | null {
  let data: unknown
  try {
    data = JSON.parse(rawJson)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null

  const root = data as Record<string, unknown>
  const general = (typeof root.general === 'object' && root.general !== null ? root.general : {}) as Record<
    string,
    unknown
  >
  const aircraft = (typeof root.aircraft === 'object' && root.aircraft !== null ? root.aircraft : {}) as Record<
    string,
    unknown
  >
  const params = (typeof root.params === 'object' && root.params !== null ? root.params : {}) as Record<
    string,
    unknown
  >

  const navlog = parseNavlog(root.navlog)
  const alternateNavlog = parseNavlog(root.alternate_navlog)
  const alternateRaw = (typeof root.alternate === 'object' && root.alternate !== null ? root.alternate : {}) as Record<
    string,
    unknown
  >
  const alternateEteSeconds = toNumber(alternateRaw.ete)

  return {
    route: toStringOrNull(general.route),
    sidIdent: toStringOrNull(general.sid_ident),
    starIdent: toStringOrNull(general.star_ident),
    cruiseAltitudeFeet: toNumber(general.initial_altitude),
    costIndex: toNumber(general.costindex),
    routeDistanceNm: toNumber(general.route_distance),
    isaDeviationCelsius: toNumber(general.avg_temp_dev),
    origin: parseAirport(root.origin),
    destination: parseAirport(root.destination),
    alternate: parseAirport(root.alternate),
    navlog,
    loadsheet: parseLoadsheet(root.weights, root.fuel, params.units),
    aircraftRegistration: toStringOrNull(aircraft.reg),
    climbAvgWind: averageWindForStage(navlog, 'CLB'),
    cruiseAvgWind: averageWindForStage(navlog, 'CRZ'),
    descentAvgWind: averageWindForStage(navlog, 'DSC'),
    alternateRoute: toStringOrNull(alternateRaw.route),
    alternateCruiseAltitudeFeet: toNumber(alternateRaw.cruise_altitude),
    alternateDistanceNm: toNumber(alternateRaw.distance),
    alternateEteMinutes: alternateEteSeconds !== null ? Math.round(alternateEteSeconds / 60) : null,
    alternateBurn: toNumber(alternateRaw.burn),
    alternateNavlog,
    briefingPdfUrl: parseBriefingPdfUrl(root.fms_downloads)
  }
}
