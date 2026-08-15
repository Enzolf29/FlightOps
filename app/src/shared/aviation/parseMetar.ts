export type MetarFlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR'

export interface MetarWind {
  directionDeg: number | null
  variable: boolean
  speedKt: number
  gustKt: number | null
}

export type MetarCloudCoverage = 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV'

export interface MetarCloudLayer {
  coverage: MetarCloudCoverage
  heightFt: number | null
  towering: boolean
}

export type MetarWeatherIcon = 'storm' | 'rain' | 'snow' | 'hail' | 'fog' | 'mist' | 'wind' | 'other'

export interface MetarWeatherGroup {
  raw: string
  icon: MetarWeatherIcon
  description: string
}

export interface ParsedMetar {
  raw: string
  icao: string | null
  dayOfMonth: number | null
  hourUtc: number | null
  minuteUtc: number | null
  auto: boolean
  wind: MetarWind | null
  windVariableRange: { fromDeg: number; toDeg: number } | null
  visibilityMeters: number | null
  cavok: boolean
  weather: MetarWeatherGroup[]
  clouds: MetarCloudLayer[]
  skyClear: boolean
  temperatureC: number | null
  dewpointC: number | null
  altimeterHpa: number | null
  flightCategory: MetarFlightCategory | null
}

const WIND_RE = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/
const WIND_VARIABLE_RE = /^(\d{3})V(\d{3})$/
const CLOUD_RE = /^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/
const VERTICAL_VIS_RE = /^VV(\d{3}|\/\/\/)$/
const CLEAR_SKY_TOKENS = new Set(['NSC', 'NCD', 'CLR', 'SKC'])
const TEMP_DEWPOINT_RE = /^(M?\d{2}|\/\/)\/(M?\d{2}|\/\/)$/
const QNH_RE = /^Q(\d{4})$/
const ALTIMETER_INHG_RE = /^A(\d{4})$/
const RVR_RE = /^R\d{2}[LRC]?\/\S+$/
const STATUTE_MILES_RE = /^(\d+)SM$/

const WEATHER_TOKEN_RE =
  /^([-+]|VC)?((?:MI|PR|BC|DR|BL|SH|TS|FZ)*)((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)+)$/

const DESCRIPTOR_LABEL: Record<string, string> = {
  MI: 'mince',
  PR: 'partiel',
  BC: 'en bancs',
  DR: 'chasse-basse',
  BL: 'chasse élevée',
  SH: 'averses de',
  TS: 'orage avec',
  FZ: 'se congelant'
}

const PHENOMENON_LABEL: Record<string, string> = {
  DZ: 'bruine',
  RA: 'pluie',
  SN: 'neige',
  SG: 'neige en grains',
  IC: 'cristaux de glace',
  PL: 'granules de glace',
  GR: 'grêle',
  GS: 'petite grêle',
  UP: 'précipitation inconnue',
  BR: 'brume',
  FG: 'brouillard',
  FU: 'fumée',
  VA: 'cendres volcaniques',
  DU: 'poussière',
  SA: 'sable',
  HZ: 'brume sèche',
  PO: 'tourbillons de poussière',
  SQ: 'grain',
  FC: 'tornade / trombe',
  SS: 'tempête de sable',
  DS: 'tempête de poussière'
}

const STORM_PHENOMENA = new Set(['TS'])
const RAIN_PHENOMENA = new Set(['DZ', 'RA'])
const SNOW_PHENOMENA = new Set(['SN', 'SG', 'IC', 'PL'])
const HAIL_PHENOMENA = new Set(['GR', 'GS'])
const FOG_PHENOMENA = new Set(['FG', 'BR'])
const WIND_PHENOMENA = new Set(['DR', 'BL', 'SQ', 'FC', 'SS', 'DS', 'PO'])

function parseWeatherToken(token: string): MetarWeatherGroup | null {
  const match = WEATHER_TOKEN_RE.exec(token)
  if (!match) return null
  const [, intensitySymbol, descriptorBlock, phenomenonBlock] = match

  const descriptors = descriptorBlock.match(/../g) ?? []
  const phenomena = phenomenonBlock.match(/../g) ?? []
  const allCodes = [...descriptors, ...phenomena]

  let icon: MetarWeatherIcon = 'other'
  if (allCodes.some((code) => STORM_PHENOMENA.has(code))) icon = 'storm'
  else if (allCodes.some((code) => HAIL_PHENOMENA.has(code))) icon = 'hail'
  else if (allCodes.some((code) => SNOW_PHENOMENA.has(code))) icon = 'snow'
  else if (allCodes.some((code) => RAIN_PHENOMENA.has(code))) icon = 'rain'
  else if (allCodes.some((code) => FOG_PHENOMENA.has(code))) icon = 'fog'
  else if (allCodes.some((code) => WIND_PHENOMENA.has(code))) icon = 'wind'
  else if (allCodes.includes('HZ')) icon = 'mist'

  const words = [
    ...descriptors.map((code) => DESCRIPTOR_LABEL[code] ?? code.toLowerCase()),
    ...phenomena.map((code) => PHENOMENON_LABEL[code] ?? code.toLowerCase())
  ]
  let description = words.join(' ')
  if (intensitySymbol === '-') description += ' légère'
  else if (intensitySymbol === '+') description += ' forte'
  else if (intensitySymbol === 'VC') description = `${description} à proximité`
  description = description.charAt(0).toUpperCase() + description.slice(1)

  return { raw: token, icon, description }
}

function windSpeedToKt(value: number, unit: string): number {
  if (unit === 'MPS') return Math.round(value * 1.94384)
  if (unit === 'KMH') return Math.round(value * 0.539957)
  return value
}

function statuteMilesToMeters(sm: number): number {
  return Math.round(sm * 1609.344)
}

function computeFlightCategory(
  visibilityMeters: number | null,
  cavok: boolean,
  clouds: MetarCloudLayer[]
): MetarFlightCategory | null {
  if (cavok) return 'VFR'

  const ceilingFt = clouds
    .filter((layer) => (layer.coverage === 'BKN' || layer.coverage === 'OVC' || layer.coverage === 'VV') && layer.heightFt !== null)
    .reduce<number | null>((lowest, layer) => (lowest === null || (layer.heightFt as number) < lowest ? layer.heightFt : lowest), null)

  const visibilitySm = visibilityMeters !== null ? visibilityMeters / 1609.344 : null

  if (ceilingFt === null && visibilitySm === null) return null
  if ((ceilingFt !== null && ceilingFt < 500) || (visibilitySm !== null && visibilitySm < 1)) return 'LIFR'
  if ((ceilingFt !== null && ceilingFt < 1000) || (visibilitySm !== null && visibilitySm < 3)) return 'IFR'
  if ((ceilingFt !== null && ceilingFt < 3000) || (visibilitySm !== null && visibilitySm < 5)) return 'MVFR'
  return 'VFR'
}

/**
 * Décodage best-effort d'un METAR brut en champs structurés, pour un affichage synthétique avec
 * icônes. Ne vise pas une conformité stricte OACI Annexe 3 (groupes RVR/tendance/RMK ignorés) —
 * juste les éléments utiles à un pilote virtuel : vent, visibilité, temps sensible, nuages,
 * température/point de rosée, QNH et catégorie de vol (VFR/MVFR/IFR/LIFR).
 */
export function parseMetar(rawInput: string): ParsedMetar {
  const raw = rawInput.trim()
  const tokens = raw.toUpperCase().split(/\s+/).filter(Boolean)

  let i = 0
  if (tokens[i] === 'METAR' || tokens[i] === 'SPECI') i++

  let icao: string | null = null
  if (/^[A-Z]{4}$/.test(tokens[i] ?? '')) {
    icao = tokens[i]
    i++
  }

  let dayOfMonth: number | null = null
  let hourUtc: number | null = null
  let minuteUtc: number | null = null
  if (/^\d{6}Z$/.test(tokens[i] ?? '')) {
    const digits = tokens[i]
    dayOfMonth = Number(digits.slice(0, 2))
    hourUtc = Number(digits.slice(2, 4))
    minuteUtc = Number(digits.slice(4, 6))
    i++
  }

  let auto = false
  if (tokens[i] === 'AUTO') {
    auto = true
    i++
  }
  if (tokens[i] === 'COR') i++

  let wind: MetarWind | null = null
  const windMatch = WIND_RE.exec(tokens[i] ?? '')
  if (windMatch) {
    const [, direction, speed, gust, unit] = windMatch
    wind = {
      directionDeg: direction === 'VRB' ? null : Number(direction),
      variable: direction === 'VRB',
      speedKt: windSpeedToKt(Number(speed), unit),
      gustKt: gust ? windSpeedToKt(Number(gust), unit) : null
    }
    i++
  }

  let windVariableRange: { fromDeg: number; toDeg: number } | null = null
  const variableMatch = WIND_VARIABLE_RE.exec(tokens[i] ?? '')
  if (variableMatch) {
    windVariableRange = { fromDeg: Number(variableMatch[1]), toDeg: Number(variableMatch[2]) }
    i++
  }

  let visibilityMeters: number | null = null
  let cavok = false
  const weather: MetarWeatherGroup[] = []
  const clouds: MetarCloudLayer[] = []
  let skyClear = false
  let temperatureC: number | null = null
  let dewpointC: number | null = null
  let altimeterHpa: number | null = null

  while (i < tokens.length) {
    const token = tokens[i]
    if (token === 'RMK') break

    if (token === 'CAVOK') {
      cavok = true
      visibilityMeters = 9999
      i++
      continue
    }

    if (/^\d{4}$/.test(token) && visibilityMeters === null) {
      visibilityMeters = Number(token)
      i++
      continue
    }

    const smMatch = STATUTE_MILES_RE.exec(token)
    if (smMatch && visibilityMeters === null) {
      visibilityMeters = statuteMilesToMeters(Number(smMatch[1]))
      i++
      continue
    }

    if (RVR_RE.test(token)) {
      i++
      continue
    }

    const cloudMatch = CLOUD_RE.exec(token)
    if (cloudMatch) {
      const [, coverage, heightHundredsFt, special] = cloudMatch
      clouds.push({
        coverage: coverage as MetarCloudCoverage,
        heightFt: Number(heightHundredsFt) * 100,
        towering: Boolean(special)
      })
      i++
      continue
    }

    const verticalVisMatch = VERTICAL_VIS_RE.exec(token)
    if (verticalVisMatch) {
      clouds.push({
        coverage: 'VV',
        heightFt: verticalVisMatch[1] === '///' ? null : Number(verticalVisMatch[1]) * 100,
        towering: false
      })
      i++
      continue
    }

    if (CLEAR_SKY_TOKENS.has(token)) {
      skyClear = true
      i++
      continue
    }

    const tempMatch = TEMP_DEWPOINT_RE.exec(token)
    if (tempMatch && temperatureC === null) {
      const [, temp, dew] = tempMatch
      temperatureC = temp === '//' ? null : Number(temp.replace('M', '-'))
      dewpointC = dew === '//' ? null : Number(dew.replace('M', '-'))
      i++
      continue
    }

    const qnhMatch = QNH_RE.exec(token)
    if (qnhMatch) {
      altimeterHpa = Number(qnhMatch[1])
      i++
      continue
    }

    const inHgMatch = ALTIMETER_INHG_RE.exec(token)
    if (inHgMatch) {
      altimeterHpa = Math.round((Number(inHgMatch[1]) / 100) * 33.8639)
      i++
      continue
    }

    const weatherGroup = parseWeatherToken(token)
    if (weatherGroup) {
      weather.push(weatherGroup)
      i++
      continue
    }

    i++
  }

  return {
    raw,
    icao,
    dayOfMonth,
    hourUtc,
    minuteUtc,
    auto,
    wind,
    windVariableRange,
    visibilityMeters,
    cavok,
    weather,
    clouds,
    skyClear,
    temperatureC,
    dewpointC,
    altimeterHpa,
    flightCategory: computeFlightCategory(visibilityMeters, cavok, clouds)
  }
}
