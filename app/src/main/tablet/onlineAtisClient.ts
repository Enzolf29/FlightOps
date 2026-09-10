export type OnlineAtisNetwork = 'vatsim' | 'ivao'

export interface OnlineAtisStation {
  callsign: string
  frequency: string | null
  information: string | null
  lines: string[]
}

export interface OnlineAtisResult {
  network: OnlineAtisNetwork
  icao: string
  stations: OnlineAtisStation[]
}

const VATSIM_DATA_URL = 'https://data.vatsim.net/v3/vatsim-data.json'
const IVAO_WHAZZUP_URL = 'https://api.ivao.aero/v2/tracker/whazzup'
const CACHE_DURATION_MS = 15_000
const REQUEST_TIMEOUT_MS = 8_000

const payloadCache = new Map<OnlineAtisNetwork, { fetchedAt: number; payload: unknown }>()

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function asLines(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter((line): line is string => line !== null)
}

function isAirportStation(callsign: string, icao: string): boolean {
  const stationPrefix = callsign.toUpperCase().split('_')[0]
  if (stationPrefix === icao) return true

  // Aux États-Unis et au Canada, les positions réseau utilisent souvent le préfixe à trois
  // lettres (JFK_TWR) alors que l'aéroport est identifié par son OACI complet (KJFK).
  return /^[KCP][A-Z0-9]{3}$/.test(icao) && stationPrefix === icao.slice(1)
}

function sortStations(stations: OnlineAtisStation[]): OnlineAtisStation[] {
  const priority = (callsign: string): number => {
    if (callsign.endsWith('_ATIS')) return 0
    if (callsign.includes('_TWR')) return 1
    if (callsign.includes('_APP') || callsign.includes('_DEP')) return 2
    if (callsign.includes('_GND') || callsign.includes('_DEL')) return 3
    return 4
  }
  return stations.sort((left, right) => priority(left.callsign) - priority(right.callsign) || left.callsign.localeCompare(right.callsign))
}

function uniqueStations(stations: OnlineAtisStation[]): OnlineAtisStation[] {
  const seen = new Set<string>()
  return stations.filter((station) => {
    const key = station.callsign.toUpperCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parseVatsimAtisPayload(payload: unknown, icao: string): OnlineAtisStation[] {
  const root = asRecord(payload)
  const candidates = Array.isArray(payload)
    ? payload
    : [
        ...(Array.isArray(root?.atis) ? root.atis : []),
        ...(Array.isArray(root?.controllers) ? root.controllers : [])
      ]
  const code = icao.trim().toUpperCase()

  return sortStations(uniqueStations(candidates.flatMap((value) => {
    const station = asRecord(value)
    const callsign = asString(station?.callsign)
    if (!station || !callsign || !isAirportStation(callsign, code)) return []

    const lines = asLines(station.text_atis)
    if (!callsign.toUpperCase().endsWith('_ATIS') && lines.length === 0) return []
    return [{
      callsign,
      frequency: asString(station.frequency),
      information: asString(station.atis_code),
      lines
    }]
  })))
}

export function parseIvaoAtisPayload(payload: unknown, icao: string): OnlineAtisStation[] {
  const root = asRecord(payload)
  const clients = asRecord(root?.clients)
  const candidates = Array.isArray(clients?.atcs)
    ? clients.atcs
    : Array.isArray(clients?.atc)
      ? clients.atc
      : Array.isArray(root?.atcs)
        ? root.atcs
        : []
  const code = icao.trim().toUpperCase()

  return sortStations(uniqueStations(candidates.flatMap((value) => {
    const station = asRecord(value)
    const callsign = asString(station?.callsign)
    if (!station || !callsign || !isAirportStation(callsign, code)) return []

    const atcSession = asRecord(station.atcSession)
    const atis = asRecord(station.atis)
    const lines = asLines(atis?.lines)
    const isDedicatedAtis = callsign.toUpperCase().endsWith('_ATIS')
    const isAirportController = /_(?:TWR|APP|DEP|GND|DEL)(?:_|$)/.test(callsign.toUpperCase())
    if (!isDedicatedAtis && !isAirportController && lines.length === 0) return []
    return [{
      callsign,
      frequency: asString(atcSession?.frequency) ?? asString(station.frequency),
      information: asString(atis?.revision) ?? asString(atis?.letter),
      lines
    }]
  })))
}

async function fetchPayload(network: OnlineAtisNetwork): Promise<unknown> {
  const cached = payloadCache.get(network)
  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) return cached.payload

  const response = await fetch(network === 'vatsim' ? VATSIM_DATA_URL : IVAO_WHAZZUP_URL, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`${network.toUpperCase()} a répondu avec une erreur (HTTP ${response.status}).`)

  const payload: unknown = await response.json()
  payloadCache.set(network, { fetchedAt: Date.now(), payload })
  return payload
}

export async function requestOnlineAtis(network: OnlineAtisNetwork, icao: string): Promise<OnlineAtisResult> {
  const code = icao.trim().toUpperCase()
  const payload = await fetchPayload(network)
  const stations = network === 'vatsim'
    ? parseVatsimAtisPayload(payload, code)
    : parseIvaoAtisPayload(payload, code)

  return { network, icao: code, stations }
}
