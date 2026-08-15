import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getAirportLabel } from '@shared/airports/airportNames'

type LatLon = [number, number]

function airportIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="live-map-airport-pin" style="--pin-color:${color}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}

const DEPARTURE_ICON = airportIcon('#2fb170')
const ARRIVAL_ICON = airportIcon('#4d8bff')

export interface RealFlightsMapPoint {
  icao: string
  lat: number
  lon: number
}

export interface RealFlightsMapRoute {
  id: number
  departure: RealFlightsMapPoint
  arrival: RealFlightsMapPoint
}

interface RealFlightsMapProps {
  routes: RealFlightsMapRoute[]
  onSelectRoute?: (routeId: number) => void
}

function FitToPoints({ points }: { points: LatLon[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 5)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)])

  return null
}

export function RealFlightsMap({ routes, onSelectRoute }: RealFlightsMapProps) {
  const points = useMemo<LatLon[]>(() => {
    const list: LatLon[] = []
    for (const route of routes) {
      list.push([route.departure.lat, route.departure.lon])
      list.push([route.arrival.lat, route.arrival.lon])
    }
    return list
  }, [routes])

  // Un même aéroport peut être départ pour une route et arrivée pour une autre (routes
  // réciproques) — un seul marqueur par aéroport, marqué "départ" dès qu'il l'est pour au moins
  // une route visible.
  const markers = useMemo(() => {
    const byIcao = new Map<string, RealFlightsMapPoint & { isDeparture: boolean }>()
    for (const route of routes) {
      byIcao.set(route.departure.icao, { ...route.departure, isDeparture: true })
      if (!byIcao.has(route.arrival.icao)) {
        byIcao.set(route.arrival.icao, { ...route.arrival, isDeparture: false })
      }
    }
    return [...byIcao.values()]
  }, [routes])

  const initialCenter: LatLon = points[0] ?? [46.6, 2.5]

  return (
    <div className="live-map-wrapper">
      <MapContainer center={initialCenter} zoom={4} className="live-map" scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToPoints points={points} />
        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={[
              [route.departure.lat, route.departure.lon],
              [route.arrival.lat, route.arrival.lon]
            ]}
            pathOptions={{ color: '#4d8bff', weight: 2, opacity: 0.55 }}
            eventHandlers={onSelectRoute ? { click: () => onSelectRoute(route.id) } : undefined}
          />
        ))}
        {markers.map((marker) => (
          <Marker key={marker.icao} position={[marker.lat, marker.lon]} icon={marker.isDeparture ? DEPARTURE_ICON : ARRIVAL_ICON}>
            <Tooltip>{getAirportLabel(marker.icao)}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <div className="live-map-legend">
        <span>
          <span className="live-map-swatch" style={{ background: '#2fb170' }} /> Départ
        </span>
        <span>
          <span className="live-map-swatch" style={{ background: '#4d8bff' }} /> Arrivée
        </span>
      </div>
    </div>
  )
}
