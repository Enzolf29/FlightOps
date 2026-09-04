import { randomInt } from 'crypto'
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'http'
import { createServer as createHttpsServer, type Server as HttpsServer } from 'https'
import { networkInterfaces } from 'os'
import type { AddressInfo } from 'net'
import { CABIN_ANNOUNCEMENT_TYPES, isCabinAnnouncementType } from '@shared/types/cabinAnnouncements'
import type {
  TabletCabinCommand,
  TabletCabinStatus,
  TabletCalendarFlight,
  TabletOfpSummary,
  TabletServerInfo,
  TabletSnapshot
} from '@shared/types/tablet'
import type { SimTelemetry } from '@shared/types/simconnect'
import { buildLoadsheetComparison } from '@shared/simbrief/buildLoadsheetComparison'
import { parseOfpDetail, type OfpDetail } from '@shared/simbrief/parseOfpDetail'
import { getAllFlights, getFlightOfpJson, getFlightWithRelationsById } from '../db/repositories/flightRepository'
import { getStatus, onStatusChange, onTelemetry } from '../simconnect/connectionManager'
import { requestMetar } from '../simconnect/metarClient'
import {
  armFlight,
  disarmFlight,
  getArmedFlightId,
  getFlightEvents,
  getLiveFlightPath,
  onFlightEvent
} from '../simconnect/flightStatusDetector'
import { TABLET_PAGE_HTML } from './tabletPage'
import { createTabletCertificate, type TabletCertificateBundle } from './tabletCertificate'
import {
  buildTabletSetupHtml,
  TABLET_APP_ICON_PNG_192,
  TABLET_APP_ICON_PNG_512,
  TABLET_APP_ICON_SVG,
  TABLET_MANIFEST,
  TABLET_SERVICE_WORKER
} from './tabletPwa'

const PREFERRED_SETUP_PORT = 8732
const PREFERRED_HTTPS_PORT = 8733
const MAX_BODY_BYTES = 16_384
const MAX_TABLET_PATH_POINTS = 800

type CabinCommandListener = (command: TabletCabinCommand) => void

let server: HttpsServer | null = null
let setupServer: HttpServer | null = null
let port: number | null = null
let setupPort: number | null = null
let certificateBundle: TabletCertificateBundle | null = null
let pin = String(randomInt(100_000, 1_000_000))
let latestTelemetry: SimTelemetry | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null
let unsubscribers: Array<() => void> = []
let cabinStatus: TabletCabinStatus = {
  company: null,
  automationReady: false,
  gsxDetected: false,
  activeVoice: null,
  activeMusic: null,
  queuedTypes: [],
  availableTypes: [],
  boardingCompleted: false,
  finalLoadsheet: null
}

const ofpCache = new Map<number, { raw: string | null; detail: OfpDetail | null }>()

const streamClients = new Set<ServerResponse>()
const cabinCommandListeners = new Set<CabinCommandListener>()

function localIpAddresses(): string[] {
  const addresses = new Set<string>()
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.add(entry.address)
    }
  }
  return [...addresses]
}

function localUrls(protocol: 'http' | 'https', selectedPort: number | null): string[] {
  if (selectedPort === null) return []
  return localIpAddresses().map((address) => `${protocol}://${address}:${selectedPort}`)
}

export function getTabletServerInfo(): TabletServerInfo {
  return {
    running: server?.listening === true,
    port,
    pin,
    urls: localUrls('https', port),
    setupUrls: localUrls('http', setupPort),
    certificateFingerprint: certificateBundle?.caFingerprint ?? null,
    connectedClients: streamClients.size
  }
}

function downsamplePath<T>(points: T[]): T[] {
  if (points.length <= MAX_TABLET_PATH_POINTS) return [...points]
  const step = Math.ceil(points.length / MAX_TABLET_PATH_POINTS)
  const sampled = points.filter((_, index) => index % step === 0)
  const last = points.at(-1)
  if (last && sampled.at(-1) !== last) sampled.push(last)
  return sampled
}

function getOfpDetail(flightId: number): OfpDetail | null {
  const raw = getFlightOfpJson(flightId)
  const cached = ofpCache.get(flightId)
  if (cached?.raw === raw) return cached.detail
  const detail = raw ? parseOfpDetail(raw) : null
  ofpCache.set(flightId, { raw, detail })
  return detail
}

function toTabletOfp(detail: OfpDetail | null, includeRoutePath = true): TabletOfpSummary | null {
  if (!detail) return null
  const routePath = includeRoutePath
    ? [
        ...(detail.origin ? [{ lat: detail.origin.lat, lon: detail.origin.lon }] : []),
        ...detail.navlog.map((fix) => ({ lat: fix.lat, lon: fix.lon })),
        ...(detail.destination ? [{ lat: detail.destination.lat, lon: detail.destination.lon }] : [])
      ].filter((point, index, points) => {
        if (index === 0) return true
        const previous = points[index - 1]
        return Math.abs(point.lat - previous.lat) > 0.000001 || Math.abs(point.lon - previous.lon) > 0.000001
      })
    : []
  return {
    route: detail.route,
    sidIdent: detail.sidIdent,
    starIdent: detail.starIdent,
    departureRunway: detail.origin?.planRunway ?? null,
    arrivalRunway: detail.destination?.planRunway ?? null,
    cruiseAltitudeFeet: detail.cruiseAltitudeFeet,
    costIndex: detail.costIndex,
    distanceNm: detail.routeDistanceNm,
    isaDeviationCelsius: detail.isaDeviationCelsius,
    climbAvgWind: detail.climbAvgWind,
    cruiseAvgWind: detail.cruiseAvgWind,
    descentAvgWind: detail.descentAvgWind,
    // Les extrémités sont ajoutées explicitement : certains OFP ne répètent pas l'aéroport dans le
    // navlog, ce qui faisait disparaître la carte tablette avant le deuxième point réellement volé.
    routePath,
    alternateIcao: detail.alternate?.icaoCode ?? null,
    alternateRoute: detail.alternateRoute,
    alternateCruiseAltitudeFeet: detail.alternateCruiseAltitudeFeet,
    alternateDistanceNm: detail.alternateDistanceNm,
    alternateEteMinutes: detail.alternateEteMinutes
  }
}

function buildSnapshot(): TabletSnapshot {
  const armedFlightId = getArmedFlightId()
  const allFlights = getAllFlights()
  const availableFlights = allFlights.filter(
    (flight) => flight.status === 'upcoming' || flight.status === 'in_progress'
  )
  const calendarFlights: TabletCalendarFlight[] = availableFlights.map((flight) => ({
    flight,
    // Le calendrier n'a besoin que du briefing texte : les centaines de points navlog ne doivent
    // pas être renvoyées chaque seconde pour chaque futur vol.
    briefing: toTabletOfp(getOfpDetail(flight.id), false)
  }))
  const activeDetail = armedFlightId === null ? null : getOfpDetail(armedFlightId)
  const telemetry = latestTelemetry
    ? (({ diagnostics: _diagnostics, ...safeTelemetry }) => safeTelemetry)(latestTelemetry)
    : null

  return {
    generatedAt: new Date().toISOString(),
    simconnectStatus: getStatus(),
    armedFlightId,
    flight: armedFlightId === null ? null : getFlightWithRelationsById(armedFlightId),
    availableFlights,
    calendarFlights,
    telemetry,
    events: getFlightEvents().filter((event) => event.type !== 'operational_alert'),
    path: downsamplePath(getLiveFlightPath()),
    cabin: cabinStatus,
    ofp: toTabletOfp(activeDetail),
    loadsheet: activeDetail?.loadsheet ? {
      isFinal: cabinStatus.finalLoadsheet !== null,
      capturedAt: cabinStatus.finalLoadsheet?.capturedAt ?? null,
      rows: buildLoadsheetComparison(activeDetail.loadsheet, cabinStatus.finalLoadsheet)
    } : null
  }
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  response.end(JSON.stringify(payload))
}

function isAuthorized(url: URL): boolean {
  return url.searchParams.get('pin') === pin
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Requête trop volumineuse.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Requête invalide.'))
      }
    })
    request.on('error', reject)
  })
}

function pushSnapshot(response: ServerResponse): void {
  try {
    response.write(`data: ${JSON.stringify(buildSnapshot())}\n\n`)
  } catch {
    streamClients.delete(response)
  }
}

function broadcastSnapshot(): void {
  for (const client of streamClients) pushSnapshot(client)
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://flightops.local')

  if (request.method === 'GET' && requestUrl.pathname === '/') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https://tile.openstreetmap.org"
    })
    response.end(TABLET_PAGE_HTML)
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/manifest.webmanifest') {
    response.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-cache' })
    response.end(TABLET_MANIFEST)
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/app-icon.svg') {
    response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' })
    response.end(TABLET_APP_ICON_SVG)
    return
  }

  if (request.method === 'GET' && (requestUrl.pathname === '/app-icon-192.png' || requestUrl.pathname === '/app-icon-512.png')) {
    const icon = requestUrl.pathname.endsWith('512.png') ? TABLET_APP_ICON_PNG_512 : TABLET_APP_ICON_PNG_192
    response.writeHead(200, { 'content-type': 'image/png', 'content-length': icon.length, 'cache-control': 'public, max-age=86400' })
    response.end(icon)
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/sw.js') {
    response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache', 'service-worker-allowed': '/' })
    response.end(TABLET_SERVICE_WORKER)
    return
  }

  if (!isAuthorized(requestUrl)) {
    sendJson(response, 401, { error: 'Code d’appairage incorrect.' })
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/snapshot') {
    sendJson(response, 200, buildSnapshot())
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/stream') {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    })
    response.write(': FlightOps tablette\n\n')
    streamClients.add(response)
    pushSnapshot(response)
    request.on('close', () => streamClients.delete(response))
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/metar') {
    const icao = (requestUrl.searchParams.get('icao') ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{4}$/.test(icao)) {
      sendJson(response, 400, { error: 'Code OACI invalide.' })
      return
    }
    try {
      sendJson(response, 200, { icao, metar: await requestMetar(icao) })
    } catch (error) {
      sendJson(response, 502, { error: error instanceof Error ? error.message : 'METAR indisponible.' })
    }
    return
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/tracking/arm') {
    const body = await readJson(request)
    const flightId = Number(body.flightId)
    const flight = Number.isInteger(flightId) ? getFlightWithRelationsById(flightId) : null
    if (!flight || (flight.status !== 'upcoming' && flight.status !== 'in_progress')) {
      sendJson(response, 400, { error: 'Ce vol ne peut pas être suivi.' })
      return
    }
    armFlight(flightId)
    broadcastSnapshot()
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/tracking/disarm') {
    disarmFlight()
    broadcastSnapshot()
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/cabin') {
    const body = await readJson(request)
    let command: TabletCabinCommand | null = null
    if (body.action === 'stop_all') command = { action: 'stop_all' }
    else if ((body.action === 'play' || body.action === 'stop') && isCabinAnnouncementType(String(body.type))) {
      command = { action: body.action, type: String(body.type) as (typeof CABIN_ANNOUNCEMENT_TYPES)[number] }
    }
    if (!command) {
      sendJson(response, 400, { error: 'Commande d’annonce invalide.' })
      return
    }
    for (const listener of cabinCommandListeners) listener(command)
    sendJson(response, 200, { ok: true })
    return
  }

  sendJson(response, 404, { error: 'Page introuvable.' })
}

function handleSetupRequest(_request: IncomingMessage, response: ServerResponse): void {
  if (!certificateBundle) {
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Le certificat FlightOps n’est pas encore prêt.')
    return
  }
  const requestUrl = new URL(_request.url ?? '/', 'http://flightops-setup.local')
  if (requestUrl.pathname === '/flightops-local-ca.cer') {
    response.writeHead(200, {
      'content-type': 'application/x-x509-ca-cert',
      'content-disposition': 'attachment; filename="FlightOps-Local-CA.cer"',
      'content-length': certificateBundle.caCertificateDer.length,
      'cache-control': 'no-store'
    })
    response.end(certificateBundle.caCertificateDer)
    return
  }
  if (requestUrl.pathname === '/') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'none'"
    })
    response.end(buildTabletSetupHtml(localUrls('https', port), certificateBundle.caFingerprint))
    return
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  response.end('Page introuvable.')
}

function listen(tabletServer: HttpServer | HttpsServer, requestedPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const handleError = (error: NodeJS.ErrnoException): void => {
      tabletServer.removeListener('listening', handleListening)
      reject(error)
    }
    const handleListening = (): void => {
      tabletServer.removeListener('error', handleError)
      resolve((tabletServer.address() as AddressInfo).port)
    }
    tabletServer.once('error', handleError)
    tabletServer.once('listening', handleListening)
    tabletServer.listen(requestedPort, '0.0.0.0')
  })
}

export async function startTabletServer(): Promise<void> {
  if (server) return
  pin = String(randomInt(100_000, 1_000_000))
  certificateBundle = createTabletCertificate(localIpAddresses())
  const requestHandler = (request: IncomingMessage, response: ServerResponse): void => {
    void handleRequest(request, response).catch((error) => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : 'Erreur interne.' })
      } else response.end()
    })
  }

  let candidate = createHttpsServer({
    key: certificateBundle.privateKeyPem,
    cert: certificateBundle.certificatePem,
    minVersion: 'TLSv1.2'
  }, requestHandler)
  try {
    port = await listen(candidate, PREFERRED_HTTPS_PORT)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error
    candidate.close()
    candidate = createHttpsServer({ key: certificateBundle.privateKeyPem, cert: certificateBundle.certificatePem }, requestHandler)
    port = await listen(candidate, 0)
  }
  server = candidate

  let setupCandidate = createHttpServer(handleSetupRequest)
  try {
    setupPort = await listen(setupCandidate, PREFERRED_SETUP_PORT)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
      server.close()
      server = null
      port = null
      throw error
    }
    setupCandidate.close()
    setupCandidate = createHttpServer(handleSetupRequest)
    setupPort = await listen(setupCandidate, 0)
  }
  setupServer = setupCandidate

  unsubscribers = [
    onTelemetry((telemetry) => {
      latestTelemetry = telemetry
      broadcastSnapshot()
    }),
    onStatusChange(() => broadcastSnapshot()),
    onFlightEvent(() => broadcastSnapshot())
  ]
  heartbeat = setInterval(broadcastSnapshot, 15_000)
}

export function stopTabletServer(): void {
  for (const unsubscribe of unsubscribers) unsubscribe()
  unsubscribers = []
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  for (const client of streamClients) client.end()
  streamClients.clear()
  server?.close()
  setupServer?.close()
  server = null
  setupServer = null
  port = null
  setupPort = null
  certificateBundle = null
  latestTelemetry = null
}

export function publishTabletCabinStatus(status: TabletCabinStatus): void {
  cabinStatus = status
  broadcastSnapshot()
}

export function onTabletCabinCommand(listener: CabinCommandListener): () => void {
  cabinCommandListeners.add(listener)
  return () => cabinCommandListeners.delete(listener)
}
