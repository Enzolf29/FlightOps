import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { OfpAirportSummary, OfpNavlogFix } from '@shared/simbrief/parseOfpDetail'
import type { SimTelemetry } from '@shared/types/simconnect'
import { getAirportLabel } from '@shared/airports/airportNames'

const ROUTE_COLOR = '#4d8bff'
const TRAIL_COLOR = '#2fb170'
const MAX_TRAIL_POINTS = 3000

type LatLon = [number, number]

function airportIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="live-map-airport-pin" style="--pin-color:${color}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}

const ORIGIN_ICON = airportIcon('#2fb170')
const DESTINATION_ICON = airportIcon('#4d8bff')
const ALTERNATE_ICON = airportIcon('#e0a72c')

// Silhouette dessinée nez pointé plein nord (0°) pour que rotate(headingTrue) — qui tourne dans
// le sens horaire depuis l'orientation d'origine — corresponde exactement à la convention cap
// aéronautique (0°=Nord, 90°=Est…). Le glyphe Unicode ✈ ne pointait pas plein nord selon la
// police, ce qui décalait systématiquement l'orientation affichée par rapport au cap réel.
const AIRCRAFT_MARKER_PATH = 'M128,38 L140,118 L232,168 L148,148 L172,214 L128,182 L84,214 L108,148 L24,168 L116,118 Z'

function aircraftIcon(headingTrue: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="live-map-aircraft" style="transform: rotate(${headingTrue}deg)">
      <svg width="26" height="26" viewBox="0 0 256 256" fill="currentColor"><path d="${AIRCRAFT_MARKER_PATH}" /></svg>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })
}

function buildRoutePositions(
  origin: OfpAirportSummary | null,
  destination: OfpAirportSummary | null,
  navlog: OfpNavlogFix[]
): LatLon[] {
  if (navlog.length === 0) return []

  const positions: LatLon[] = []
  if (origin) positions.push([origin.lat, origin.lon])
  for (const fix of navlog) positions.push([fix.lat, fix.lon])
  if (destination) positions.push([destination.lat, destination.lon])

  return positions
}

function FitToRoute({ points, resetKey }: { points: LatLon[]; resetKey: string | number | null }) {
  const map = useMap()
  const lastFitKey = useRef<string | number | null>(null)

  useEffect(() => {
    if (points.length === 0 || resetKey === lastFitKey.current) return
    lastFitKey.current = resetKey
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [points, resetKey, map])

  return null
}

function RecenterControl({ position }: { position: LatLon | null }) {
  const map = useMap()
  if (!position) return null
  return (
    <button
      type="button"
      className="live-map-recenter"
      onClick={() => map.setView(position, Math.max(map.getZoom(), 9))}
    >
      Recentrer sur l’avion
    </button>
  )
}

interface LiveMapProps {
  resetKey: number | string | null
  origin: OfpAirportSummary | null
  destination: OfpAirportSummary | null
  alternate: OfpAirportSummary | null
  navlog: OfpNavlogFix[]
  telemetry: SimTelemetry | null
  /** Trajectoire déjà enregistrée (vol terminé) — remplace l'accumulation en direct depuis la télémétrie. */
  staticTrail?: LatLon[]
  /** Trajectoire déjà accumulée côté main process pour ce vol — reprend le tracé là où il en était
   * plutôt que de repartir de zéro en revenant sur cette page après l'avoir quittée. */
  initialTrail?: LatLon[]
  replayPosition?: { lat: number; lon: number; headingTrue: number; label: string } | null
}

export function LiveMap({ resetKey, origin, destination, alternate, navlog, telemetry, staticTrail, initialTrail, replayPosition }: LiveMapProps) {
  const [liveTrail, setLiveTrail] = useState<LatLon[]>([])
  const trailResetKey = useRef<string | number | null>(resetKey)
  const seededFromInitial = useRef(false)

  useEffect(() => {
    if (trailResetKey.current !== resetKey) {
      trailResetKey.current = resetKey
      seededFromInitial.current = false
      setLiveTrail([])
    }
  }, [resetKey])

  useEffect(() => {
    if (seededFromInitial.current || staticTrail || !initialTrail || initialTrail.length === 0) return
    seededFromInitial.current = true
    setLiveTrail((previous) => (previous.length === 0 ? initialTrail : previous))
  }, [initialTrail, staticTrail])

  useEffect(() => {
    if (!telemetry || staticTrail) return
    setLiveTrail((previous) => {
      const last = previous[previous.length - 1]
      if (last && last[0] === telemetry.latitude && last[1] === telemetry.longitude) return previous
      const next = [...previous, [telemetry.latitude, telemetry.longitude] as LatLon]
      if (next.length > MAX_TRAIL_POINTS) next.shift()
      return next
    })
  }, [telemetry, staticTrail])

  const trail = staticTrail ?? liveTrail

  const routePositions = useMemo(() => buildRoutePositions(origin, destination, navlog), [origin, destination, navlog])

  const aircraftPosition: LatLon | null = telemetry
    ? [telemetry.latitude, telemetry.longitude]
    : replayPosition
      ? [replayPosition.lat, replayPosition.lon]
      : null
  const aircraftHeading = telemetry?.headingTrue ?? replayPosition?.headingTrue ?? 0
  const aircraftLabel = telemetry?.atcId || telemetry?.title || replayPosition?.label || ''

  const boundsPoints = useMemo(() => {
    const points: LatLon[] = []
    if (origin) points.push([origin.lat, origin.lon])
    if (destination) points.push([destination.lat, destination.lon])
    if (alternate) points.push([alternate.lat, alternate.lon])
    for (const fix of navlog) points.push([fix.lat, fix.lon])
    if (trail.length > 0) points.push(...trail)
    if (points.length === 0 && aircraftPosition) points.push(aircraftPosition)
    return points
  }, [origin, destination, alternate, navlog, aircraftPosition, trail])

  const initialCenter: LatLon = boundsPoints[0] ?? aircraftPosition ?? [46.6, 2.5]

  return (
    <div className="live-map-wrapper">
      <MapContainer center={initialCenter} zoom={5} className="live-map" scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToRoute points={boundsPoints} resetKey={resetKey} />
        <RecenterControl position={aircraftPosition} />

        {routePositions.length > 1 ? (
          <Polyline positions={routePositions} pathOptions={{ color: ROUTE_COLOR, weight: 2, opacity: 0.45, dashArray: '4 8' }} />
        ) : null}

        {trail.length > 1 ? <Polyline positions={trail} pathOptions={{ color: TRAIL_COLOR, weight: 5, opacity: 0.95 }} /> : null}

        {origin ? (
          <Marker position={[origin.lat, origin.lon]} icon={ORIGIN_ICON}>
            <Tooltip direction="top">{getAirportLabel(origin.icaoCode)}</Tooltip>
          </Marker>
        ) : null}
        {destination ? (
          <Marker position={[destination.lat, destination.lon]} icon={DESTINATION_ICON}>
            <Tooltip direction="top">{getAirportLabel(destination.icaoCode)}</Tooltip>
          </Marker>
        ) : null}
        {alternate ? (
          <Marker position={[alternate.lat, alternate.lon]} icon={ALTERNATE_ICON}>
            <Tooltip direction="top">Déroutement : {getAirportLabel(alternate.icaoCode)}</Tooltip>
          </Marker>
        ) : null}
        {aircraftPosition ? (
          <Marker position={aircraftPosition} icon={aircraftIcon(aircraftHeading)}>
            <Tooltip direction="top">{aircraftLabel}</Tooltip>
          </Marker>
        ) : null}
      </MapContainer>
      <div className="live-map-legend">
        <span><i className="live-map-swatch" style={{ background: ROUTE_COLOR }} /> Route</span>
        <span><i className="live-map-swatch" style={{ background: TRAIL_COLOR }} /> Trajectoire volée</span>
      </div>
    </div>
  )
}
