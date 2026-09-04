import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getAirportLabel } from '@shared/airports/airportNames'
import type { RealRouteSource } from '@shared/types/realFlights'

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
  source: RealRouteSource
  observationCount: number
}

interface RealFlightsMapProps {
  routes: RealFlightsMapRoute[]
  onSelectRoute?: (routeId: number) => void
  selectedRouteId?: number | null
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

export function RealFlightsMap({ routes, onSelectRoute, selectedRouteId = null }: RealFlightsMapProps) {
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
    const byIcao = new Map<string, RealFlightsMapPoint & { isDeparture: boolean; routeIds: number[] }>()
    for (const route of routes) {
      const departure = byIcao.get(route.departure.icao)
      byIcao.set(route.departure.icao, {
        ...route.departure,
        isDeparture: true,
        routeIds: departure ? [...departure.routeIds, route.id] : [route.id]
      })
      const arrival = byIcao.get(route.arrival.icao)
      byIcao.set(route.arrival.icao, {
        ...route.arrival,
        isDeparture: arrival?.isDeparture ?? false,
        routeIds: arrival ? [...arrival.routeIds, route.id] : [route.id]
      })
    }
    return [...byIcao.values()]
  }, [routes])

  const initialCenter: LatLon = points[0] ?? [46.6, 2.5]

  return (
    <div className="live-map-wrapper">
      <MapContainer center={initialCenter} zoom={4} className="live-map" scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToPoints points={points} />
        {routes.map((route) => {
          const selected = route.id === selectedRouteId
          const weight = selected ? 5 : Math.min(4, 1.5 + Math.log2(Math.max(1, route.observationCount)))
          return (
            <Polyline
              key={route.id}
              positions={[[route.departure.lat, route.departure.lon], [route.arrival.lat, route.arrival.lon]]}
              pathOptions={{
                color: route.source === 'api' ? '#4d8bff' : '#f59e0b',
                weight,
                opacity: selected ? 1 : route.observationCount > 1 ? 0.72 : 0.45,
                dashArray: route.source === 'reciprocal' ? '7 8' : undefined
              }}
              eventHandlers={onSelectRoute ? { click: () => onSelectRoute(route.id) } : undefined}
            >
              <Tooltip sticky>
                {route.departure.icao} → {route.arrival.icao}<br />
                {route.source === 'api' ? 'Route observée' : 'Retour déduit'} · {route.observationCount > 0 ? `${route.observationCount} observation${route.observationCount > 1 ? 's' : ''}` : 'fréquence inconnue'}
              </Tooltip>
            </Polyline>
          )
        })}
        {markers.map((marker) => (
          <Marker
            key={marker.icao}
            position={[marker.lat, marker.lon]}
            icon={marker.isDeparture ? DEPARTURE_ICON : ARRIVAL_ICON}
            eventHandlers={onSelectRoute ? { click: () => onSelectRoute(marker.routeIds[0]) } : undefined}
          >
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
        <span>
          <span className="live-map-route-swatch real-flights-map-observed" /> Route observée
        </span>
        <span>
          <span className="live-map-route-swatch real-flights-map-inferred" /> Retour déduit
        </span>
        <span className="real-flights-map-frequency-hint">Trait épais = plus souvent observé</span>
      </div>
    </div>
  )
}
